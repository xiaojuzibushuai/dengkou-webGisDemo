<script setup lang="ts">
import { LAYER_META, useMapStore } from '@/stores/mapStore'

const mapStore = useMapStore()
</script>

<template>
  <div class="panel">
    <div class="panel-title">图层</div>
    <el-checkbox
      v-for="item in LAYER_META"
      :key="item.key"
      :model-value="mapStore.visibility[item.key]"
      @change="(v: boolean | string | number) => mapStore.setVisible(item.key, Boolean(v))"
    >
      {{ item.label }}
    </el-checkbox>
    <el-divider />
    <el-checkbox v-model="mapStore.choroplethEnabled">
      系数分级设色
    </el-checkbox>
    <div class="hint">按地块 η 高低上色（专题图）</div>
    <el-button size="small" style="margin-top: 10px; width: 100%" @click="mapStore.fitToDistrict()">
      缩放到灌区
    </el-button>
  </div>
</template>

<style scoped>
.panel {
  background: rgba(255, 255, 255, 0.94);
  border-radius: 8px;
  padding: 12px 14px;
  box-shadow: 0 2px 12px rgba(0, 0, 0, 0.12);
  display: flex;
  flex-direction: column;
  gap: 6px;
  min-width: 150px;
}
.panel-title {
  font-weight: 600;
  font-size: 14px;
  margin-bottom: 4px;
  color: #0b3d5c;
}
.hint {
  font-size: 11px;
  color: #6a7a8a;
  line-height: 1.35;
  margin-top: -2px;
  margin-bottom: 4px;
}
</style>
