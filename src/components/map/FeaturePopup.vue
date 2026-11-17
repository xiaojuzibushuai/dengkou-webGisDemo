<script setup lang="ts">
import { computed } from 'vue'
import { useMapStore } from '@/stores/mapStore'
import { labelOf } from './attrLabels'

const mapStore = useMapStore()

const LAYER_CN: Record<string, string> = {
  parcels: '地块',
  boundary: '外边界',
  main_canal: '总干渠',
  trunk_canal: '干渠',
  branch_canal: '支渠',
}

const rows = computed(() => {
  const props = mapStore.selectedProps
  if (!props) return []
  const prefer = [
    'PTNAME',
    'NAME',
    'IRRNAME',
    'IRRTYPE',
    'PTAREA',
    '亩数',
    '面积',
    'Shape_Area',
    'Shape_Leng',
    'SHAPE_Leng',
    'PROVINCIAL',
    'CITY',
    'COUNTY',
    'REMARK',
    'OBJECTID',
  ]
  const keys = Object.keys(props).filter(
    (k) => props[k] !== null && props[k] !== undefined && props[k] !== '',
  )
  const ordered = [
    ...prefer.filter((k) => keys.includes(k)),
    ...keys.filter((k) => !prefer.includes(k)),
  ]
  return ordered.slice(0, 18).map((k) => ({
    k,
    label: labelOf(k),
    v: String(props[k]),
  }))
})

const layerTitle = computed(
  () => LAYER_CN[mapStore.selectedLayer] || mapStore.selectedLayer || '要素',
)
</script>

<template>
  <div v-if="mapStore.selectedProps" class="popup">
    <div class="popup-head">
      <div>
        <div class="t">{{ layerTitle }}属性</div>
        <div class="s">来自灌区一张图矢量字段</div>
      </div>
      <el-button text size="small" @click="mapStore.clearSelection()">关闭</el-button>
    </div>
    <el-scrollbar max-height="260px">
      <table>
        <tbody>
          <tr v-for="row in rows" :key="row.k">
            <th>
              <div class="cn">{{ row.label }}</div>
              <div class="en">{{ row.k }}</div>
            </th>
            <td>{{ row.v }}</td>
          </tr>
        </tbody>
      </table>
    </el-scrollbar>
  </div>
</template>

<style scoped>
.popup {
  background: rgba(255, 255, 255, 0.98);
  border-radius: 10px;
  box-shadow: 0 8px 24px rgba(15, 40, 70, 0.16);
  border: 1px solid #d7e2ec;
  padding: 12px 14px;
  width: 300px;
}
.popup-head {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 8px;
}
.t {
  font-weight: 700;
  font-size: 14px;
  color: #0b3d5c;
}
.s {
  font-size: 11px;
  color: #7a8b9a;
  margin-top: 2px;
}
table {
  width: 100%;
  border-collapse: collapse;
  font-size: 12px;
}
th {
  text-align: left;
  font-weight: 500;
  padding: 6px 8px 6px 0;
  vertical-align: top;
  width: 42%;
  border-bottom: 1px solid #eef2f6;
}
.cn {
  color: #334;
}
.en {
  color: #99a;
  font-size: 10px;
  margin-top: 1px;
}
td {
  color: #111;
  padding: 6px 0;
  word-break: break-all;
  border-bottom: 1px solid #eef2f6;
}
</style>
