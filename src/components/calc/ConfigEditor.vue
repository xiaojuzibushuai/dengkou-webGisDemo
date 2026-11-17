<script setup lang="ts">
import { computed, ref, toRaw, watch } from 'vue'
import { useCalcStore } from '@/stores/calcStore'
import { useMapStore } from '@/stores/mapStore'
import type { CalcInputsFile } from '@/calc/configTypes'
import { AREA_NAMES } from '@/calc/units'

const calcStore = useCalcStore()
const mapStore = useMapStore()
const draft = ref<CalcInputsFile | null>(null)
const treeFilter = ref('')
const selectedKey = ref<string>('')
/** 本地编辑未应用前，禁止用 store.inputs 深监听把 draft 冲掉 */
const draftDirty = ref(false)

/** 轮次只跟顶栏，侧栏不再另选 */
const editRound = computed(() => calcStore.round)
/** E1 预置只读；E2/E3 可改 */
const isReadonly = computed(() => editRound.value === 1)

/** Pinia/Vue 响应式 Proxy 不能直接 structuredClone，否则 draft 一直 null → 表单全 0 */
function cloneInputs(data: CalcInputsFile): CalcInputsFile {
  try {
    return structuredClone(toRaw(data))
  } catch {
    return JSON.parse(JSON.stringify(toRaw(data))) as CalcInputsFile
  }
}

function syncDraftFromStore(force = false) {
  if (!force && draftDirty.value) return
  const src = calcStore.inputs
  if (!src) return
  draft.value = cloneInputs(src)
}

watch(() => calcStore.inputs, () => syncDraftFromStore(false), { immediate: true })

/** 改数后防抖写入 localStorage + 重算（E1/E2/E3 同文件三套 rounds） */
let saveTimer: ReturnType<typeof setTimeout> | null = null
const saveHint = ref('')

function ensureDraft(): CalcInputsFile | null {
  if (!draft.value && calcStore.inputs) {
    draft.value = cloneInputs(calcStore.inputs)
  }
  return draft.value
}

function scheduleAutoSave() {
  if (isReadonly.value) return
  if (!ensureDraft()) return
  draftDirty.value = true
  saveHint.value = '保存中…'
  if (saveTimer) clearTimeout(saveTimer)
  saveTimer = setTimeout(() => {
    try {
      if (!draft.value) return
      calcStore.applyConfig(cloneInputs(draft.value))
      saveHint.value = `E${editRound.value} 已自动保存`
      setTimeout(() => {
        if (saveHint.value.startsWith('E')) saveHint.value = ''
      }, 1600)
    } finally {
      draftDirty.value = false
    }
  }, 350)
}

function onNum(v: number | undefined | null): number | null {
  if (v == null || Number.isNaN(Number(v))) return null
  return Number(v)
}

const headworks = computed({
  get() {
    if (!draft.value) return 0
    return draft.value.rounds[String(editRound.value)]?.headworksVolume ?? 0
  },
  set(v: number) {
    if (isReadonly.value) return
    const d = ensureDraft()
    if (!d) return
    const n = onNum(v)
    if (n == null) return
    if (!d.rounds[String(editRound.value)]) {
      d.rounds[String(editRound.value)] = { headworksVolume: n }
    } else {
      d.rounds[String(editRound.value)].headworksVolume = n
    }
    scheduleAutoSave()
  },
})

interface TreeNode {
  key: string
  label: string
  kind: 'main' | 'trunk' | 'branch' | 'parcel'
  areaId?: string
  branchId?: string
  objectId?: number
  parcelCount?: number
  children?: TreeNode[]
}

const treeData = computed<TreeNode[]>(() => {
  const topo = calcStore.topology
  if (!topo) return []
  const q = treeFilter.value.trim().toLowerCase()

  const mainChildren: TreeNode[] = topo.trunks.map((t) => {
    const branches = topo.branches
      .filter((b) => b.trunkId === t.id)
      .map((b) => {
        const parcelChildren: TreeNode[] = b.parcelObjectIds.slice(0, 80).map((oid) => {
          const meta = topo.parcels[String(oid)]
          const rawName = meta?.name || '未命名'
          // 田块 PTNAME 常写成「××支渠N」，避免误当成渠道
          return {
            key: `parcel-${oid}`,
            label: `田块 ${oid}（${rawName}）`,
            kind: 'parcel' as const,
            branchId: b.id,
            objectId: oid,
            areaId: b.areaId,
          }
        })
        const more = b.parcelObjectIds.length - parcelChildren.length
        if (more > 0) {
          parcelChildren.push({
            key: `parcel-more-${b.id}`,
            label: `…另有 ${more} 块田（在 JSON 中编辑）`,
            kind: 'parcel',
            branchId: b.id,
            areaId: b.areaId,
          })
        }
        return {
          key: `branch-${b.id}`,
          label: `支渠 · ${b.name}（${b.parcelObjectIds.length} 田）`,
          kind: 'branch' as const,
          branchId: b.id,
          objectId: b.objectId,
          areaId: b.areaId,
          parcelCount: b.parcelObjectIds.length,
          children: parcelChildren,
        }
      })
      .filter((n) => {
        if (!q) return true
        if (n.label.toLowerCase().includes(q)) return true
        return n.children?.some((c) => c.label.toLowerCase().includes(q))
      })

    return {
      key: `trunk-${t.id}`,
      label: `${t.name} · ${AREA_NAMES[t.areaId]}`,
      kind: 'trunk' as const,
      areaId: t.areaId,
      objectId: t.objectId,
      children: branches,
    }
  })

  return [
    {
      key: 'main-M0',
      label: `${topo.main.name}（渠首 W毛）`,
      kind: 'main',
      children: mainChildren,
    },
  ]
})

const defaultExpanded = computed(() => {
  const topo = calcStore.topology
  if (!topo?.trunks[0]) return ['main-M0']
  const firstTrunk = `trunk-${topo.trunks[0].id}`
  const firstBranch = topo.branches.find((b) => b.trunkId === topo.trunks[0].id)
  return ['main-M0', firstTrunk, firstBranch ? `branch-${firstBranch.id}` : ''].filter(Boolean)
})

const selectedBranch = computed(() => {
  if (!selectedKey.value.startsWith('branch-') || !calcStore.topology) return null
  const id = selectedKey.value.slice('branch-'.length)
  return calcStore.topology.branches.find((b) => b.id === id) ?? null
})

const selectedParcelOid = computed(() => {
  if (!selectedKey.value.startsWith('parcel-')) return null
  const raw = selectedKey.value.slice('parcel-'.length)
  if (raw.startsWith('more-')) return null
  const n = Number(raw)
  return Number.isFinite(n) ? n : null
})

/** 当前树节点对应的渠段 id */
const selectedSegmentId = computed(() => {
  if (selectedKey.value === 'main-M0') return 'Seg_M0'
  if (selectedKey.value.startsWith('trunk-')) {
    return `Seg_${selectedKey.value.slice('trunk-'.length)}`
  }
  if (selectedKey.value.startsWith('branch-')) {
    return `Seg_${selectedKey.value.slice('branch-'.length)}`
  }
  if (selectedParcelOid.value != null && calcStore.topology) {
    const meta = calcStore.topology.parcels[String(selectedParcelOid.value)]
    return meta ? `Seg_${meta.branchId}` : null
  }
  return null
})

const selectedSegmentMeta = computed(() => {
  const id = selectedSegmentId.value
  if (!id || !calcStore.segmentsFile) return null
  return calcStore.segmentsFile.segments.find((s) => s.id === id) ?? null
})

const segmentFlow = computed(() => {
  const id = selectedSegmentId.value
  if (!id || !draft.value) {
    return { inflowVolume: 0, lossVolume: 0, outflowVolume: 0, lossSource: '' }
  }
  const row = draft.value.segments?.[id]?.rounds[String(editRound.value)]
  return {
    inflowVolume: row?.inflowVolume ?? 0,
    lossVolume: row?.lossVolume ?? 0,
    outflowVolume: row?.outflowVolume ?? 0,
    lossSource: row?.lossSource ?? '',
  }
})

function setSegmentField(field: 'inflowVolume' | 'lossVolume', v: number | undefined | null) {
  if (isReadonly.value) return
  const id = selectedSegmentId.value
  const d = ensureDraft()
  const n = onNum(v)
  if (!id || !d || n == null) return
  if (!d.segments) d.segments = {}
  if (!d.segments[id]) d.segments[id] = { rounds: {} }
  const prev = d.segments[id].rounds[String(editRound.value)] ?? {
    inflowVolume: 0,
    lossVolume: 0,
    outflowVolume: 0,
    lossSource: 'manual',
  }
  const next = { ...prev, [field]: n }
  next.outflowVolume = Math.max(0, round2(next.inflowVolume - next.lossVolume))
  if (field === 'lossVolume') next.lossSource = 'manual'
  d.segments[id].rounds[String(editRound.value)] = next

  const meta = selectedSegmentMeta.value
  if (meta?.isTerminal && meta.branchId) {
    if (!d.branches) d.branches = {}
    if (!d.branches[meta.branchId]) {
      d.branches[meta.branchId] = { rounds: {} }
    }
    const br = d.branches[meta.branchId].rounds[String(editRound.value)] ?? {
      netVolume: 0,
      terminalVolume: 0,
    }
    d.branches[meta.branchId].rounds[String(editRound.value)] = {
      ...br,
      terminalVolume: next.outflowVolume,
    }
  }
  scheduleAutoSave()
}

function round2(n: number) {
  return Math.round(n * 100) / 100
}

const parcelEdit = computed(() => {
  const oid = selectedParcelOid.value
  if (oid == null || !draft.value) return { netVolume: 0, terminalVolume: 0 }
  const row = draft.value.parcels?.[String(oid)]?.rounds[String(editRound.value)]
  return {
    netVolume: row?.netVolume ?? 0,
    terminalVolume: row?.terminalVolume ?? 0,
  }
})

function setParcelField(field: 'netVolume' | 'terminalVolume', v: number | undefined | null) {
  if (isReadonly.value) return
  const oid = selectedParcelOid.value
  const d = ensureDraft()
  const n = onNum(v)
  if (oid == null || !d || n == null) return
  if (!d.parcels) d.parcels = {}
  const key = String(oid)
  if (!d.parcels[key]) d.parcels[key] = { rounds: {} }
  const prev = d.parcels[key].rounds[String(editRound.value)] ?? {
    netVolume: 0,
  }
  d.parcels[key].rounds[String(editRound.value)] = {
    ...prev,
    [field]: n,
  }
  scheduleAutoSave()
}

const livePreview = computed(() => {
  const r = calcStore.result
  if (!r) return null
  return {
    net: r.netVolume,
    terminal: r.terminalVolume,
    head: r.headworksVolume,
    loss: r.canalLossTotal ?? 0,
    d: r.districtCoefficient,
    c: r.canalCoefficient,
    f: r.fieldCoefficient,
  }
})

const pathBreadcrumb = computed(() => {
  const topo = calcStore.topology
  if (!topo) return ''
  if (selectedBranch.value) {
    const t = topo.trunks.find((x) => x.id === selectedBranch.value!.trunkId)
    return `${topo.main.name} → ${t?.name || ''} → ${selectedBranch.value.name}（最末级）`
  }
  if (selectedParcelOid.value != null) {
    const meta = topo.parcels[String(selectedParcelOid.value)]
    const b = topo.branches.find((x) => x.id === meta?.branchId)
    const t = topo.trunks.find((x) => x.id === b?.trunkId)
    return `${topo.main.name} → ${t?.name || ''} → ${b?.name || ''} → 田块#${selectedParcelOid.value}`
  }
  if (selectedKey.value.startsWith('trunk-')) {
    const id = selectedKey.value.slice('trunk-'.length)
    const t = topo.trunks.find((x) => x.id === id)
    return `${topo.main.name} → ${t?.name || ''}（只读汇总）`
  }
  if (selectedKey.value.startsWith('main-')) return `${topo.main.name}（填 W毛）`
  return '请选择支渠（最末级）或田块'
})

function onTreeClick(data: TreeNode) {
  selectedKey.value = data.key
  if (data.kind === 'branch' && data.objectId != null) {
    const b = calcStore.topology?.branches.find((x) => x.id === data.branchId)
    mapStore.setHighlight(data.objectId, b?.parcelObjectIds?.slice(0, 200) ?? [])
  } else if (data.kind === 'parcel' && data.objectId != null) {
    const b = calcStore.topology?.branches.find((x) => x.id === data.branchId)
    mapStore.setHighlight(b?.objectId ?? null, [data.objectId])
  } else {
    mapStore.clearHighlight()
  }
}

async function ensureLoaded() {
  if (!calcStore.inputs) {
    await calcStore.ensureConfig()
    await calcStore.execute()
  }
  syncDraftFromStore(true)
}
void ensureLoaded()

function applyNow() {
  if (isReadonly.value) return
  const d = ensureDraft()
  if (!d) return
  if (saveTimer) clearTimeout(saveTimer)
  calcStore.applyConfig(cloneInputs(d))
  draftDirty.value = false
  saveHint.value = '已保存并重算'
}

/** 清空当前 E2/E3 轮次为空白模板 */
function resetCurrentRound() {
  if (isReadonly.value) return
  const d = ensureDraft()
  if (!d) return
  const rk = String(editRound.value)
  d.rounds[rk] = { headworksVolume: 0 }
  for (const seg of Object.values(d.segments || {})) {
    if (seg.rounds?.[rk]) delete seg.rounds[rk]
  }
  for (const br of Object.values(d.branches || {})) {
    if (br.rounds?.[rk]) delete br.rounds[rk]
  }
  for (const p of Object.values(d.parcels || {})) {
    if (p.rounds?.[rk]) delete p.rounds[rk]
  }
  draftDirty.value = false
  calcStore.applyConfig(cloneInputs(d))
  syncDraftFromStore(true)
  saveHint.value = `E${editRound.value} 已重置为空模板`
}

// 默认选中第一条支渠
watch(
  () => calcStore.topology,
  (topo) => {
    if (!topo || selectedKey.value) return
    const b = topo.branches[0]
    if (b) {
      selectedKey.value = `branch-${b.id}`
      mapStore.setHighlight(b.objectId, b.parcelObjectIds.slice(0, 200))
    }
  },
  { immediate: true },
)
</script>

<template>
  <div class="config-editor">
    <p class="intro">
      顶栏切换轮次。<b>E1</b> 预置只读对照；<b>E2/E3</b> 可改并自动保存，可用「重置本轮」清空。
    </p>

    <div class="toolbar">
      <span class="lab">当前轮次</span>
      <span class="round-tag">E{{ editRound }}{{ isReadonly ? ' 预置（只读）' : ' 自配' }}</span>
      <span v-if="saveHint" class="save-hint">{{ saveHint }}</span>
    </div>

    <div class="head-row">
      <span class="lab">渠首 W毛（万m³）</span>
      <el-input-number v-model="headworks" :min="0" :precision="1" size="small" :disabled="isReadonly" />
    </div>

    <div v-if="livePreview" class="preview">
      W毛 {{ livePreview.head }} · Σ末级 {{ livePreview.terminal }} · Σ净 {{ livePreview.net }} ·
      Σ段损 {{ livePreview.loss }}
      <br />
      η灌区 {{ livePreview.d }} · η渠系 {{ livePreview.c }} · η田间 {{ livePreview.f }}
      <span class="hint">{{ isReadonly ? '（E1 只读预览）' : '（改数后自动刷新）' }}</span>
    </div>

    <div class="path">{{ pathBreadcrumb }}</div>

    <div class="split">
      <div class="tree-pane">
        <el-input
          v-model="treeFilter"
          size="small"
          clearable
          placeholder="筛选支渠/田块"
          class="filter"
        />
        <el-tree
          v-if="treeData.length"
          :data="treeData"
          node-key="key"
          :props="{ label: 'label', children: 'children' }"
          :default-expanded-keys="defaultExpanded"
          highlight-current
          :current-node-key="selectedKey"
          @node-click="onTreeClick"
        />
        <p v-else class="tip">拓扑加载中…</p>
      </div>

      <div class="edit-pane">
        <!-- 渠段：只开上方属性 -->
        <template v-if="selectedSegmentMeta && selectedParcelOid == null">
          <div class="edit-title">
            渠段 · {{ selectedSegmentMeta.name }}
            <span class="badge">{{ selectedSegmentMeta.level }}</span>
          </div>
          <div class="meta">
            {{ selectedSegmentMeta.fromNodeId }} → {{ selectedSegmentMeta.toNodeId }}
            <template v-if="selectedSegmentMeta.isTerminal"> · 末级出口=W出</template>
            <template v-if="selectedBranch">
              · {{ AREA_NAMES[selectedBranch.areaId] }} ·
              {{ selectedBranch.parcelObjectIds.length }} 田
            </template>
          </div>
          <label class="fld">
            W入（万m³）
            <el-input-number
              :model-value="segmentFlow.inflowVolume"
              :controls="!isReadonly"
              :precision="4"
              :step="0.1"
              size="small"
              class="num"
              :disabled="isReadonly"
              @update:model-value="(v: number | undefined) => setSegmentField('inflowVolume', v)"
            />
          </label>
          <label class="fld">
            W损（万m³）
            <el-input-number
              :model-value="segmentFlow.lossVolume"
              :controls="!isReadonly"
              :precision="4"
              :step="0.1"
              size="small"
              class="num"
              :disabled="isReadonly"
              @update:model-value="(v: number | undefined) => setSegmentField('lossVolume', v)"
            />
          </label>
          <label class="fld">
            W出（自动：入−损）
            <el-input-number
              :model-value="segmentFlow.outflowVolume"
              :controls="false"
              :precision="4"
              size="small"
              class="num"
              disabled
            />
          </label>
          <p class="tip">
            本段渠道系数 η段 = W出/W入 =
            {{
              segmentFlow.inflowVolume > 0
                ? (segmentFlow.outflowVolume / segmentFlow.inflowVolume).toFixed(4)
                : '—'
            }}
            ；来源 {{ segmentFlow.lossSource || '—' }}。
            田间 W净 请点左侧「田块 …」编辑。
          </p>
        </template>

        <!-- 田块：只开田间净 -->
        <template v-else-if="selectedParcelOid != null">
          <div class="edit-title">田块 #{{ selectedParcelOid }}（田间）</div>
          <label class="fld">
            W净（万m³）
            <el-input-number
              :model-value="parcelEdit.netVolume"
              :controls="!isReadonly"
              :precision="4"
              :step="0.1"
              size="small"
              class="num"
              :disabled="isReadonly"
              @update:model-value="(v: number | undefined) => setParcelField('netVolume', v)"
            />
          </label>
          <p class="tip">
            {{
              isReadonly
                ? 'E1 预置只读：田块 W净 已按亩数分摊。'
                : '有田块净时该支 ΣW净 用田块合计。'
            }}
          </p>
        </template>

        <template v-else>
          <p class="tip">点左侧<strong>总干/干/支</strong>看/编渠段；点<strong>田块</strong>看/编 W净。</p>
        </template>
      </div>
    </div>

    <div class="actions">
      <el-button v-if="!isReadonly" type="primary" size="small" @click="applyNow">
        立即保存并重算
      </el-button>
      <el-button v-if="!isReadonly" size="small" type="warning" plain @click="resetCurrentRound">
        重置本轮 E{{ editRound }}
      </el-button>
      <el-button size="small" @click="calcStore.exportConfigJson()">导出整包 JSON</el-button>
    </div>
  </div>
</template>

<style scoped>
.config-editor {
  display: flex;
  flex-direction: column;
  gap: 8px;
  height: 100%;
  min-height: 0;
}
.intro,
.tip,
.hint,
.meta,
.path {
  margin: 0;
  font-size: 12px;
  color: #666;
  line-height: 1.45;
}
.path {
  color: #0b3d5c;
  font-weight: 600;
}
.toolbar,
.head-row,
.actions {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}
.lab {
  font-size: 12px;
  color: #555;
}
.save-hint {
  font-size: 12px;
  color: #0a7a3e;
}
.round-tag {
  font-size: 12px;
  font-weight: 700;
  color: #0c3d5c;
  background: #e8f1f7;
  padding: 3px 8px;
  border-radius: 4px;
}
.preview {
  font-size: 12px;
  background: #f0f6fb;
  border: 1px solid #c5d8e8;
  border-radius: 6px;
  padding: 6px 8px;
  color: #234;
}
.split {
  display: grid;
  grid-template-columns: 1.1fr 0.9fr;
  gap: 8px;
  min-height: 260px;
  flex: 1;
  min-width: 0;
}
.tree-pane,
.edit-pane {
  border: 1px solid #e2e8ef;
  border-radius: 6px;
  padding: 6px;
  overflow: auto;
  min-height: 0;
  background: #fff;
}
.filter {
  margin-bottom: 6px;
}
.edit-title {
  font-size: 13px;
  font-weight: 600;
  margin-bottom: 6px;
  margin-top: 4px;
}
.badge {
  margin-left: 6px;
  font-size: 11px;
  font-weight: 500;
  color: #1a73b8;
  background: #e8f1fa;
  padding: 1px 6px;
  border-radius: 4px;
}
.fld {
  display: flex;
  flex-direction: column;
  gap: 4px;
  font-size: 12px;
  margin-bottom: 8px;
}
.num {
  width: 100%;
}
</style>
