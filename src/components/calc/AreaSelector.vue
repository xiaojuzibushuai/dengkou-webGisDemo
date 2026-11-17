<script setup lang="ts">
import { useCalcStore } from '@/stores/calcStore'
import type { AreaId } from '@/calc/types'

const calcStore = useCalcStore()

const options: { label: string; value: AreaId }[] = [
  { label: '全灌区', value: 'ALL' },
  { label: '上游S1', value: 'A' },
  { label: '中游S2', value: 'B' },
  { label: '下游S3', value: 'C' },
]
</script>

<template>
  <div class="selector">
    <span class="label">片区</span>
    <el-radio-group
      :model-value="calcStore.areaId"
      size="small"
      @change="(v: string | number | boolean | undefined) => calcStore.setArea(v as AreaId)"
    >
      <el-radio-button v-for="opt in options" :key="opt.value" :value="opt.value">
        {{ opt.label }}
      </el-radio-button>
    </el-radio-group>
  </div>
</template>

<style scoped>
.selector {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
}
.label {
  font-size: 13px;
  color: #555;
  font-weight: 500;
}
</style>
