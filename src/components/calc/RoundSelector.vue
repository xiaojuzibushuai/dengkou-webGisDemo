<script setup lang="ts">
import { useCalcStore } from '@/stores/calcStore'
import type { RoundId } from '@/calc/types'
import { ROUND_LABELS } from '@/calc/units'

const calcStore = useCalcStore()
const rounds: RoundId[] = [1, 2, 3]
</script>

<template>
  <div class="selector">
    <span class="label">灌溉轮次</span>
    <el-radio-group
      :model-value="calcStore.round"
      size="small"
      @change="(v: string | number | boolean | undefined) => calcStore.setRound(Number(v) as RoundId)"
    >
      <el-radio-button v-for="r in rounds" :key="r" :value="r">
        {{ ROUND_LABELS[r] }}
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
