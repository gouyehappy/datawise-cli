<script setup lang="ts">
import {computed, ref} from 'vue'
import {useI18n} from 'vue-i18n'
import {DwIcon} from '@/core/icons'
import {FormField} from '@/core/components'
import DwSelect from '@/core/components/DwSelect.vue'
import type {SelectOption} from '@/core/components/select.types'
import type {VisualQueryJoin} from '@/features/workspace/services/visual-query-builder.service'
import {layoutVisualQueryCanvas} from '@/features/workspace/services/visual-query-canvas.service'

const props = defineProps<{
  fromTable: string
  fromAlias: string
  joins: VisualQueryJoin[]
  availableTables: string[]
  joinTypeOptions: SelectOption[]
  leftOnOptions: (index: number) => SelectOption[]
  rightOnOptions: (index: number) => SelectOption[]
  canAddJoin: boolean
}>()

const emit = defineEmits<{
  'drop-table': [table: string]
  'select-join': [index: number]
  'remove-join': [index: number]
  'set-join-type': [index: number, type: string]
  'set-join-on-left': [index: number, value: string]
  'set-join-on-right': [index: number, value: string]
}>()

const {t} = useI18n()
const selectedJoinIndex = ref<number | null>(null)
const dragOver = ref(false)
const paletteFilter = ref('')

const layout = computed(() =>
    layoutVisualQueryCanvas({
      fromTable: props.fromTable,
      fromAlias: props.fromAlias,
      joins: props.joins,
    }),
)

const nodeById = computed(() => new Map(layout.value.nodes.map((node) => [node.id, node])))

const edgePaths = computed(() =>
    layout.value.edges.map((edge) => {
      const from = nodeById.value.get(edge.fromId)
      const to = nodeById.value.get(edge.toId)
      if (!from || !to) return {id: edge.id, d: '', label: edge.label, lx: 0, ly: 0}
      const x1 = from.x + from.width
      const y1 = from.y + from.height / 2
      const x2 = to.x
      const y2 = to.y + to.height / 2
      const midX = (x1 + x2) / 2
      return {
        id: edge.id,
        d: `M ${x1} ${y1} C ${midX} ${y1}, ${midX} ${y2}, ${x2} ${y2}`,
        label: edge.label,
        lx: midX,
        ly: (y1 + y2) / 2 - 10,
      }
    }),
)

const filteredPalette = computed(() => {
  const query = paletteFilter.value.trim().toLowerCase()
  if (!query) return props.availableTables
  return props.availableTables.filter((name) => name.toLowerCase().includes(query))
})

const selectedJoin = computed(() => {
  if (selectedJoinIndex.value == null) return null
  return props.joins[selectedJoinIndex.value] ?? null
})

function onPaletteDragStart(event: DragEvent, table: string) {
  event.dataTransfer?.setData('text/vqb-table', table)
  event.dataTransfer?.setData('text/plain', table)
  if (event.dataTransfer) event.dataTransfer.effectAllowed = 'copy'
}

function onCanvasDragOver(event: DragEvent) {
  event.preventDefault()
  dragOver.value = true
  if (event.dataTransfer) event.dataTransfer.dropEffect = 'copy'
}

function onCanvasDragLeave() {
  dragOver.value = false
}

function onCanvasDrop(event: DragEvent) {
  event.preventDefault()
  dragOver.value = false
  const table = (
      event.dataTransfer?.getData('text/vqb-table')
      || event.dataTransfer?.getData('text/plain')
      || ''
  ).trim()
  if (!table) return
  if (!props.fromTable) {
    emit('drop-table', table)
    return
  }
  if (!props.canAddJoin) return
  if (props.availableTables.includes(table) || table === props.fromTable) {
    // fromTable already set; only unused tables should be in palette
  }
  emit('drop-table', table)
}

function selectJoin(index: number) {
  selectedJoinIndex.value = index
  emit('select-join', index)
}

function removeSelected() {
  if (selectedJoinIndex.value == null) return
  const index = selectedJoinIndex.value
  emit('remove-join', index)
  selectedJoinIndex.value = null
}
</script>

<template>
  <div class="vqb-canvas">
    <aside class="vqb-canvas__palette">
      <header class="vqb-canvas__palette-head">
        <strong>{{ t('console.visualQuery.canvasPalette') }}</strong>
        <input
            v-model="paletteFilter"
            class="dw-input"
            type="search"
            :placeholder="t('console.visualQuery.filterTables')"
        >
      </header>
      <ul class="vqb-canvas__palette-list">
        <li v-for="table in filteredPalette" :key="table">
          <button
              type="button"
              class="vqb-canvas__palette-item"
              draggable="true"
              @dragstart="onPaletteDragStart($event, table)"
              @dblclick="emit('drop-table', table)"
          >
            <DwIcon name="table" size="xs" :stroke-width="1.5"/>
            <span>{{ table }}</span>
          </button>
        </li>
        <li v-if="!filteredPalette.length" class="vqb-canvas__palette-empty">
          {{ t('console.visualQuery.canvasPaletteEmpty') }}
        </li>
      </ul>
      <p class="vqb-canvas__hint">{{ t('console.visualQuery.canvasPaletteHint') }}</p>
    </aside>

    <div class="vqb-canvas__main">
      <div
          class="vqb-canvas__stage"
          :class="{ 'is-dragover': dragOver }"
          @dragover="onCanvasDragOver"
          @dragleave="onCanvasDragLeave"
          @drop="onCanvasDrop"
      >
        <div v-if="!fromTable" class="vqb-canvas__empty">
          {{ t('console.visualQuery.canvasEmpty') }}
        </div>
        <svg
            v-else
            class="vqb-canvas__svg"
            :viewBox="`0 0 ${layout.width} ${layout.height}`"
            :width="layout.width"
            :height="layout.height"
        >
          <defs>
            <marker id="vqb-arrow" markerWidth="8" markerHeight="8" refX="7" refY="4" orient="auto">
              <path d="M0,0 L8,4 L0,8 Z" class="vqb-canvas__arrow"/>
            </marker>
          </defs>
          <g v-for="edge in edgePaths" :key="edge.id">
            <path class="vqb-canvas__edge" :d="edge.d" marker-end="url(#vqb-arrow)"/>
            <text class="vqb-canvas__edge-label" :x="edge.lx" :y="edge.ly" text-anchor="middle">
              {{ edge.label }}
            </text>
          </g>
          <g
              v-for="node in layout.nodes"
              :key="node.id"
              class="vqb-canvas__node"
              :class="{
                'is-from': node.kind === 'from',
                'is-selected': node.kind === 'join' && node.joinIndex === selectedJoinIndex,
              }"
              :transform="`translate(${node.x}, ${node.y})`"
              @click="node.kind === 'join' && node.joinIndex != null ? selectJoin(node.joinIndex) : undefined"
          >
            <rect
                class="vqb-canvas__shell"
                :width="node.width"
                :height="node.height"
                rx="8"
                ry="8"
            />
            <text class="vqb-canvas__role" x="12" y="20">
              {{ node.kind === 'from'
                  ? t('console.visualQuery.canvasMain')
                  : t('console.visualQuery.canvasJoin', {n: (node.joinIndex ?? 0) + 1}) }}
            </text>
            <text class="vqb-canvas__table" x="12" y="42">{{ node.table }}</text>
            <text class="vqb-canvas__alias" x="12" y="60">{{ node.alias }}</text>
          </g>
        </svg>
      </div>

      <div v-if="selectedJoin" class="vqb-canvas__inspector">
        <header class="vqb-canvas__inspector-head">
          <strong>{{ t('console.visualQuery.joinCardTitle', {n: (selectedJoinIndex ?? 0) + 1}) }}</strong>
          <button type="button" class="vqb-canvas__link" @click="removeSelected">
            {{ t('console.visualQuery.removeJoin') }}
          </button>
        </header>
        <div class="vqb-canvas__inspector-form">
          <FormField :label="t('console.visualQuery.joinType')">
            <DwSelect
                :model-value="selectedJoin.type"
                size="sm"
                :options="joinTypeOptions"
                @update:model-value="emit('set-join-type', selectedJoinIndex!, $event)"
            />
          </FormField>
          <div v-if="selectedJoin.type !== 'CROSS'" class="vqb-canvas__on">
            <FormField :label="t('console.visualQuery.joinOnLeft')">
              <DwSelect
                  :model-value="selectedJoin.onLeft"
                  size="sm"
                  :options="leftOnOptions(selectedJoinIndex!)"
                  @update:model-value="emit('set-join-on-left', selectedJoinIndex!, $event)"
              />
            </FormField>
            <span class="vqb-canvas__eq" aria-hidden="true">=</span>
            <FormField :label="t('console.visualQuery.joinOnRight')">
              <DwSelect
                  :model-value="selectedJoin.onRight"
                  size="sm"
                  :options="rightOnOptions(selectedJoinIndex!)"
                  @update:model-value="emit('set-join-on-right', selectedJoinIndex!, $event)"
              />
            </FormField>
          </div>
        </div>
      </div>
      <p v-else-if="fromTable && joins.some((j) => j.table)" class="vqb-canvas__hint">
        {{ t('console.visualQuery.canvasSelectJoin') }}
      </p>
    </div>
  </div>
</template>

<style scoped>
.vqb-canvas {
  display: grid;
  grid-template-columns: minmax(160px, 200px) minmax(0, 1fr);
  gap: var(--dw-space-4);
  min-height: 280px;
}

.vqb-canvas__palette {
  display: flex;
  flex-direction: column;
  gap: var(--dw-gap-sm);
  min-width: 0;
}

.vqb-canvas__palette-head {
  display: flex;
  flex-direction: column;
  gap: var(--dw-gap-sm);
}

.vqb-canvas__palette-head strong {
  font-size: var(--dw-text-xs);
  color: var(--dw-text-secondary);
}

.vqb-canvas__palette-list {
  list-style: none;
  margin: 0;
  padding: 0;
  max-height: 260px;
  overflow: auto;
  border: 1px solid var(--dw-border-light);
  border-radius: var(--dw-control-radius);
  background: var(--dw-bg);
}

.vqb-canvas__palette-item {
  display: flex;
  align-items: center;
  gap: var(--dw-gap-sm);
  width: 100%;
  padding: var(--dw-space-2) var(--dw-space-3);
  border: none;
  border-bottom: 1px solid var(--dw-border-light);
  background: transparent;
  color: var(--dw-text);
  font-size: var(--dw-text-xs);
  font-family: var(--dw-font-mono);
  text-align: left;
  cursor: grab;
}

.vqb-canvas__palette-item:hover {
  background: var(--dw-bg-hover);
}

.vqb-canvas__palette-empty {
  padding: var(--dw-space-4);
  color: var(--dw-text-muted);
  font-size: var(--dw-text-xs);
}

.vqb-canvas__main {
  display: flex;
  flex-direction: column;
  gap: var(--dw-space-3);
  min-width: 0;
}

.vqb-canvas__stage {
  min-height: 200px;
  overflow: auto;
  border: 1px dashed var(--dw-border);
  border-radius: var(--dw-control-radius);
  background: var(--dw-bg-muted);
}

.vqb-canvas__stage.is-dragover {
  border-color: var(--dw-primary);
  background: color-mix(in srgb, var(--dw-primary) 8%, var(--dw-bg-muted));
}

.vqb-canvas__empty {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 200px;
  padding: var(--dw-space-6);
  color: var(--dw-text-muted);
  font-size: var(--dw-text-sm);
  text-align: center;
}

.vqb-canvas__svg {
  display: block;
  min-width: 100%;
}

.vqb-canvas__edge {
  fill: none;
  stroke: var(--dw-border);
  stroke-width: 1.5;
}

.vqb-canvas__arrow {
  fill: var(--dw-border);
}

.vqb-canvas__edge-label {
  fill: var(--dw-text-muted);
  font-size: 10px;
  font-weight: 600;
}

.vqb-canvas__shell {
  fill: var(--dw-bg-panel);
  stroke: var(--dw-border);
  stroke-width: 1.25;
}

.vqb-canvas__node.is-from .vqb-canvas__shell {
  fill: color-mix(in srgb, var(--dw-primary) 12%, var(--dw-bg-panel));
  stroke: color-mix(in srgb, var(--dw-primary) 45%, var(--dw-border));
}

.vqb-canvas__node.is-selected .vqb-canvas__shell {
  stroke: var(--dw-primary);
  stroke-width: 2;
}

.vqb-canvas__node {
  cursor: pointer;
}

.vqb-canvas__role {
  fill: var(--dw-text-muted);
  font-size: 10px;
  font-weight: 600;
}

.vqb-canvas__table {
  fill: var(--dw-text);
  font-size: 12px;
  font-weight: 700;
}

.vqb-canvas__alias {
  fill: var(--dw-text-secondary);
  font-size: 11px;
}

.vqb-canvas__inspector {
  padding: var(--dw-pad-control-lg);
  border: 1px solid var(--dw-border-light);
  border-radius: var(--dw-control-radius);
  background: var(--dw-bg);
}

.vqb-canvas__inspector-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--dw-gap);
  margin-bottom: var(--dw-space-3);
}

.vqb-canvas__inspector-form {
  display: grid;
  gap: var(--dw-space-3);
}

.vqb-canvas__on {
  display: grid;
  grid-template-columns: 1fr auto 1fr;
  gap: var(--dw-space-3);
  align-items: end;
}

.vqb-canvas__eq {
  padding-bottom: var(--dw-space-3);
  color: var(--dw-text-muted);
  font-weight: 700;
}

.vqb-canvas__link {
  border: none;
  background: transparent;
  color: var(--dw-primary);
  font-size: var(--dw-text-xs);
  font-weight: 600;
  cursor: pointer;
  padding: 0;
}

.vqb-canvas__hint {
  margin: 0;
  font-size: var(--dw-text-xs);
  color: var(--dw-text-muted);
}

@media (max-width: 860px) {
  .vqb-canvas {
    grid-template-columns: 1fr;
  }

  .vqb-canvas__on {
    grid-template-columns: 1fr;
  }
}
</style>
