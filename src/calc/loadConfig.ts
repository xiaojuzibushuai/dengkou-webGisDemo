import type { CalcInputsFile } from './configTypes'
import type { CanalSegmentsFile } from './segmentTypes'
import type { CanalTopologyFile } from './topologyTypes'

let cachedInputs: CalcInputsFile | null = null
let cachedTopo: CanalTopologyFile | null = null
let cachedSegs: CanalSegmentsFile | null = null

/** 加载 public/config/calc-inputs.json */
export async function loadCalcInputs(force = false): Promise<CalcInputsFile> {
  if (cachedInputs && !force) return cachedInputs
  const res = await fetch(`/config/calc-inputs.json?t=${Date.now()}`)
  if (!res.ok) throw new Error(`无法加载测算配置: ${res.status}`)
  cachedInputs = (await res.json()) as CalcInputsFile
  return cachedInputs
}

/** 加载 总干→干→支→田块 拓扑 */
export async function loadCanalTopology(force = false): Promise<CanalTopologyFile> {
  if (cachedTopo && !force) return cachedTopo
  const res = await fetch(`/config/canal-topology.json?t=${Date.now()}`)
  if (!res.ok) throw new Error(`无法加载渠系拓扑: ${res.status}`)
  cachedTopo = (await res.json()) as CanalTopologyFile
  return cachedTopo
}

/** 加载渠段节点拓扑 */
export async function loadCanalSegments(force = false): Promise<CanalSegmentsFile> {
  if (cachedSegs && !force) return cachedSegs
  const res = await fetch(`/config/canal-segments.json?t=${Date.now()}`)
  if (!res.ok) throw new Error(`无法加载渠段拓扑: ${res.status}`)
  cachedSegs = (await res.json()) as CanalSegmentsFile
  return cachedSegs
}

export function clearCalcInputsCache() {
  cachedInputs = null
}

export function clearTopologyCache() {
  cachedTopo = null
}

export function clearSegmentsCache() {
  cachedSegs = null
}
