import type { RoundId } from './types'
import type { SegmentFlowConfig } from './segmentTypes'

/** 单元×轮次：田间净水量 + 末级入田水量（农渠/支出口汇总） */
export interface UnitRoundInput {
  /** 田间净灌溉水量（万 m³）——田间主线 */
  netVolume: number
  /** 末级入田水量（万 m³）——渠道主线末端 */
  terminalVolume: number
}

export interface UnitConfig {
  name: string
  areaId: 'A' | 'B' | 'C'
  rounds: Record<string, UnitRoundInput>
}

export interface RoundHeadworks {
  /** 渠首毛灌溉水量（万 m³） */
  headworksVolume: number
}

/** 支渠（最末级）× 轮次 */
export interface BranchRoundInput {
  netVolume: number
  terminalVolume: number
}

export interface BranchConfig {
  rounds: Record<string, BranchRoundInput>
}

/** 田块（田间最末级）× 轮次；有值时优先于支级分摊 */
export interface ParcelRoundInput {
  netVolume: number
  /** 可选；缺省不单独计末级，由支级 terminal 承担 */
  terminalVolume?: number
}

export interface ParcelConfig {
  rounds: Record<string, ParcelRoundInput>
}

export interface CalcInputsFile {
  _comment?: string
  rounds: Record<string, RoundHeadworks>
  /** 兼容对照：U1–U6（非最末级主录入） */
  units: Record<string, UnitConfig>
  /** 最末级渠道：支渠水量 */
  branches?: Record<string, BranchConfig>
  /** 最末级田间：田块水量（可选细填） */
  parcels?: Record<string, ParcelConfig>
  /** 渠段过程：W入 + 模型W损 → W出 */
  segments?: Record<string, SegmentFlowConfig>
}

export function getRoundInput(cfg: UnitConfig, round: RoundId): UnitRoundInput | null {
  return cfg.rounds[String(round)] ?? null
}

export function getHeadworks(file: CalcInputsFile, round: RoundId): number {
  return file.rounds[String(round)]?.headworksVolume ?? 0
}

export function getBranchRound(
  file: CalcInputsFile,
  branchId: string,
  round: RoundId,
): BranchRoundInput | null {
  return file.branches?.[branchId]?.rounds[String(round)] ?? null
}

export function getParcelRound(
  file: CalcInputsFile,
  objectId: string | number,
  round: RoundId,
): ParcelRoundInput | null {
  return file.parcels?.[String(objectId)]?.rounds[String(round)] ?? null
}
