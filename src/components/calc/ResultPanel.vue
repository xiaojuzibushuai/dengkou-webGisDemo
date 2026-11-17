<script setup lang="ts">
import { computed, ref } from 'vue'
import { use } from 'echarts/core'
import { CanvasRenderer } from 'echarts/renderers'
import { BarChart } from 'echarts/charts'
import {
  GridComponent,
  TooltipComponent,
  LegendComponent,
} from 'echarts/components'
import VChart from 'vue-echarts'
import { useCalcStore } from '@/stores/calcStore'
import { useMapStore, type LayerKey } from '@/stores/mapStore'
import ConfigEditor from './ConfigEditor.vue'

use([CanvasRenderer, BarChart, GridComponent, TooltipComponent, LegendComponent])

const calcStore = useCalcStore()
const mapStore = useMapStore()
const activeTab = ref('overview')
const selectedSegmentId = ref('')

const LEVEL_TO_LAYER: Record<string, LayerKey> = {
  main: 'main_canal',
  trunk: 'trunk_canal',
  branch: 'branch_canal',
}

function onSegmentRowClick(row: { segmentId: string; level: string; branchId: string | null }) {
  selectedSegmentId.value = row.segmentId
  const meta = calcStore.segmentsFile?.segments.find((s) => s.id === row.segmentId)
  if (!meta) return
  const layer = LEVEL_TO_LAYER[meta.level] ?? 'branch_canal'
  const parcelIds =
    meta.level === 'branch' && meta.parcelObjectIds?.length
      ? meta.parcelObjectIds.slice(0, 120)
      : []
  mapStore.setHighlight(meta.canalObjectId, parcelIds, true, layer)
}

function segmentRowClass({ row }: { row: { segmentId: string } }) {
  return row.segmentId === selectedSegmentId.value ? 'seg-on' : ''
}

const coefCards = computed(() => {
  const s = calcStore.summary
  return [
    {
      key: 'district',
      full: '灌区灌溉水利用系数',
      symbol: 'η灌区',
      formula: 'ΣW净 ÷ W毛',
      value: s?.districtCoefficient ?? 0,
      color: '#0b8f55',
    },
    {
      key: 'canal',
      full: '渠系水利用系数',
      symbol: 'η渠系',
      formula: 'ΣW末级 ÷ W毛',
      value: s?.canalCoefficient ?? 0,
      color: '#1a73b8',
    },
    {
      key: 'field',
      full: '田间水利用系数',
      symbol: 'η田间',
      formula: 'ΣW净 ÷ ΣW末级',
      value: s?.fieldCoefficient ?? 0,
      color: '#2a9d8f',
    },
  ]
})

const barOption = computed(() => {
  const areas = calcStore.result?.areas ?? []
  const s = calcStore.summary
  const multi = areas.length > 1
  return {
    tooltip: {
      trigger: 'axis',
      valueFormatter: (v: number | string) =>
        v === '-' || v === null || v === undefined ? '—' : Number(v).toFixed(1),
    },
    legend: {
      data: multi ? ['ΣW净', 'ΣW末级'] : ['ΣW净', 'ΣW末级', 'W毛'],
      top: 0,
      textStyle: { fontSize: 11 },
    },
    grid: { left: 42, right: 12, top: 36, bottom: 26 },
    xAxis: {
      type: 'category',
      data: multi
        ? [...areas.map((a) => a.areaName), '选区合计']
        : [...areas.map((a) => a.areaName)],
      axisLabel: { fontSize: 11 },
    },
    yAxis: { type: 'value', name: '万m³', nameTextStyle: { fontSize: 11 } },
    series: [
      {
        name: 'ΣW净',
        type: 'bar',
        barMaxWidth: 22,
        data: multi
          ? [...areas.map((a) => a.netVolume), s?.netVolume ?? 0]
          : areas.map((a) => a.netVolume),
        itemStyle: { color: '#2a9d8f', borderRadius: [3, 3, 0, 0] },
      },
      {
        name: 'ΣW末级',
        type: 'bar',
        barMaxWidth: 22,
        data: multi
          ? [...areas.map((a) => a.terminalVolume), s?.terminalVolume ?? 0]
          : areas.map((a) => a.terminalVolume),
        itemStyle: { color: '#1a73b8', borderRadius: [3, 3, 0, 0] },
      },
      ...(multi
        ? []
        : [
            {
              name: 'W毛',
              type: 'bar' as const,
              barMaxWidth: 22,
              data: [s?.headworksVolume ?? 0],
              itemStyle: { color: '#0c3d5c', borderRadius: [3, 3, 0, 0] },
            },
          ]),
    ],
  }
})

/** 片区明细：上/中/下游按干渠片区汇总（非旧 U1–U6） */
const areaRows = computed(() => {
  const r = calcStore.result
  if (!r) return []
  const topo = calcStore.topology
  return r.areas.map((a) => {
    const trunkIn = r.segmentResults?.find((s) => s.level === 'trunk' && s.areaId === a.areaId)
    const head = trunkIn?.inflowVolume ?? 0
    const branches = topo?.branches.filter((b) => b.areaId === a.areaId) ?? []
    const parcels = branches.reduce((n, b) => n + (b.parcelObjectIds?.length ?? 0), 0)
    return {
      areaId: a.areaId,
      areaName: a.areaName,
      netVolume: a.netVolume,
      terminalVolume: a.terminalVolume,
      headworksVolume: head,
      canalCoefficient: head > 0 ? a.terminalVolume / head : 0,
      districtCoefficient: head > 0 ? a.netVolume / head : 0,
      fieldCoefficient: a.fieldCoefficient,
      branchCount: branches.length,
      parcelCount: parcels,
    }
  })
})

const LEVEL_LABEL: Record<string, string> = {
  main: '总干',
  trunk: '干',
  branch: '支',
}

const segmentRows = computed(() => {
  const list = calcStore.result?.segmentResults ?? []
  const order = { main: 0, trunk: 1, branch: 2 } as Record<string, number>
  return [...list]
    .map((s) => ({
      ...s,
      levelLabel: LEVEL_LABEL[s.level] ?? s.level,
    }))
    .sort((a, b) => (order[a.level] ?? 9) - (order[b.level] ?? 9))
})

const sourceLabel = computed(() => (calcStore.configDirty ? '本地配置' : '预置配置'))

const checkProduct = computed(() => {
  const s = calcStore.summary
  if (!s) return null
  return s.canalCoefficient * s.fieldCoefficient
})

/** 渠道输水损失率（派生展示，≠ η渠系） */
const canalLossRate = computed(() => {
  const s = calcStore.summary
  if (!s || s.headworksVolume <= 0) return null
  return 1 - s.canalCoefficient
})

const fieldLossVolume = computed(() => {
  const s = calcStore.summary
  if (!s) return null
  return Math.max(0, s.terminalVolume - s.netVolume)
})

/** 当前筛选范围：渠道数（总干+干+支）与田块数 */
const scopeStats = computed(() => {
  const topo = calcStore.topology
  const area = calcStore.areaId
  if (!topo) {
    return { canalTotal: 0, main: 0, trunk: 0, branch: 0, parcel: 0 }
  }
  const trunks =
    area === 'ALL' ? topo.trunks : topo.trunks.filter((t) => t.areaId === area)
  const branches =
    area === 'ALL' ? topo.branches : topo.branches.filter((b) => b.areaId === area)
  const parcel = branches.reduce((n, b) => n + (b.parcelObjectIds?.length ?? 0), 0)
  const main = area === 'ALL' ? 1 : 0
  return {
    canalTotal: main + trunks.length + branches.length,
    main,
    trunk: trunks.length,
    branch: branches.length,
    parcel,
  }
})
</script>

<template>
  <div class="result-panel" v-loading="calcStore.loading">
    <div class="panel-head">
      <div>
        <div class="panel-title">双主线测算结果</div>
        <div class="panel-sub">
          首尾法：η灌区=ΣW净/W毛 · η渠系=ΣW末级/W毛 · η田间=ΣW净/ΣW末级
        </div>
      </div>
      <el-tag size="small" type="info" effect="plain">{{ sourceLabel }}</el-tag>
    </div>

    <el-tabs v-model="activeTab" class="tabs">
      <el-tab-pane label="结果概览" name="overview">
        <template v-if="calcStore.summary">
          <div class="hero">
            <div class="hero-main">
              <div class="hero-k">灌区灌溉水利用系数 η灌区 = ΣW净 ÷ W毛</div>
              <div class="hero-v">{{ calcStore.summary.districtCoefficient.toFixed(4) }}</div>
            </div>
            <div class="hero-side">
              <div class="hs">
                <span>恒等校核</span>
                <b>{{ checkProduct != null ? checkProduct.toFixed(4) : '—' }}</b>
              </div>
              <div class="hs-tip">η渠系×η田间 ≈ η灌区</div>
            </div>
          </div>

          <div class="scope-stats">
            <div class="stat">
              <span class="sk">渠道数</span>
              <b>{{ scopeStats.canalTotal }}</b>
              <span class="sd">
                总干 {{ scopeStats.main }} · 干 {{ scopeStats.trunk }} · 支
                {{ scopeStats.branch }}
              </span>
            </div>
            <div class="stat">
              <span class="sk">田块数</span>
              <b>{{ scopeStats.parcel }}</b>
              <span class="sd">当前筛选范围内挂接田块</span>
            </div>
          </div>

          <div class="block-title">水量三量 + 损失（Σ 为范围内累加）</div>
          <div class="metric-grid">
            <div class="vol">
              <div class="k">田间净灌溉水量 ΣW净</div>
              <div class="v">{{ calcStore.summary.netVolume.toFixed(1) }}<small>万m³</small></div>
            </div>
            <div class="vol">
              <div class="k">渠首毛灌溉水量 W毛</div>
              <div class="v">{{ calcStore.summary.headworksVolume.toFixed(1) }}<small>万m³</small></div>
            </div>
            <div class="vol">
              <div class="k">末级入田水量 ΣW末级</div>
              <div class="v">{{ calcStore.summary.terminalVolume.toFixed(1) }}<small>万m³</small></div>
            </div>
            <div class="vol">
              <div class="k">渠道输水损失 ΣV渗</div>
              <div class="v">
                {{ (calcStore.summary.canalLossTotal ?? 0).toFixed(1) }}<small>万m³</small>
              </div>
            </div>
            <div class="vol">
              <div class="k">田间损失水量</div>
              <div class="v">
                {{ fieldLossVolume != null ? fieldLossVolume.toFixed(1) : '—' }}<small>万m³</small>
              </div>
              <div class="hint">末级 − 净</div>
            </div>
            <div class="vol">
              <div class="k">渠系损失率</div>
              <div class="v">{{ canalLossRate != null ? canalLossRate.toFixed(4) : '—' }}</div>
              <div class="hint">1 − η渠系（派生）</div>
            </div>
          </div>

          <div class="block-title">三项水利用系数（范围内累加口径）</div>
          <div class="coef-grid">
            <div v-for="c in coefCards" :key="c.key" class="coef-card">
              <div class="coef-full">{{ c.full }}</div>
              <div class="coef-sym">{{ c.symbol }}</div>
              <div class="coef-val" :style="{ color: c.color }">{{ c.value.toFixed(4) }}</div>
              <div class="coef-fm">{{ c.formula }}</div>
              <div class="coef-bar">
                <i :style="{ width: `${Math.min(100, c.value * 100)}%`, background: c.color }" />
              </div>
            </div>
          </div>
          <p class="tab-tip">
            上中下游按三条干渠挂接：一扬干→S1、民生渠→S2、跃进渠→S3；支/田块归最近干。系数按当前筛选范围的 Σ 水量计算。
          </p>

          <div class="block-title">分片区水量对比</div>
          <VChart class="chart" :option="barOption" autoresize />
        </template>
      </el-tab-pane>

      <el-tab-pane label="片区明细" name="areas">
        <el-table :data="areaRows" size="default" height="100%" stripe border>
          <el-table-column prop="areaName" label="片区" min-width="100" />
          <el-table-column prop="branchCount" label="支渠数" width="72" align="right" />
          <el-table-column prop="parcelCount" label="田块数" width="72" align="right" />
          <el-table-column prop="headworksVolume" label="片区进口" width="88" align="right">
            <template #default="{ row }">{{ row.headworksVolume.toFixed(1) }}</template>
          </el-table-column>
          <el-table-column prop="terminalVolume" label="ΣW末级" width="80" align="right">
            <template #default="{ row }">{{ row.terminalVolume.toFixed(1) }}</template>
          </el-table-column>
          <el-table-column prop="netVolume" label="ΣW净" width="72" align="right">
            <template #default="{ row }">{{ row.netVolume.toFixed(1) }}</template>
          </el-table-column>
          <el-table-column prop="canalCoefficient" label="η渠系" width="72" align="right">
            <template #default="{ row }">{{ row.canalCoefficient.toFixed(4) }}</template>
          </el-table-column>
          <el-table-column prop="fieldCoefficient" label="η田间" width="72" align="right">
            <template #default="{ row }">{{ row.fieldCoefficient.toFixed(4) }}</template>
          </el-table-column>
          <el-table-column prop="districtCoefficient" label="η片区" width="72" align="right">
            <template #default="{ row }">{{ row.districtCoefficient.toFixed(4) }}</template>
          </el-table-column>
        </el-table>
        <p class="tab-tip">
          片区进口=该干渠段 W入；η片区=Σ净/进口，η渠系=Σ末级/进口，η田间=Σ净/Σ末级。
        </p>
      </el-tab-pane>

      <el-tab-pane label="渠段明细" name="segments">
        <p class="tab-tip top">点击行 → 地图红线定位该渠段（一期：每条渠道要素=1 段）。</p>
        <el-table
          :data="segmentRows"
          size="small"
          height="calc(100% - 48px)"
          stripe
          border
          highlight-current-row
          row-key="segmentId"
          :row-class-name="segmentRowClass"
          @row-click="onSegmentRowClick"
        >
          <el-table-column prop="name" label="渠段" min-width="110" fixed />
          <el-table-column prop="levelLabel" label="级别" width="56" />
          <el-table-column prop="inflowVolume" label="W入" width="72" align="right">
            <template #default="{ row }">{{ row.inflowVolume.toFixed(2) }}</template>
          </el-table-column>
          <el-table-column prop="lossVolume" label="W损" width="72" align="right">
            <template #default="{ row }">{{ row.lossVolume.toFixed(2) }}</template>
          </el-table-column>
          <el-table-column prop="outflowVolume" label="W出" width="72" align="right">
            <template #default="{ row }">{{ row.outflowVolume.toFixed(2) }}</template>
          </el-table-column>
          <el-table-column prop="segmentEfficiency" label="本段渠道系数" min-width="100" align="right">
            <template #default="{ row }">{{ row.segmentEfficiency.toFixed(4) }}</template>
          </el-table-column>
          <el-table-column prop="lossSource" label="损失来源" width="88" />
        </el-table>
        <p class="tab-tip">
          划分：总干1 + 干3 + 支165 = 169 段；支归最近干。本段系数=W出/W入；η渠系仍用 ΣW末级/W毛。
        </p>
      </el-tab-pane>

      <el-tab-pane label="参数配置" name="config">
        <ConfigEditor />
      </el-tab-pane>
    </el-tabs>
  </div>
</template>

<style scoped>
.result-panel {
  height: 100%;
  display: flex;
  flex-direction: column;
  padding: 14px 14px 10px;
  min-height: 0;
  box-sizing: border-box;
  background: linear-gradient(180deg, #f7fafc 0%, #eef3f7 100%);
}
.panel-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  margin-bottom: 6px;
}
.hero {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  background: linear-gradient(135deg, #0b3d5c, #1a73b8);
  color: #fff;
  border-radius: 10px;
  padding: 10px 14px;
  margin-bottom: 8px;
}
.hero-k {
  font-size: 12px;
  opacity: 0.9;
}
.hero-v {
  font-size: 26px;
  font-weight: 800;
  letter-spacing: 0.02em;
  line-height: 1.1;
  margin-top: 2px;
}
.hero-side {
  text-align: right;
  flex-shrink: 0;
}
.hs {
  font-size: 11px;
  opacity: 0.9;
  display: flex;
  flex-direction: column;
  gap: 2px;
}
.hs b {
  font-size: 18px;
}
.hs-tip {
  font-size: 10px;
  opacity: 0.75;
  margin-top: 2px;
}
.metric-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 6px;
  margin-bottom: 8px;
}
.vol {
  background: #fff;
  border: 1px solid #dce6ef;
  border-radius: 8px;
  padding: 8px 10px;
}
.vol .k {
  font-size: 11px;
  color: #6a7a8a;
  line-height: 1.3;
}
.vol .v {
  margin-top: 2px;
  font-size: 17px;
  font-weight: 700;
  color: #123;
}
.vol .v small {
  font-size: 11px;
  margin-left: 3px;
  color: #778;
  font-weight: 500;
}
.vol .hint {
  font-size: 10px;
  color: #8a9;
  margin-top: 1px;
}
.coef-grid {
  display: grid;
  grid-template-columns: 1fr;
  gap: 8px;
  margin-bottom: 6px;
}
.coef-card {
  background: #fff;
  border: 1px solid #dce6ef;
  border-radius: 8px;
  padding: 10px 12px;
}
.coef-full {
  font-size: 12px;
  font-weight: 600;
  color: #234;
}
.coef-sym {
  font-size: 11px;
  color: #6a7a8a;
  margin-top: 2px;
}
.coef-val {
  font-size: 22px;
  font-weight: 800;
  margin-top: 4px;
  line-height: 1.1;
}
.coef-fm {
  font-size: 11px;
  color: #567;
  margin-top: 2px;
}
.coef-bar {
  margin-top: 8px;
  height: 6px;
  background: #e8eef3;
  border-radius: 99px;
  overflow: hidden;
}
.coef-bar i {
  display: block;
  height: 100%;
  border-radius: 99px;
}
.panel-title {
  font-weight: 700;
  font-size: 16px;
  color: #0b3d5c;
}
.panel-sub {
  font-size: 11px;
  color: #7a8b9a;
  margin-top: 2px;
  line-height: 1.35;
}
.tabs {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
}
.tabs :deep(.el-tabs__header) {
  margin-bottom: 8px;
}
.tabs :deep(.el-tabs__nav-wrap::after) {
  height: 1px;
}
.tabs :deep(.el-tabs__content) {
  flex: 1;
  min-height: 0;
  overflow: hidden;
}
.tabs :deep(.el-tab-pane) {
  height: 100%;
  overflow: auto;
  padding-right: 2px;
}
.scope-stats {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 8px;
  margin: 8px 0 10px;
}
.scope-stats .stat {
  background: #fff;
  border: 1px solid #dce6ef;
  border-radius: 8px;
  padding: 8px 10px;
  display: flex;
  flex-direction: column;
  gap: 2px;
}
.scope-stats .sk {
  font-size: 11px;
  color: #6a7c8a;
  font-weight: 600;
}
.scope-stats b {
  font-size: 22px;
  color: #0c3d5c;
  line-height: 1.2;
}
.scope-stats .sd {
  font-size: 11px;
  color: #8a9aaa;
}
.block-title {
  font-size: 12px;
  font-weight: 700;
  color: #405664;
  margin: 4px 0 4px;
}
.chart {
  height: 210px;
  width: 100%;
  background: #fff;
  border: 1px solid #dce6ef;
  border-radius: 8px;
  margin-bottom: 8px;
}
.tab-tip {
  margin: 6px 0 0;
  font-size: 11px;
  color: #788;
  line-height: 1.4;
}
.tab-tip.top {
  margin: 0 0 6px;
}
:deep(.seg-on) > td {
  background: #e8f2fa !important;
}
:deep(.el-table__row) {
  cursor: pointer;
}
</style>
