import { defineStore } from 'pinia'
import { computed, ref, toRaw } from 'vue'
import { runCalc } from '@/calc/engine'
import {
  clearCalcInputsCache,
  clearSegmentsCache,
  clearTopologyCache,
  loadCalcInputs,
  loadCanalSegments,
  loadCanalTopology,
} from '@/calc/loadConfig'
import type { CalcInputsFile } from '@/calc/configTypes'
import type { CanalSegmentsFile } from '@/calc/segmentTypes'
import type { CanalTopologyFile } from '@/calc/topologyTypes'
import type { AreaId, DistrictResult, RoundId } from '@/calc/types'

const LS_KEY = 'dengkou-calc-inputs-v7'

export const useCalcStore = defineStore('calc', () => {
  const areaId = ref<AreaId>('ALL')
  const round = ref<RoundId>(1)
  const result = ref<DistrictResult | null>(null)
  const loading = ref(false)
  const configError = ref('')
  const inputs = ref<CalcInputsFile | null>(null)
  const topology = ref<CanalTopologyFile | null>(null)
  const segmentsFile = ref<CanalSegmentsFile | null>(null)
  const configDirty = ref(false)

  const summary = computed(() => {
    if (!result.value) return null
    const r = result.value
    return {
      districtCoefficient: r.districtCoefficient,
      canalCoefficient: r.canalCoefficient,
      fieldCoefficient: r.fieldCoefficient,
      netVolume: r.netVolume,
      headworksVolume: r.headworksVolume,
      terminalVolume: r.terminalVolume,
      canalLossTotal: r.canalLossTotal,
      round: r.round,
      coefficient: r.districtCoefficient,
      grossVolume: r.headworksVolume,
    }
  })

  function persistLocal(data: CalcInputsFile) {
    try {
      localStorage.setItem(LS_KEY, JSON.stringify(data))
    } catch {
      /* ignore */
    }
  }

  function readLocal(): CalcInputsFile | null {
    try {
      const raw = localStorage.getItem(LS_KEY)
      if (!raw) return null
      const parsed = JSON.parse(raw) as CalcInputsFile
      if (!parsed.rounds || !parsed.units) return null
      return parsed
    } catch {
      return null
    }
  }

  async function ensureTopology(force = false) {
    if (!force && topology.value) return
    clearTopologyCache()
    topology.value = await loadCanalTopology(true)
  }

  async function ensureSegments(force = false) {
    if (!force && segmentsFile.value) return
    clearSegmentsCache()
    segmentsFile.value = await loadCanalSegments(true)
  }

  async function ensureConfig(forceFile = false) {
    await ensureTopology(forceFile)
    await ensureSegments(forceFile).catch(() => undefined)
    if (!forceFile && inputs.value) return

    if (!forceFile) {
      const local = readLocal()
      if (
        local?.units &&
        local.rounds &&
        local.segments &&
        Object.keys(local.segments).length > 0
      ) {
        inputs.value = local
        configDirty.value = true
        return
      }
    }

    clearCalcInputsCache()
    inputs.value = await loadCalcInputs(true)
    configDirty.value = false
  }

  function setArea(id: AreaId) {
    areaId.value = id
    void execute()
  }

  function setRound(r: RoundId) {
    round.value = r
    void execute()
  }

  async function reloadConfig() {
    inputs.value = null
    localStorage.removeItem(LS_KEY)
    await ensureConfig(true)
    await execute()
  }

  function cloneInputs(data: CalcInputsFile): CalcInputsFile {
    try {
      return structuredClone(toRaw(data))
    } catch {
      return JSON.parse(JSON.stringify(toRaw(data))) as CalcInputsFile
    }
  }

  function applyConfig(data: CalcInputsFile) {
    inputs.value = cloneInputs(data)
    persistLocal(toRaw(inputs.value) as CalcInputsFile)
    configDirty.value = true
    void execute()
  }

  function exportConfigJson() {
    if (!inputs.value) return
    const blob = new Blob([JSON.stringify(inputs.value, null, 2)], {
      type: 'application/json',
    })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'calc-inputs.json'
    a.click()
    URL.revokeObjectURL(url)
  }

  async function execute() {
    loading.value = true
    configError.value = ''
    try {
      await ensureConfig(false)
      result.value = runCalc({
        areaId: areaId.value,
        round: round.value,
        inputs: inputs.value,
        topology: topology.value,
        segmentsFile: segmentsFile.value,
      })
    } catch (e) {
      configError.value = e instanceof Error ? e.message : String(e)
      console.error(e)
    } finally {
      loading.value = false
    }
  }

  void execute()

  return {
    areaId,
    round,
    result,
    loading,
    configError,
    inputs,
    topology,
    segmentsFile,
    configDirty,
    summary,
    setArea,
    setRound,
    reloadConfig,
    applyConfig,
    exportConfigJson,
    execute,
    ensureConfig,
  }
})
