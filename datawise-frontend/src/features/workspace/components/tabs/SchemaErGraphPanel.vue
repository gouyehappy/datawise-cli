<script setup lang="ts">
import {computed, onUnmounted, ref, watch} from 'vue'
import {useI18n} from 'vue-i18n'
import {EmptyState} from '@/core/components'
import {DwIcon} from '@/core/icons'
import type {WorkspaceTab} from '@/core/types'
import {useSchemaErColumns} from '@/features/workspace/composables/useSchemaErColumns'
import {useSchemaRelations} from '@/features/workspace/composables/useSchemaRelations'
import {
  buildSchemaRelationGraph,
  hasSchemaErGraphContent,
  layoutSchemaRelationGraphPositions,
  schemaErEdgePath,
  schemaErHiddenColumnCount,
  schemaErNodeHeight,
  schemaErNodeTitle,
  schemaErVisibleColumns,
  SCHEMA_ER_NODE_WIDTH,
} from '@/features/workspace/services/schema-relation-graph.service'
import {
  relationGraphEdgeAnchors,
  RELATION_GRAPH_HEADER_HEIGHT,
  RELATION_GRAPH_ROW_HEIGHT,
  type RelationGraphPoint,
  type TableRelationGraphColumn,
  type TableRelationGraphNode,
} from '@/features/workspace/services/table-relation-graph.service'

const props = defineProps<{ tab: WorkspaceTab }>()
const {t} = useI18n()

const {schema, loading, error, databaseName} = useSchemaRelations(props.tab, {
  shouldLoad: () => true,
})

const baseGraph = computed(() => buildSchemaRelationGraph(schema.value, props.tab.tableName))
const {enrichedGraph, loadingColumns} = useSchemaErColumns(
    props.tab,
    baseGraph,
    schema,
    databaseName,
)

const hasContent = computed(() => hasSchemaErGraphContent(enrichedGraph.value))
const isLoading = computed(() => loading.value || loadingColumns.value)

const layout = computed(() => layoutSchemaRelationGraphPositions(enrichedGraph.value))
const canvasWidth = computed(() => layout.value.width)
const canvasHeight = computed(() => layout.value.height)
const positions = ref<Record<string, RelationGraphPoint>>({})
const zoom = ref(1)
const locked = ref(false)
const canvasRef = ref<SVGSVGElement | null>(null)
const canvasWrapRef = ref<HTMLDivElement | null>(null)

watch(
    layout,
    (next) => {
      positions.value = {...next.positions}
    },
    {immediate: true},
)

type DragSession = {
  node: TableRelationGraphNode
  pointerStartX: number
  pointerStartY: number
  origin: RelationGraphPoint
}

type PanSession = {
  pointerStartX: number
  pointerStartY: number
  origin: RelationGraphPoint
}

const dragging = ref<DragSession | null>(null)
const panning = ref<PanSession | null>(null)
const panOffset = ref<RelationGraphPoint>({x: 0, y: 0})

const nodeById = computed(() => {
  const map = new Map<string, TableRelationGraphNode>()
  for (const node of enrichedGraph.value.nodes) {
    map.set(node.id, node)
  }
  return map
})

function resolveSvgScale(svg: SVGSVGElement) {
  const rect = svg.getBoundingClientRect()
  return {
    scaleX: canvasWidth.value / rect.width,
    scaleY: canvasHeight.value / rect.height,
  }
}

function resetLayout() {
  positions.value = {...layout.value.positions}
  zoom.value = 1
  panOffset.value = {x: 0, y: 0}
}

function fitView() {
  const wrap = canvasWrapRef.value
  if (!wrap) return
  const fit = Math.min(wrap.clientWidth / canvasWidth.value, wrap.clientHeight / canvasHeight.value, 1)
  zoom.value = Math.max(0.25, Math.min(1, fit * 0.94))
  panOffset.value = {x: 0, y: 0}
  wrap.scrollTo({left: 0, top: 0, behavior: 'smooth'})
}

function zoomIn() {
  zoom.value = Math.min(1.8, zoom.value + 0.12)
}

function zoomOut() {
  zoom.value = Math.max(0.25, zoom.value - 0.12)
}

function onCanvasWheel(event: WheelEvent) {
  if (!hasContent.value) return
  event.preventDefault()
  zoom.value = Math.min(1.8, Math.max(0.25, zoom.value + (event.deltaY > 0 ? -0.08 : 0.08)))
}

const renderedEdges = computed(() =>
    enrichedGraph.value.edges.map((edge) => {
      const fromNode = nodeById.value.get(edge.fromNodeId)
      const toNode = nodeById.value.get(edge.toNodeId)
      const fromPos = positions.value[edge.fromNodeId]
      const toPos = positions.value[edge.toNodeId]
      if (!fromNode || !toNode || !fromPos || !toPos) {
        return {edge, path: '', dots: null}
      }
      const dots = relationGraphEdgeAnchors(edge, fromPos, fromNode, toPos, toNode)
      return {
        edge,
        path: schemaErEdgePath(dots.start, dots.end),
        dots,
      }
    }),
)

function truncateText(value: string, max: number): string {
  if (value.length <= max) return value
  return `${value.slice(0, max - 1)}…`
}

function columnTypeLabel(column: TableRelationGraphColumn): string {
  if (column.keyType === 'PRI') return 'PK'
  if (column.highlighted && column.keyType !== 'PRI') return 'FK'
  return column.dataType
}

function onCanvasPointerDown(event: PointerEvent) {
  if (event.button !== 0) return
  const target = event.target
  if (target instanceof Element) {
    if (target.closest('.schema-er-graph__node')) return
    if (target.closest('.schema-er-graph__dock')) return
  }

  panning.value = {
    pointerStartX: event.clientX,
    pointerStartY: event.clientY,
    origin: {...panOffset.value},
  }
  window.addEventListener('pointermove', onPanPointerMove)
  window.addEventListener('pointerup', onPanPointerUp)
  window.addEventListener('pointercancel', onPanPointerUp)
  event.preventDefault()
}

function onPanPointerMove(event: PointerEvent) {
  const session = panning.value
  if (!session) return
  const svg = canvasRef.value
  if (!svg) return
  const {scaleX, scaleY} = resolveSvgScale(svg)
  panOffset.value = {
    x: session.origin.x + (event.clientX - session.pointerStartX) * scaleX,
    y: session.origin.y + (event.clientY - session.pointerStartY) * scaleY,
  }
}

function onPanPointerUp() {
  window.removeEventListener('pointermove', onPanPointerMove)
  window.removeEventListener('pointerup', onPanPointerUp)
  window.removeEventListener('pointercancel', onPanPointerUp)
  panning.value = null
}

function onNodePointerDown(event: PointerEvent, node: TableRelationGraphNode) {
  event.stopPropagation()
  if (locked.value) return
  const current = positions.value[node.id]
  if (!current) return
  dragging.value = {
    node,
    pointerStartX: event.clientX,
    pointerStartY: event.clientY,
    origin: {...current},
  }
  window.addEventListener('pointermove', onWindowPointerMove)
  window.addEventListener('pointerup', onWindowPointerUp)
  window.addEventListener('pointercancel', onWindowPointerUp)
  event.preventDefault()
}

function onWindowPointerMove(event: PointerEvent) {
  const session = dragging.value
  if (!session) return
  const svg = canvasRef.value
  if (!svg) return
  const {scaleX, scaleY} = resolveSvgScale(svg)
  positions.value = {
    ...positions.value,
    [session.node.id]: {
      x: session.origin.x + (event.clientX - session.pointerStartX) * scaleX,
      y: session.origin.y + (event.clientY - session.pointerStartY) * scaleY,
    },
  }
}

function onWindowPointerUp() {
  window.removeEventListener('pointermove', onWindowPointerMove)
  window.removeEventListener('pointerup', onWindowPointerUp)
  window.removeEventListener('pointercancel', onWindowPointerUp)
  dragging.value = null
}

onUnmounted(() => {
  onWindowPointerUp()
  onPanPointerUp()
})
</script>

<template>
  <div class="schema-er-graph">
    <div v-if="isLoading" class="schema-er-graph__state">
      <span class="schema-er-graph__spinner" aria-hidden="true"/>
      {{ t('workspace.tableDetail.loading') }}
    </div>
    <div v-else-if="error" class="schema-er-graph__state schema-er-graph__state--error">
      {{ error }}
    </div>
    <div v-else-if="!hasContent" class="schema-er-graph__state">
      <EmptyState embedded compact :title="t('workspace.tableDetail.schemaErEmpty')"/>
    </div>
    <div
        v-else
        ref="canvasWrapRef"
        class="schema-er-graph__canvas-wrap"
        :class="{ 'is-panning': panning }"
        @wheel="onCanvasWheel"
        @pointerdown="onCanvasPointerDown"
    >
      <svg
          ref="canvasRef"
          class="schema-er-graph__canvas"
          :viewBox="`0 0 ${canvasWidth} ${canvasHeight}`"
          role="img"
          :aria-label="t('workspace.tableDetail.schemaErAria', {name: databaseName || enrichedGraph.centerTableName})"
      >
        <defs>
          <pattern id="schema-er-grid" width="24" height="24" patternUnits="userSpaceOnUse">
            <path d="M 24 0 L 0 0 0 24" fill="none" class="schema-er-graph__grid-line"/>
          </pattern>
          <marker id="schema-er-arrow" markerWidth="9" markerHeight="9" refX="8" refY="4.5" orient="auto">
            <path d="M0,0 L9,4.5 L0,9 Z" class="schema-er-graph__arrow"/>
          </marker>
        </defs>

        <g :transform="`translate(${panOffset.x}, ${panOffset.y}) scale(${zoom})`" style="transform-origin: 0 0;">
          <rect
              class="schema-er-graph__grid-bg"
              x="0"
              y="0"
              :width="canvasWidth"
              :height="canvasHeight"
          />

          <g class="schema-er-graph__edges">
            <template v-for="entry in renderedEdges" :key="entry.edge.id">
              <path
                  v-if="entry.path"
                  class="schema-er-graph__edge"
                  :d="entry.path"
                  marker-end="url(#schema-er-arrow)"
              >
                <title>{{ entry.edge.constraintName }} · {{ entry.edge.label }}</title>
              </path>
              <circle
                  v-if="entry.dots"
                  class="schema-er-graph__anchor schema-er-graph__anchor--start"
                  :cx="entry.dots.start.x"
                  :cy="entry.dots.start.y"
                  r="3.5"
              />
              <circle
                  v-if="entry.dots"
                  class="schema-er-graph__anchor schema-er-graph__anchor--end"
                  :cx="entry.dots.end.x"
                  :cy="entry.dots.end.y"
                  r="3.5"
              />
            </template>
          </g>

          <g
              v-for="node in enrichedGraph.nodes"
              :key="node.id"
              class="schema-er-graph__node"
              :class="[
                `schema-er-graph__node--${node.role}`,
                { 'is-dragging': dragging?.node.id === node.id, 'is-locked': locked },
              ]"
              :transform="`translate(${positions[node.id]?.x ?? 0}, ${positions[node.id]?.y ?? 0})`"
              @pointerdown="onNodePointerDown($event, node)"
          >
            <rect
                class="schema-er-graph__node-shell"
                :width="SCHEMA_ER_NODE_WIDTH"
                :height="schemaErNodeHeight(node)"
                rx="10"
                ry="10"
            />
            <rect
                class="schema-er-graph__node-header"
                :width="SCHEMA_ER_NODE_WIDTH"
                :height="RELATION_GRAPH_HEADER_HEIGHT"
                rx="10"
                ry="10"
            />
            <rect
                class="schema-er-graph__node-header-fill"
                :x="1"
                :y="RELATION_GRAPH_HEADER_HEIGHT - 10"
                :width="SCHEMA_ER_NODE_WIDTH - 2"
                height="10"
            />
            <text
                class="schema-er-graph__node-title"
                :x="SCHEMA_ER_NODE_WIDTH / 2"
                :y="20"
                text-anchor="middle"
            >
              {{ truncateText(schemaErNodeTitle(node), 28) }}
            </text>

            <g
                v-for="(column, rowIndex) in schemaErVisibleColumns(node)"
                :key="`${node.id}-${column.name}-${rowIndex}`"
                class="schema-er-graph__row"
                :class="{
                  'is-highlight': column.highlighted,
                  'is-pk': column.keyType === 'PRI',
                  'is-fk': column.highlighted && column.keyType !== 'PRI',
                }"
            >
              <rect
                  :x="6"
                  :y="RELATION_GRAPH_HEADER_HEIGHT + rowIndex * RELATION_GRAPH_ROW_HEIGHT + 1"
                  :width="SCHEMA_ER_NODE_WIDTH - 12"
                  :height="RELATION_GRAPH_ROW_HEIGHT - 2"
                  rx="4"
                  class="schema-er-graph__row-bg"
              />
              <text
                  class="schema-er-graph__col-name"
                  :x="12"
                  :y="RELATION_GRAPH_HEADER_HEIGHT + rowIndex * RELATION_GRAPH_ROW_HEIGHT + 14"
              >
                {{ truncateText(column.name, 16) }}
              </text>
              <text
                  class="schema-er-graph__col-type"
                  :x="108"
                  :y="RELATION_GRAPH_HEADER_HEIGHT + rowIndex * RELATION_GRAPH_ROW_HEIGHT + 14"
              >
                {{ truncateText(columnTypeLabel(column), 10) }}
              </text>
              <text
                  class="schema-er-graph__col-comment"
                  :x="148"
                  :y="RELATION_GRAPH_HEADER_HEIGHT + rowIndex * RELATION_GRAPH_ROW_HEIGHT + 14"
              >
                {{ truncateText(column.comment || '—', 12) }}
              </text>
            </g>

            <text
                v-if="schemaErHiddenColumnCount(node) > 0"
                class="schema-er-graph__more"
                :x="SCHEMA_ER_NODE_WIDTH / 2"
                :y="RELATION_GRAPH_HEADER_HEIGHT + schemaErVisibleColumns(node).length * RELATION_GRAPH_ROW_HEIGHT + 2"
                text-anchor="middle"
            >
              {{ t('workspace.tableDetail.relationGraphMoreColumns', {count: schemaErHiddenColumnCount(node)}) }}
            </text>
          </g>
        </g>
      </svg>

      <div class="schema-er-graph__dock" role="toolbar" :aria-label="t('workspace.schemaEr.canvasControls')">
        <button type="button" class="schema-er-graph__dock-btn" :title="t('workspace.schemaEr.zoomIn')" @click="zoomIn">
          <DwIcon name="plus" fit :stroke-width="1.4"/>
        </button>
        <button type="button" class="schema-er-graph__dock-btn" :title="t('workspace.schemaEr.zoomOut')" @click="zoomOut">
          <DwIcon name="minus" fit :stroke-width="1.4"/>
        </button>
        <button type="button" class="schema-er-graph__dock-btn" :title="t('workspace.schemaEr.fitView')" @click="fitView">
          <DwIcon name="locate" fit :stroke-width="1.2"/>
        </button>
        <button
            type="button"
            class="schema-er-graph__dock-btn"
            :class="{ active: locked }"
            :title="locked ? t('workspace.schemaEr.unlock') : t('workspace.schemaEr.lock')"
            @click="locked = !locked"
        >
          <DwIcon v-if="locked" name="lock" fit :stroke-width="1.2"/>
          <DwIcon v-else name="unlock" fit :stroke-width="1.2"/>
        </button>
        <button type="button" class="schema-er-graph__dock-btn" :title="t('workspace.tableDetail.relationGraphReset')" @click="resetLayout">
          <DwIcon name="refresh" fit :stroke-width="1.2"/>
        </button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.schema-er-graph {
  --erg-canvas-bg: var(--dw-bg-rail);
  --erg-grid-stroke: rgb(255 255 255 / 10%);
  --erg-node-fill: var(--dw-bg-hover);
  --erg-node-stroke: var(--dw-text-secondary);
  --erg-header-fill: var(--dw-graph-node-dark);
  --erg-center-header: color-mix(in srgb, var(--dw-info) 22%, var(--dw-graph-node-dark) 78%);
  --erg-text: var(--dw-border-light);
  --erg-text-type: var(--dw-text-muted);
  --erg-text-comment: var(--dw-text-muted);
  --erg-text-more: var(--dw-text-muted);
  --erg-fk-bg: rgb(56 189 248 / 18%);
  --erg-pk-bg: rgb(251 191 36 / 14%);
  --erg-key: var(--dw-warning);

  display: flex;
  flex-direction: column;
  flex: 1;
  min-height: 0;
  background: var(--erg-canvas-bg);
}

[data-theme='light'] .schema-er-graph {
  --erg-canvas-bg: color-mix(in srgb, var(--dw-bg-editor) 94%, var(--dw-border-light) 6%);
  --erg-grid-stroke: color-mix(in srgb, var(--dw-border) 70%, var(--dw-text-muted) 30%);
  --erg-node-fill: var(--dw-bg);
  --erg-node-stroke: color-mix(in srgb, var(--dw-border) 75%, var(--dw-text-secondary) 25%);
  --erg-header-fill: color-mix(in srgb, var(--dw-bg-muted) 45%, var(--dw-on-accent) 55%);
  --erg-center-header: color-mix(in srgb, var(--dw-info) 12%, var(--dw-on-accent) 88%);
  --erg-text: var(--dw-text);
  --erg-text-type: var(--dw-text-secondary);
  --erg-text-comment: var(--dw-text-secondary);
  --erg-text-more: var(--dw-text-secondary);
  --erg-fk-bg: color-mix(in srgb, var(--dw-info) 14%, transparent);
  --erg-pk-bg: color-mix(in srgb, var(--dw-warning) 12%, transparent);
  --erg-key: var(--dw-warning-fg);
}

.schema-er-graph__canvas-wrap {
  position: relative;
  flex: 1;
  min-height: 0;
  overflow: hidden;
  cursor: grab;
}

.schema-er-graph__canvas-wrap.is-panning {
  cursor: grabbing;
}

.schema-er-graph__canvas {
  display: block;
  width: 100%;
  min-height: 100%;
  touch-action: none;
  user-select: none;
}

.schema-er-graph__grid-bg {
  fill: url(#schema-er-grid);
}

.schema-er-graph__grid-line {
  stroke: var(--erg-grid-stroke);
  stroke-width: 1;
}

.schema-er-graph__edge {
  fill: none;
  stroke: var(--dw-info);
  stroke-width: 1.6;
  opacity: 0.9;
}

.schema-er-graph__arrow {
  fill: var(--dw-info);
}

.schema-er-graph__anchor {
  fill: var(--dw-info);
  stroke: var(--erg-node-fill);
  stroke-width: 1.5;
}

.schema-er-graph__node {
  cursor: grab;
}

.schema-er-graph__node.is-locked,
.schema-er-graph__node.is-locked.is-dragging {
  cursor: default;
}

.schema-er-graph__node.is-dragging {
  cursor: grabbing;
}

.schema-er-graph__node-shell {
  fill: var(--erg-node-fill);
  stroke: var(--erg-node-stroke);
  stroke-width: 1.5;
}

.schema-er-graph__node-header {
  fill: var(--erg-header-fill);
  stroke: none;
}

.schema-er-graph__node-header-fill {
  fill: var(--erg-header-fill);
}

.schema-er-graph__node--center .schema-er-graph__node-header,
.schema-er-graph__node--center .schema-er-graph__node-header-fill {
  fill: var(--erg-center-header);
}

.schema-er-graph__node--center .schema-er-graph__node-shell {
  stroke: var(--dw-info);
  stroke-width: 2;
}

.schema-er-graph__node-title {
  fill: var(--erg-text);
  font-size: var(--dw-text-sm);
  font-weight: 700;
  pointer-events: none;
}

.schema-er-graph__row-bg {
  fill: transparent;
}

.schema-er-graph__row.is-pk .schema-er-graph__row-bg {
  fill: var(--erg-pk-bg);
}

.schema-er-graph__row.is-fk .schema-er-graph__row-bg {
  fill: var(--erg-fk-bg);
}

.schema-er-graph__col-name {
  fill: var(--erg-text);
  font-size: var(--dw-text-xs);
  pointer-events: none;
}

.schema-er-graph__col-type {
  fill: var(--erg-key);
  font-size: var(--dw-text-xs);
  pointer-events: none;
}

.schema-er-graph__col-comment {
  fill: var(--erg-text-comment);
  font-size: var(--dw-text-xs);
  pointer-events: none;
}

.schema-er-graph__more {
  fill: var(--erg-text-more);
  font-size: var(--dw-text-xs);
  pointer-events: none;
}

.schema-er-graph__dock {
  position: absolute;
  left: 16px;
  bottom: 16px;
  z-index: var(--dw-z-raised);
  display: flex;
  flex-direction: column;
  gap: var(--dw-gap-sm);
  padding: var(--dw-space-3);
  border-radius: var(--dw-radius-lg);
  background: color-mix(in srgb, var(--dw-bg-panel) 88%, transparent);
  border: 1px solid var(--dw-border-light);
  box-shadow: var(--dw-shadow);
}

.schema-er-graph__dock-btn {
  display: grid;
  place-items: center;
  width: 30px;
  height: var(--dw-control-h-sm);
  padding: 0;
  border: none;
  border-radius: var(--dw-control-radius);
  background: transparent;
  color: var(--dw-text-secondary);
  cursor: pointer;
}

.schema-er-graph__dock-btn svg {
  width: var(--dw-icon-size-md);
  height: var(--dw-icon-size-md);
}

.schema-er-graph__dock-btn:hover,
.schema-er-graph__dock-btn.active {
  background: color-mix(in srgb, var(--dw-primary) 12%, transparent);
  color: var(--dw-primary);
}

.schema-er-graph__state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: var(--dw-gap-md);
  flex: 1;
  min-height: 220px;
  color: var(--dw-text-muted);
  font-size: var(--dw-text-md);
}

.schema-er-graph__state--error {
  color: var(--dw-danger);
}

.schema-er-graph__spinner {
  width: 22px;
  height: var(--dw-control-h-xs);
  border: 2px solid color-mix(in srgb, var(--dw-primary) 20%, transparent);
  border-top-color: var(--dw-primary);
  border-radius: 50%;
  animation: schema-er-spin 0.75s linear infinite;
}

@keyframes schema-er-spin {
  to {
    transform: rotate(360deg);
  }
}
</style>
