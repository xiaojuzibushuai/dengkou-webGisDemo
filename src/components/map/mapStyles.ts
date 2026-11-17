import { Fill, Stroke, Style } from 'ol/style'
import type { FeatureLike } from 'ol/Feature'
import { parcelCoefficient } from '@/calc/engine'
import type { BranchResult, UnitResult } from '@/calc/types'
import type { CanalTopologyFile } from '@/calc/topologyTypes'

/** 高对比分级色（不透明度拉高，色相拉开） */
function etaColor(eta: number): string {
  if (eta >= 0.75) return 'rgba(0, 120, 60, 0.78)' // 深绿
  if (eta >= 0.65) return 'rgba(70, 200, 90, 0.72)' // 亮绿
  if (eta >= 0.55) return 'rgba(255, 220, 0, 0.78)' // 黄
  if (eta >= 0.45) return 'rgba(255, 120, 0, 0.78)' // 橙
  return 'rgba(200, 20, 40, 0.78)' // 红
}

export function boundaryStyle() {
  return new Style({
    stroke: new Stroke({ color: '#0b3d5c', width: 2.5 }),
    fill: new Fill({ color: 'rgba(11, 61, 92, 0.04)' }),
  })
}

export function canalStyle(width: number, color: string) {
  return new Style({
    stroke: new Stroke({ color, width, lineCap: 'round' }),
  })
}

export function parcelStyle(
  feature: FeatureLike,
  units: UnitResult[] | undefined,
  choropleth: boolean,
  topology?: CanalTopologyFile | null,
  branchResults?: BranchResult[] | null,
  highlightParcelIds?: number[],
) {
  const props = feature.getProperties()
  const oid = props.OBJECTID ?? props.ObjectID ?? props.FID ?? 0
  const oidNum = Number(oid) || 0
  const highlighted = highlightParcelIds?.includes(oidNum)
  const fill =
    choropleth && units?.length
      ? etaColor(parcelCoefficient(oid as string | number, units, topology, branchResults))
      : 'rgba(90, 150, 100, 0.22)'

  return new Style({
    stroke: new Stroke({
      color: highlighted ? '#c0392b' : 'rgba(60, 90, 60, 0.35)',
      width: highlighted ? 2 : 0.6,
    }),
    fill: new Fill({ color: fill }),
    zIndex: highlighted ? 10 : 1,
  })
}

export function branchHighlightStyle(width = 5) {
  return new Style({
    stroke: new Stroke({ color: '#c0392b', width, lineCap: 'round' }),
  })
}

export const LAYER_COLORS = {
  main_canal: '#0a4d8c',
  trunk_canal: '#1a73b8',
  branch_canal: '#4aa3df',
} as const
