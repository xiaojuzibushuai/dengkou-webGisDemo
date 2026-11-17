/**
 * 双主线测算引擎（最末级优先 + 渠段过程）
 * - W毛=渠首；渠段 W入+模型W损→W出；支出口Σ=W末级
 * - W净=田间（田块/支净量；正式为网格墒情）
 * - η灌区=净/毛，η渠系=末级/毛，η田间=净/末级
 */

import { AREA_NAMES } from './units'
import {
  getBranchRound,
  getHeadworks,
  getParcelRound,
  type CalcInputsFile,
} from './configTypes'
import type { CanalSegmentsFile } from './segmentTypes'
import type { CanalTopologyFile } from './topologyTypes'
import type {
  AreaResult,
  BranchResult,
  DistrictResult,
  RoundId,
  RunCalcParams,
  SegmentResult,
  UnitResult,
} from './types'

function round2(n: number): number {
  return Math.round(n * 100) / 100
}

function round4(n: number): number {
  return Math.round(n * 10000) / 10000
}

function fromNetTerminal(
  unitId: string,
  unitName: string,
  areaId: 'A' | 'B' | 'C',
  netVolume: number,
  terminalVolume: number,
): UnitResult {
  const net = round2(netVolume)
  const terminal = round2(terminalVolume)
  const fieldCoefficient = terminal > 0 ? round4(net / terminal) : 0
  return {
    unitId,
    unitName,
    areaId,
    netVolume: net,
    terminalVolume: terminal,
    canalLoss: round2(Math.max(0, terminal - net)),
    fieldCoefficient,
    coefficient: fieldCoefficient,
  }
}

function aggregateArea(areaId: 'A' | 'B' | 'C', units: UnitResult[]): AreaResult {
  const areaUnits = units.filter((u) => u.areaId === areaId)
  const netVolume = round2(areaUnits.reduce((s, u) => s + u.netVolume, 0))
  const terminalVolume = round2(areaUnits.reduce((s, u) => s + u.terminalVolume, 0))
  return {
    areaId,
    areaName: AREA_NAMES[areaId],
    netVolume,
    terminalVolume,
    fieldCoefficient: terminalVolume > 0 ? round4(netVolume / terminalVolume) : 0,
    units: areaUnits,
  }
}

/** 读取渠段过程：W入 + 模型W损 → W出 */
export function resolveSegmentFlows(
  inputs: CalcInputsFile,
  segmentsFile: CanalSegmentsFile,
  round: RoundId,
): SegmentResult[] {
  const rk = String(round)
  return segmentsFile.segments.map((s) => {
    const row = inputs.segments?.[s.id]?.rounds[rk]
    const inflow = row?.inflowVolume ?? 0
    const loss = row?.lossVolume ?? 0
    const outflow =
      row?.outflowVolume != null && row.outflowVolume >= 0
        ? row.outflowVolume
        : Math.max(0, inflow - loss)
    return {
      segmentId: s.id,
      name: s.name,
      level: s.level,
      areaId: s.areaId,
      branchId: s.branchId,
      isTerminal: s.isTerminal,
      inflowVolume: round2(inflow),
      lossVolume: round2(loss),
      outflowVolume: round2(outflow),
      segmentEfficiency: inflow > 0 ? round4(outflow / inflow) : 0,
      lossSource: row?.lossSource,
    }
  })
}

/**
 * 从最末级汇总：田块→净；渠段支出口优先作 W末级；否则支表 terminal
 */
export function aggregateFromTerminal(
  inputs: CalcInputsFile,
  topology: CanalTopologyFile,
  round: RoundId,
  segmentResults?: SegmentResult[],
): { branches: BranchResult[]; units: UnitResult[] } {
  const outletByBranch = new Map<string, number>()
  if (segmentResults?.length) {
    for (const s of segmentResults) {
      if (s.isTerminal && s.branchId) outletByBranch.set(s.branchId, s.outflowVolume)
    }
  }

  const branchResults: BranchResult[] = []

  for (const b of topology.branches) {
    const parcelIds = b.parcelObjectIds
    let parcelNet = 0
    let parcelTerminal = 0
    let parcelNetCount = 0
    let parcelTermCount = 0

    for (const oid of parcelIds) {
      const row = getParcelRound(inputs, oid, round)
      if (!row) continue
      parcelNet += row.netVolume || 0
      parcelNetCount += 1
      if (row.terminalVolume != null && row.terminalVolume > 0) {
        parcelTerminal += row.terminalVolume
        parcelTermCount += 1
      }
    }

    const branchRow = getBranchRound(inputs, b.id, round)
    const net = parcelNetCount > 0 ? parcelNet : branchRow?.netVolume ?? 0

    // 末级优先：渠段支出口 → 支表 → 田块末级
    let terminal: number
    if (outletByBranch.has(b.id)) {
      terminal = outletByBranch.get(b.id)!
    } else if (branchRow && branchRow.terminalVolume > 0) {
      terminal = branchRow.terminalVolume
    } else if (parcelTermCount > 0) {
      terminal = parcelTerminal
    } else {
      terminal = branchRow?.terminalVolume ?? 0
    }

    branchResults.push({
      branchId: b.id,
      name: b.name,
      trunkId: b.trunkId,
      areaId: b.areaId,
      netVolume: round2(net),
      terminalVolume: round2(terminal),
      fieldCoefficient: terminal > 0 ? round4(net / terminal) : 0,
      parcelCount: parcelIds.length,
    })
  }

  const units: UnitResult[] = (['A', 'B', 'C'] as const).map((areaId) => {
    const list = branchResults.filter((x) => x.areaId === areaId)
    const net = list.reduce((s, x) => s + x.netVolume, 0)
    const term = list.reduce((s, x) => s + x.terminalVolume, 0)
    return fromNetTerminal(
      `Br-${areaId}`,
      `${AREA_NAMES[areaId]}·支汇总`,
      areaId,
      net,
      term,
    )
  })

  return { branches: branchResults, units }
}

/** 田块设色：用所属支田间系数（不再加随机扰动） */
export function parcelCoefficient(
  objectId: string | number,
  units: UnitResult[],
  topology?: CanalTopologyFile | null,
  branchResults?: BranchResult[] | null,
): number {
  const oid = String(objectId)
  if (topology && branchResults?.length) {
    const meta = topology.parcels[oid]
    if (meta) {
      const br = branchResults.find((b) => b.branchId === meta.branchId)
      if (br) return br.fieldCoefficient
    }
  }
  if (!units.length) return 0.55
  const n = Math.abs(Number(objectId) || 0)
  return units[n % units.length]?.fieldCoefficient ?? 0.55
}

export interface RunCalcOptions extends RunCalcParams {
  inputs?: CalcInputsFile | null
  topology?: CanalTopologyFile | null
  segmentsFile?: CanalSegmentsFile | null
}

export function runCalc(params: RunCalcOptions): DistrictResult {
  const { round, areaId, inputs, topology, segmentsFile } = params

  let allUnits: UnitResult[]
  let branchResults: BranchResult[] | undefined
  let segmentResults: SegmentResult[] | undefined
  let canalLossTotal: number | undefined

  if (inputs?.segments && segmentsFile && Object.keys(inputs.segments).length > 0) {
    segmentResults = resolveSegmentFlows(inputs, segmentsFile, round)
  }

  if (
    inputs &&
    topology &&
    ((inputs.branches && Object.keys(inputs.branches).length > 0) ||
      (segmentResults && segmentResults.some((s) => s.isTerminal)))
  ) {
    const agg = aggregateFromTerminal(inputs, topology, round, segmentResults)
    allUnits = agg.units
    branchResults = agg.branches
  } else {
    allUnits = (['A', 'B', 'C'] as const).map((id) =>
      fromNetTerminal(`Br-${id}`, `${AREA_NAMES[id]}·空`, id, 0, 0),
    )
  }

  const areas = (['A', 'B', 'C'] as const).map((id) => aggregateArea(id, allUnits))
  const filteredAreas =
    areaId === 'ALL' ? areas : areas.filter((a) => a.areaId === areaId)

  let netVolume = round2(filteredAreas.reduce((s, a) => s + a.netVolume, 0))
  let terminalVolume = round2(filteredAreas.reduce((s, a) => s + a.terminalVolume, 0))

  if (branchResults && areaId !== 'ALL') {
    const list = branchResults.filter((b) => b.areaId === areaId)
    netVolume = round2(list.reduce((s, b) => s + b.netVolume, 0))
    terminalVolume = round2(list.reduce((s, b) => s + b.terminalVolume, 0))
  } else if (branchResults && areaId === 'ALL') {
    netVolume = round2(branchResults.reduce((s, b) => s + b.netVolume, 0))
    terminalVolume = round2(branchResults.reduce((s, b) => s + b.terminalVolume, 0))
  }

  let headworksVolume: number
  if (inputs && areaId === 'ALL') {
    headworksVolume = round2(getHeadworks(inputs, round))
  } else if (inputs && areaId !== 'ALL') {
    // 片区进口：优先用该片干渠段入口；否则按末级份额分摊渠首
    const trunkIn = segmentResults?.find(
      (s) => s.level === 'trunk' && s.areaId === areaId,
    )
    if (trunkIn && trunkIn.inflowVolume > 0) {
      headworksVolume = round2(trunkIn.inflowVolume)
    } else {
      const allTerminal = branchResults
        ? round2(branchResults.reduce((s, b) => s + b.terminalVolume, 0))
        : round2(areas.reduce((s, a) => s + a.terminalVolume, 0))
      const headAll = getHeadworks(inputs, round)
      headworksVolume =
        allTerminal > 0 ? round2((terminalVolume / allTerminal) * headAll) : round2(headAll)
    }
  } else {
    headworksVolume = 0
  }

  // 渠道损失：全区=各段之和；片区=该片干+支 + 总干损失按片区分摊
  if (segmentResults?.length) {
    if (areaId === 'ALL') {
      canalLossTotal = round2(segmentResults.reduce((s, x) => s + x.lossVolume, 0))
    } else {
      const mainLoss =
        segmentResults.find((s) => s.level === 'main')?.lossVolume ?? 0
      const allTerm = branchResults
        ? branchResults.reduce((s, b) => s + b.terminalVolume, 0)
        : 0
      const share = allTerm > 0 ? terminalVolume / allTerm : 0
      const localLoss = segmentResults
        .filter((s) => s.areaId === areaId)
        .reduce((s, x) => s + x.lossVolume, 0)
      canalLossTotal = round2(localLoss + mainLoss * share)
    }
  }

  // 字段纪律：净不应大于末级/毛；异常时仍按公式算但可 >1，便于发现坏数据
  const districtCoefficient = headworksVolume > 0 ? round4(netVolume / headworksVolume) : 0
  const canalCoefficient = headworksVolume > 0 ? round4(terminalVolume / headworksVolume) : 0
  const fieldCoefficient = terminalVolume > 0 ? round4(netVolume / terminalVolume) : 0

  const filteredSegments =
    areaId === 'ALL' || !segmentResults
      ? segmentResults
      : segmentResults.filter((s) => s.level === 'main' || s.areaId === areaId)

  const unitsForColor =
    areaId === 'ALL' ? allUnits : allUnits.filter((u) => u.areaId === areaId)

  return {
    round,
    netVolume,
    headworksVolume,
    terminalVolume,
    districtCoefficient,
    canalCoefficient,
    fieldCoefficient,
    yearCoefficient: districtCoefficient,
    grossVolume: headworksVolume,
    areas: filteredAreas,
    colorUnits: unitsForColor,
    branchResults:
      areaId === 'ALL' || !branchResults
        ? branchResults
        : branchResults.filter((b) => b.areaId === areaId),
    segmentResults: filteredSegments,
    canalLossTotal,
  }
}
