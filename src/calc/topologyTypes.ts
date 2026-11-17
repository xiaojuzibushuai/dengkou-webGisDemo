/** 总干→干→支→田块；支 = 最末级（田块端） */

export interface CanalMainNode {
  id: string
  objectId: number
  name: string
}

export interface CanalTrunkNode {
  id: string
  objectId: number
  name: string
  areaId: 'A' | 'B' | 'C'
}

export interface CanalBranchNode {
  id: string
  objectId: number
  name: string
  trunkId: string
  areaId: 'A' | 'B' | 'C'
  parcelObjectIds: number[]
}

export interface CanalParcelMeta {
  name: string
  mu: number
  branchId: string
}

export interface CanalTopologyFile {
  _comment?: string
  main: CanalMainNode
  trunks: CanalTrunkNode[]
  branches: CanalBranchNode[]
  parcels: Record<string, CanalParcelMeta>
}
