/** 渠段拓扑：节点 + 线段（总干/干/支） */

export type SegmentLevel = 'main' | 'trunk' | 'branch'
export type NodeKind = 'headworks' | 'junction' | 'outlet'

export interface CanalNode {
  id: string
  name: string
  kind: NodeKind
  trunkId?: string
  branchId?: string
  areaId?: 'A' | 'B' | 'C'
  isTerminal?: boolean
}

export interface CanalSegment {
  id: string
  name: string
  level: SegmentLevel
  fromNodeId: string
  toNodeId: string
  canalObjectId: number
  parentSegmentId: string | null
  isTerminal: boolean
  areaId: 'A' | 'B' | 'C' | null
  branchId: string | null
  trunkId: string | null
  parcelObjectIds?: number[]
  intakeNodeId?: string
}

export interface CanalSegmentsFile {
  _comment?: string
  nodes: CanalNode[]
  segments: CanalSegment[]
}

/** 渠段×轮次水量：W入 + 模型W损 → W出 */
export interface SegmentRoundFlow {
  inflowVolume: number
  /** 智能渗漏模型给出（示意 stub_model） */
  lossVolume: number
  outflowVolume: number
  lossSource?: string
}

export interface SegmentFlowConfig {
  rounds: Record<string, SegmentRoundFlow>
}
