import { defineStore } from 'pinia'
import { reactive, ref } from 'vue'

export type LayerKey =
  | 'boundary'
  | 'main_canal'
  | 'trunk_canal'
  | 'branch_canal'
  | 'parcels'

/** local = 本地矢量渲染底图；online = Carto 在线浅色底图；none = 仅业务矢量 */
export type BasemapMode = 'local' | 'online' | 'none'

export const LAYER_META: { key: LayerKey; label: string }[] = [
  { key: 'boundary', label: '外边界' },
  { key: 'main_canal', label: '总干渠' },
  { key: 'trunk_canal', label: '干渠' },
  { key: 'branch_canal', label: '支渠' },
  { key: 'parcels', label: '地块' },
]

export const useMapStore = defineStore('map', () => {
  const visibility = reactive<Record<LayerKey, boolean>>({
    boundary: true,
    main_canal: true,
    trunk_canal: true,
    branch_canal: true,
    parcels: true,
  })

  const selectedProps = ref<Record<string, unknown> | null>(null)
  const selectedLayer = ref<string>('')
  const choroplethEnabled = ref(true)
  const fitTrigger = ref(0)
  /** 默认在线底图；离线用本地总览图（勿扒 OSM.org） */
  const basemapMode = ref<BasemapMode>('online')
  /** 配置树/渠段表选中：高亮渠段（图层+OBJECTID）/ 田块 */
  const highlightCanalLayer = ref<LayerKey | null>(null)
  const highlightBranchObjectId = ref<number | null>(null)
  const highlightParcelObjectIds = ref<number[]>([])
  /** 递增后地图缩放到当前高亮要素 */
  const focusTrigger = ref(0)

  function setVisible(key: LayerKey, visible: boolean) {
    visibility[key] = visible
  }

  function setSelection(layer: string, props: Record<string, unknown> | null) {
    selectedLayer.value = layer
    selectedProps.value = props
  }

  function clearSelection() {
    selectedLayer.value = ''
    selectedProps.value = null
  }

  function fitToDistrict() {
    fitTrigger.value += 1
  }

  function setBasemap(mode: BasemapMode) {
    basemapMode.value = mode
  }

  function setHighlight(
    branchObjectId: number | null,
    parcelObjectIds: number[] = [],
    focus = true,
    canalLayer: LayerKey | null = 'branch_canal',
  ) {
    highlightBranchObjectId.value = branchObjectId
    highlightParcelObjectIds.value = parcelObjectIds
    highlightCanalLayer.value =
      branchObjectId != null ? canalLayer ?? 'branch_canal' : null
    if (focus) focusTrigger.value += 1
  }

  function clearHighlight() {
    highlightCanalLayer.value = null
    highlightBranchObjectId.value = null
    highlightParcelObjectIds.value = []
  }

  return {
    visibility,
    selectedProps,
    selectedLayer,
    choroplethEnabled,
    fitTrigger,
    basemapMode,
    highlightCanalLayer,
    highlightBranchObjectId,
    highlightParcelObjectIds,
    focusTrigger,
    setVisible,
    setSelection,
    clearSelection,
    fitToDistrict,
    setBasemap,
    setHighlight,
    clearHighlight,
  }
})
