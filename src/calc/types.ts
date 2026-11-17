/** Shared calc types — align with tech system dual water lines. */

export type AreaId = 'A' | 'B' | 'C' | 'ALL'
export type RoundId = 1 | 2 | 3

export interface CalcUnit {
  id: string
  name: string
  areaId: Exclude<AreaId, 'ALL'>
}

export interface UnitResult {
  unitId: string
  unitName: string
  areaId: Exclude<AreaId, 'ALL'>
  /** W净 田间净灌溉水量（万 m³） */
  netVolume: number
  /** W末级 末级入田/单元入口水量（万 m³） */
  terminalVolume: number
  /** 渠道段损失示意（毛分摊或入口−末级，万 m³）——展示用 */
  canalLoss: number
  /** η田间 = W净 / W末级 */
  fieldCoefficient: number
  /** 单元尺度示意：净/末级（同 fieldCoefficient） */
  coefficient: number
}

export interface AreaResult {
  areaId: Exclude<AreaId, 'ALL'>
  areaName: string
  netVolume: number
  terminalVolume: number
  fieldCoefficient: number
  units: UnitResult[]
}

export interface DistrictResult {
  round: RoundId
  /** W净 */
  netVolume: number
  /** W毛 渠首 */
  headworksVolume: number
  /** W末级 */
  terminalVolume: number
  /** η灌区 = W净/W毛 */
  districtCoefficient: number
  /** η渠系 = W末级/W毛 */
  canalCoefficient: number
  /** η田间 = W净/W末级 */
  fieldCoefficient: number
  /** @deprecated 兼容旧字段名 → districtCoefficient */
  yearCoefficient: number
  /** @deprecated 兼容 → headworksVolume */
  grossVolume: number
  areas: AreaResult[]
  colorUnits: UnitResult[]
  /** 支渠最末级明细（配置拓扑模式） */
  branchResults?: BranchResult[]
  /** 渠段过程结果 */
  segmentResults?: SegmentResult[]
  /** Σ渠段模型损失 */
  canalLossTotal?: number
}

export interface BranchResult {
  branchId: string
  name: string
  trunkId: string
  areaId: Exclude<AreaId, 'ALL'>
  netVolume: number
  terminalVolume: number
  fieldCoefficient: number
  parcelCount: number
}

export interface SegmentResult {
  segmentId: string
  name: string
  level: 'main' | 'trunk' | 'branch'
  areaId: Exclude<AreaId, 'ALL'> | null
  branchId: string | null
  isTerminal: boolean
  inflowVolume: number
  lossVolume: number
  outflowVolume: number
  segmentEfficiency: number
  lossSource?: string
}

export interface RunCalcParams {
  areaId: AreaId
  round: RoundId
}
