<script setup lang="ts">
import { onMounted, onUnmounted, watch } from 'vue'
import OlMap from 'ol/Map'
import View from 'ol/View'
import TileLayer from 'ol/layer/Tile'
import ImageLayer from 'ol/layer/Image'
import VectorLayer from 'ol/layer/Vector'
import XYZ from 'ol/source/XYZ'
import Static from 'ol/source/ImageStatic'
import VectorSource from 'ol/source/Vector'
import GeoJSON from 'ol/format/GeoJSON'
import { fromLonLat, transformExtent } from 'ol/proj'
import type BaseLayer from 'ol/layer/Base'
import type { FeatureLike } from 'ol/Feature'
import { defaults as defaultControls } from 'ol/control'
import { useMapStore, type BasemapMode, type LayerKey } from '@/stores/mapStore'
import { useCalcStore } from '@/stores/calcStore'
import {
  LAYER_COLORS,
  boundaryStyle,
  branchHighlightStyle,
  canalStyle,
  parcelStyle,
} from './mapStyles'

const mapStore = useMapStore()
const calcStore = useCalcStore()

let map: OlMap | null = null
let baseLayer: BaseLayer | null = null
const vectorLayers = new window.Map<LayerKey, VectorLayer>()

const GEO_FILES: { key: LayerKey; url: string }[] = [
  { key: 'parcels', url: '/geo/parcels.geojson' },
  { key: 'boundary', url: '/geo/boundary.geojson' },
  { key: 'branch_canal', url: '/geo/branch_canal.geojson' },
  { key: 'trunk_canal', url: '/geo/trunk_canal.geojson' },
  { key: 'main_canal', url: '/geo/main_canal.geojson' },
]

const FALLBACK_EXTENT_4326 = [110.14058, 40.38407, 111.20428, 40.65082]

function isHighlightedCanal(key: LayerKey, feature: FeatureLike) {
  if (mapStore.highlightCanalLayer !== key) return false
  if (mapStore.highlightBranchObjectId == null) return false
  return Number(feature.get('OBJECTID')) === mapStore.highlightBranchObjectId
}

function styleFor(key: LayerKey) {
  return (feature: FeatureLike) => {
    if (key === 'boundary') return boundaryStyle()
    if (key === 'main_canal') {
      if (isHighlightedCanal(key, feature)) return branchHighlightStyle(6)
      return canalStyle(4, LAYER_COLORS.main_canal)
    }
    if (key === 'trunk_canal') {
      if (isHighlightedCanal(key, feature)) return branchHighlightStyle(5)
      return canalStyle(3, LAYER_COLORS.trunk_canal)
    }
    if (key === 'branch_canal') {
      if (isHighlightedCanal(key, feature)) return branchHighlightStyle(5)
      return canalStyle(1.5, LAYER_COLORS.branch_canal)
    }
    return parcelStyle(
      feature,
      calcStore.result?.colorUnits,
      mapStore.choroplethEnabled,
      calcStore.topology,
      calcStore.result?.branchResults,
      mapStore.highlightParcelObjectIds,
    )
  }
}

async function loadOfflineExtent(): Promise<number[]> {
  try {
    const res = await fetch('/basemap/offline-extent.json')
    if (!res.ok) return FALLBACK_EXTENT_4326
    const j = await res.json()
    return [j.west, j.south, j.east, j.north]
  } catch {
    return FALLBACK_EXTENT_4326
  }
}

function syncMapChrome(mode: BasemapMode) {
  const el = document.getElementById('ol-map')
  if (!el) return
  el.dataset.basemap = mode
}

async function createBaseLayer(mode: BasemapMode): Promise<BaseLayer | null> {
  if (mode === 'none') return null

  if (mode === 'local') {
    // 软底衬：只铺灌区色块，地块/渠道仍靠矢量（与「无底图」区分开）
    const extent4326 = await loadOfflineExtent()
    const imageExtent = transformExtent(extent4326, 'EPSG:4326', 'EPSG:3857')
    return new ImageLayer({
      source: new Static({
        url: '/basemap/offline-overview.png',
        projection: 'EPSG:3857',
        imageExtent,
      }),
      zIndex: 0,
      opacity: 1,
    })
  }

  // 在线：OSM 正常浏览可用；禁止批量爬取 tile.openstreetmap.org（会 403）
  return new TileLayer({
    source: new XYZ({
      url: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
      attributions: '© OpenStreetMap contributors',
      crossOrigin: 'anonymous',
      maxZoom: 19,
    }),
    zIndex: 0,
  })
}

async function applyBasemap(mode: BasemapMode) {
  if (!map) return
  if (baseLayer) {
    map.removeLayer(baseLayer)
    baseLayer = null
  }
  baseLayer = await createBaseLayer(mode)
  if (baseLayer) map.getLayers().insertAt(0, baseLayer)
  syncMapChrome(mode)
  fitExtent()
}

async function loadLayer(key: LayerKey, url: string) {
  const res = await fetch(url)
  if (!res.ok) throw new Error(`加载失败: ${url}`)
  const json = await res.json()
  const source = new VectorSource({
    features: new GeoJSON().readFeatures(json, {
      dataProjection: 'EPSG:4326',
      featureProjection: 'EPSG:3857',
    }),
  })
  const layer = new VectorLayer({
    source,
    style: styleFor(key),
    visible: mapStore.visibility[key],
    properties: { layerKey: key },
    zIndex: key === 'parcels' ? 1 : key === 'boundary' ? 2 : 5,
    declutter: key.includes('canal'),
  })
  vectorLayers.set(key, layer)
  map?.addLayer(layer)
}

function fitExtent() {
  const boundary = vectorLayers.get('boundary')
  const source = boundary?.getSource()
  if (!map || !source) return
  const extent = source.getExtent()
  if (!extent || !isFinite(extent[0])) return
  map.getView().fit(extent, { padding: [56, 40, 56, 40], duration: 400, maxZoom: 12 })
}

function refreshParcelStyle() {
  const layer = vectorLayers.get('parcels')
  if (!layer) return
  layer.setStyle(styleFor('parcels'))
  layer.changed()
}

function refreshCanalStyles() {
  ;(['main_canal', 'trunk_canal', 'branch_canal'] as LayerKey[]).forEach((k) => {
    const layer = vectorLayers.get(k)
    if (!layer) return
    layer.setStyle(styleFor(k))
    layer.changed()
  })
}

function focusHighlight() {
  if (!map) return
  const parcelIds = mapStore.highlightParcelObjectIds
  const canalOid = mapStore.highlightBranchObjectId
  const canalLayer = mapStore.highlightCanalLayer

  if (parcelIds.length === 1) {
    const layer = vectorLayers.get('parcels')
    const src = layer?.getSource()
    if (!src) return
    const f = src.getFeatures().find((x) => Number(x.get('OBJECTID')) === parcelIds[0])
    if (f) {
      const ext = f.getGeometry()?.getExtent()
      if (ext) map.getView().fit(ext, { padding: [80, 80, 80, 80], duration: 350, maxZoom: 15 })
      return
    }
  }
  if (canalOid != null && canalLayer) {
    const layer = vectorLayers.get(canalLayer)
    const src = layer?.getSource()
    if (!src) return
    const f = src.getFeatures().find((x) => Number(x.get('OBJECTID')) === canalOid)
    if (f) {
      const ext = f.getGeometry()?.getExtent()
      if (ext) map.getView().fit(ext, { padding: [60, 60, 60, 60], duration: 350, maxZoom: 14 })
    }
  }
}

onMounted(async () => {
  map = new OlMap({
    target: 'ol-map',
    controls: defaultControls({ zoom: true, attribution: true }),
    layers: [],
    view: new View({
      center: fromLonLat([110.67, 40.52]),
      zoom: 10,
    }),
  })
  await applyBasemap(mapStore.basemapMode)

  for (const item of GEO_FILES) {
    try {
      await loadLayer(item.key, item.url)
    } catch (e) {
      console.error(e)
    }
  }
  fitExtent()

  map.on('singleclick', (evt) => {
    let found = false
    map!.forEachFeatureAtPixel(
      evt.pixel,
      (feature, layer) => {
        if (found) return true
        const key = (layer?.get('layerKey') as string) || ''
        const props = { ...feature.getProperties() }
        delete props.geometry
        mapStore.setSelection(key, props as Record<string, unknown>)
        found = true
        return true
      },
      { hitTolerance: 4 },
    )
    if (!found) mapStore.clearSelection()
  })
})

onUnmounted(() => {
  map?.setTarget(undefined)
  map = null
})

watch(
  () => ({ ...mapStore.visibility }),
  (vis) => {
    ;(Object.keys(vis) as LayerKey[]).forEach((key) => {
      vectorLayers.get(key)?.setVisible(vis[key])
    })
  },
  { deep: true },
)

watch(
  () =>
    [
      calcStore.result,
      mapStore.choroplethEnabled,
      mapStore.highlightParcelObjectIds,
      calcStore.topology,
    ] as const,
  () => refreshParcelStyle(),
  { deep: true },
)

watch(
  () => [mapStore.highlightBranchObjectId, mapStore.highlightCanalLayer] as const,
  () => refreshCanalStyles(),
)

watch(
  () => mapStore.focusTrigger,
  () => {
    refreshCanalStyles()
    refreshParcelStyle()
    focusHighlight()
  },
)

watch(
  () => mapStore.fitTrigger,
  () => fitExtent(),
)

watch(
  () => mapStore.basemapMode,
  (mode) => {
    void applyBasemap(mode)
  },
)
</script>

<template>
  <div id="ol-map" class="ol-map" />
</template>

<style scoped>
.ol-map {
  width: 100%;
  height: 100%;
  background: #d6e2ec;
}
/* 无底图：更干净的浅底，突出矢量 */
.ol-map[data-basemap='none'] {
  background: #eef1f4;
}
/* 本地总览：与软底衬 PNG 外沿同色，消除漂浮感 */
.ol-map[data-basemap='local'] {
  background: #d6e2ec;
}
.ol-map[data-basemap='online'] {
  background: #c8d5e0;
}
</style>
