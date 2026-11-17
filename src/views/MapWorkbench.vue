<script setup lang="ts">
import MapView from '@/components/map/MapView.vue'
import LayerPanel from '@/components/map/LayerPanel.vue'
import FeaturePopup from '@/components/map/FeaturePopup.vue'
import ResultPanel from '@/components/calc/ResultPanel.vue'
import { useCalcStore } from '@/stores/calcStore'
import { useMapStore, type BasemapMode } from '@/stores/mapStore'
import { onMounted } from 'vue'
import type { AreaId, RoundId } from '@/calc/types'

const calcStore = useCalcStore()
const mapStore = useMapStore()

const areaOptions: { label: string; value: AreaId }[] = [
  { label: '全灌区', value: 'ALL' },
  { label: '上游 S1', value: 'A' },
  { label: '中游 S2', value: 'B' },
  { label: '下游 S3', value: 'C' },
]

/** E1=预置演示数据；E2/E3=空模板自配（不再另设「模拟/配置」双开关） */
const roundOptions: { label: string; value: RoundId }[] = [
  { label: 'E1预置', value: 1 },
  { label: 'E2自配', value: 2 },
  { label: 'E3自配', value: 3 },
]

const basemapOptions: { label: string; value: BasemapMode }[] = [
  { label: '在线底图', value: 'online' },
  { label: '无底图', value: 'none' },
]

onMounted(() => {
  if (mapStore.basemapMode === 'local') mapStore.setBasemap('online')
})
</script>

<template>
  <div class="workbench">
    <header class="topbar">
      <div class="brand">
        <div class="title">灌溉水利用系数智慧测算平台</div>
      </div>
      <div class="top-meta">
        <span class="pill">双主线 · 首尾法</span>
        <span class="pill soft">一期演示</span>
      </div>
    </header>

    <div class="toolbar">
      <div class="tool-group">
        <span class="tool-label">片区</span>
        <div class="seg">
          <button
            v-for="opt in areaOptions"
            :key="opt.value"
            type="button"
            class="seg-btn"
            :class="{ on: calcStore.areaId === opt.value }"
            @click="calcStore.setArea(opt.value)"
          >
            {{ opt.label }}
          </button>
        </div>
      </div>

      <div class="tool-group">
        <span class="tool-label">轮次</span>
        <div class="seg">
          <button
            v-for="opt in roundOptions"
            :key="opt.value"
            type="button"
            class="seg-btn"
            :class="{ on: calcStore.round === opt.value }"
            @click="calcStore.setRound(opt.value)"
          >
            {{ opt.label }}
          </button>
        </div>
      </div>

      <div class="tool-group">
        <span class="tool-label">底图</span>
        <div class="seg">
          <button
            v-for="opt in basemapOptions"
            :key="opt.value"
            type="button"
            class="seg-btn"
            :class="{ on: mapStore.basemapMode === opt.value }"
            @click="mapStore.setBasemap(opt.value)"
          >
            {{ opt.label }}
          </button>
        </div>
      </div>
    </div>

    <div class="body">
      <div class="map-pane">
        <MapView />
        <div class="overlay left">
          <LayerPanel />
        </div>
        <div class="overlay popup">
          <FeaturePopup />
        </div>
        <div class="legend">
          <div class="legend-title">田间水利用系数 η田间</div>
          <div class="legend-item"><i style="background: #00783c" />≥ 0.75</div>
          <div class="legend-item"><i style="background: #46c85a" />0.65–0.75</div>
          <div class="legend-item"><i style="background: #ffdc00" />0.55–0.65</div>
          <div class="legend-item"><i style="background: #ff7800" />0.45–0.55</div>
          <div class="legend-item"><i style="background: #c81428" />&lt; 0.45</div>
        </div>
      </div>
      <aside class="side-pane">
        <ResultPanel />
      </aside>
    </div>
  </div>
</template>

<style scoped>
.workbench {
  height: 100vh;
  display: flex;
  flex-direction: column;
  background: #edf2f6;
  color: #1a2a33;
}
.topbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  padding: 14px 20px 10px;
  background: #0c3d5c;
  color: #fff;
}
.title {
  font-size: 18px;
  font-weight: 700;
}
.top-meta {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}
.pill {
  font-size: 12px;
  padding: 4px 10px;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.14);
  border: 1px solid rgba(255, 255, 255, 0.18);
}
.pill.soft {
  background: transparent;
  opacity: 0.85;
}

.toolbar {
  display: flex;
  flex-wrap: wrap;
  gap: 14px 18px;
  align-items: center;
  padding: 10px 16px;
  background: #fff;
  border-bottom: 1px solid #d9e2ea;
}
.tool-group {
  display: flex;
  align-items: center;
  gap: 8px;
}
.tool-label {
  font-size: 12px;
  color: #6a7c8a;
  font-weight: 600;
  min-width: 28px;
}
.seg {
  display: inline-flex;
  background: #eef3f7;
  border-radius: 8px;
  padding: 3px;
  gap: 2px;
}
.seg-btn {
  border: 0;
  background: transparent;
  color: #405664;
  font-size: 12px;
  font-weight: 600;
  padding: 6px 10px;
  border-radius: 6px;
  cursor: pointer;
  line-height: 1;
}
.seg-btn.on {
  background: #0c3d5c;
  color: #fff;
  box-shadow: 0 1px 2px rgba(12, 61, 92, 0.25);
}
.ghost-btn {
  border: 1px solid #c9d6e1;
  background: #fff;
  color: #0c3d5c;
  font-size: 12px;
  font-weight: 600;
  padding: 6px 10px;
  border-radius: 6px;
  cursor: pointer;
}

.body {
  flex: 1;
  min-height: 0;
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(440px, 36vw);
}
.map-pane {
  position: relative;
  min-width: 0;
}
.side-pane {
  background: #f7fafc;
  border-left: 1px solid #d9e2ea;
  min-height: 0;
  overflow: hidden;
  min-width: 440px;
}
.overlay.left {
  position: absolute;
  top: 12px;
  left: 12px;
  z-index: 2;
}
.overlay.popup {
  position: absolute;
  top: 12px;
  right: 12px;
  z-index: 2;
}
.legend {
  position: absolute;
  left: 12px;
  bottom: 28px;
  z-index: 2;
  background: rgba(255, 255, 255, 0.96);
  border: 1px solid #cfdbe6;
  border-radius: 10px;
  padding: 10px 12px;
  box-shadow: 0 6px 18px rgba(20, 40, 60, 0.12);
  font-size: 12px;
}
.legend-title {
  font-weight: 700;
  margin-bottom: 6px;
  color: #0b3d5c;
}
.legend-item {
  display: flex;
  align-items: center;
  gap: 8px;
  margin: 4px 0;
  color: #333;
}
.legend-item i {
  width: 18px;
  height: 12px;
  border-radius: 2px;
  display: inline-block;
  border: 1px solid rgba(0, 0, 0, 0.1);
}

@media (max-width: 1100px) {
  .body {
    grid-template-columns: 1fr;
    grid-template-rows: 52vh 1fr;
  }
  .side-pane {
    border-left: none;
    border-top: 1px solid #d9e2ea;
    min-width: 0;
  }
}
</style>
