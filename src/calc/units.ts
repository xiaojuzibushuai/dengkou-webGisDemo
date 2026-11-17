import type { CalcUnit } from './types'

/** 对齐技术体系：S1上游/S2中游/S3下游 × U1–U6 */
export const CALC_UNITS: CalcUnit[] = [
  { id: 'U1', name: 'U1（S1·玉米）', areaId: 'A' },
  { id: 'U2', name: 'U2（S1·玉米）', areaId: 'A' },
  { id: 'U3', name: 'U3（S2·玉米）', areaId: 'B' },
  { id: 'U4', name: 'U4（S2·玉米）', areaId: 'B' },
  { id: 'U5', name: 'U5（S3·葵花）', areaId: 'C' },
  { id: 'U6', name: 'U6（S3·玉米）', areaId: 'C' },
]

export const AREA_NAMES: Record<'A' | 'B' | 'C', string> = {
  A: '上游S1',
  B: '中游S2',
  C: '下游S3',
}

export const ROUND_LABELS: Record<1 | 2 | 3, string> = {
  1: '第1轮灌溉',
  2: '第2轮灌溉',
  3: '第3轮灌溉',
}
