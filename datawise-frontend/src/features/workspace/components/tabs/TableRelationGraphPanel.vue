<script setup lang="ts">
import {computed, onUnmounted, ref, watch} from 'vue'
import {useI18n} from 'vue-i18n'
import {DwPanelState} from '@/core/components'
import {DwIcon} from '@/core/icons'
import type {WorkspaceTab} from '@/core/types'
import {useTableRelations} from '@/features/workspace/composables/useTableRelations'
import {useRelationGraphColumns} from '@/features/workspace/composables/useRelationGraphColumns'
import {openRelatedTableByName} from '@/features/workspace/services/table-relations.actions'
import {
  buildTableRelationGraph,
  hasRelationGraphNeighborhood,
  layoutInitialRelationGraphPositions,
  relationGraphEdgeAnchors,
  relationGraphEdgePath,
  relationGraphHiddenColumnCount,
  relationGraphNodeHeight,
  relationGraphVisibleRowCount,
  RELATION_GRAPH_HEADER_HEIGHT,
  RELATION_GRAPH_MAX_ROWS,
  RELATION_GRAPH_NODE_WIDTH,
  RELATION_GRAPH_ROW_HEIGHT,
  type RelationGraphPoint,
  type TableRelationGraphColumn,
  type TableRelationGraphNode,
} from '@/features/workspace/services/table-relation-graph.service'

const props = defineProps<{ tab: WorkspaceTab }>()
const {t} = useI18n()

const CANVAS_WIDTH = 980
const CANVAS_HEIGHT = 680

const {relations, loading, error, databaseName} = useTableRelations(props.tab, {
  shouldLoad: () => true,
})

const baseGraph = computed(() => buildTableRelationGraph(relations.value))
const {enrichedGraph, loadingColumns} = useRelationGraphColumns(
    props.tab,
    baseGraph,
    relations,
    databaseName,
)

const hasNeighborhood = computed(() => hasRelationGraphNeighborhood(enrichedGraph.value))

const positions = ref<Record<string, RelationGraphPoint>>({})

watch(
    enrichedGraph,
    (nextGraph) => {
      positions.value = layoutInitialRelationGraphPositions(nextGraph, CANVAS_WIDTH, CANVAS_HEIGHT)
    },
    {immediate: true},
)

type DragSession = {
  node: TableRelationGraphNode
  pointerStartX: number
  pointerStartY: number
  origin: RelationGraphPoint
  moved: boolean
}

const dragging = ref<DragSession | null>(null)

const nodeById = computed(() => {
  const map = new Map<string, TableRelationGraphNode>()
  for (const node of enrichedGraph.value.nodes) {
    map.set(node.id, node)
  }
  return map
})

function visibleColumns(node: TableRelationGraphNode): TableRelationGraphColumn[] {
  if (!node.columns.length) {
    return [{name: '—', dataType: '', keyType: null, highlighted: false}]
  }
  return node.columns.slice(0, RELATION_GRAPH_MAX_ROWS)
}

function resolveSvgScale(svg: SVGSVGElement) {
  const rect = svg.getBoundingClientRect()
  return {
    scaleX: CANVAS_WIDTH / rect.width,
    scaleY: CANVAS_HEIGHT / rect.height,
  }
}

function resetLayout() {
  positions.value = layoutInitialRelationGraphPositions(enrichedGraph.value, CANVAS_WIDTH, CANVAS_HEIGHT)
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
        path: relationGraphEdgePath(dots.start, dots.end),
        dots,
      }
    }),
)

function onNodePointerDown(event: PointerEvent, node: TableRelationGraphNode) {
  if (node.role === 'center') return
  const current = positions.value[node.id]
  if (!current) return
  dragging.value = {
    node,
    pointerStartX: event.clientX,
    pointerStartY: event.clientY,
    origin: {...current},
    moved: false,
  }
  window.addEventListener('pointermove', onWindowPointerMove)
  window.addEventListener('pointerup', onWindowPointerUp)
  window.addEventListener('pointercancel', onWindowPointerUp)
  event.preventDefault()
}

function onWindowPointerMove(event: PointerEvent) {
  const session = dragging.value
  if (!session) return
  const svg = document.querySelector('.relation-graph__canvas') as SVGSVGElement | null
  if (!svg) return
  const {scaleX, scaleY} = resolveSvgScale(svg)
  const dx = (event.clientX - session.pointerStartX) * scaleX
  const dy = (event.clientY - session.pointerStartY) * scaleY
  if (Math.hypot(dx, dy) > 4) {
    session.moved = true
  }
  positions.value = {
    ...positions.value,
    [session.node.id]: {
      x: session.origin.x + dx,
      y: session.origin.y + dy,
    },
  }
}

function onWindowPointerUp() {
  const session = dragging.value
  window.removeEventListener('pointermove', onWindowPointerMove)
  window.removeEventListener('pointerup', onWindowPointerUp)
  window.removeEventListener('pointercancel', onWindowPointerUp)
  if (session && !session.moved) {
    void openNode(session.node)
  }
  dragging.value = null
}

onUnmounted(() => {
  onWindowPointerUp()
})

async function openNode(node: TableRelationGraphNode) {
  if (node.role === 'center') return
  await openRelatedTableByName(
      props.tab,
      node.tableName,
      databaseName.value,
      'relationGraph',
  )
}
</script>

<template>
  <div class="relation-graph">
    <header class="relation-graph__toolbar">
      <p class="relation-graph__hint">{{ t('workspace.tableDetail.relationGraphHint') }}</p>
      <button
          type="button"
          class="dw-text-btn"
          :disabled="!hasNeighborhood"
          @click="resetLayout"
      >
        <DwIcon name="refresh" size="sm" :stroke-width="1.5"/>
        {{ t('workspace.tableDetail.relationGraphReset') }}
      </button>
    </header>

    <DwPanelState
        v-if="loading || loadingColumns"
        status="loading"
        :message="t('workspace.tableDetail.loading')"
        fill
    />
    <DwPanelState
        v-else-if="error"
        status="error"
        :message="error"
        fill
    />
    <DwPanelState
        v-else-if="!hasNeighborhood"
        status="empty"
        :message="t('workspace.tableDetail.relationGraphEmpty')"
        compact
        fill
    />
    <div v-else class="relation-graph__canvas-wrap">
      <svg
          class="relation-graph__canvas"
          :viewBox="`0 0 ${CANVAS_WIDTH} ${CANVAS_HEIGHT}`"
          role="img"
          :aria-label="t('workspace.tableDetail.relationGraphAria', {name: enrichedGraph.centerTableName})"
      >
        <defs>
          <pattern
              id="relation-graph-grid"
              width="24"
              height="24"
              patternUnits="userSpaceOnUse"
          >
            <path
                d="M 24 0 L 0 0 0 24"
                fill="none"
                class="relation-graph__grid-line"
            />
          </pattern>
          <marker
              id="relation-graph-arrow-out"
              markerWidth="9"
              markerHeight="9"
              refX="8"
              refY="4.5"
              orient="auto"
          >
            <path d="M0,0 L9,4.5 L0,9 Z" class="relation-graph__arrow-out"/>
          </marker>
          <marker
              id="relation-graph-arrow-in"
              markerWidth="9"
              markerHeight="9"
              refX="8"
              refY="4.5"
              orient="auto"
          >
            <path d="M0,0 L9,4.5 L0,9 Z" class="relation-graph__arrow-in"/>
          </marker>
        </defs>

        <rect
            class="relation-graph__grid-bg"
            x="0"
            y="0"
            :width="CANVAS_WIDTH"
            :height="CANVAS_HEIGHT"
            fill="url(#relation-graph-grid)"
        />

        <g class="relation-graph__edges">
          <template v-for="entry in renderedEdges" :key="entry.edge.id">
            <path
                v-if="entry.path"
                class="relation-graph__edge"
                :class="`relation-graph__edge--${entry.edge.direction}`"
                :d="entry.path"
                :marker-end="entry.edge.direction === 'outgoing' ? 'url(#relation-graph-arrow-out)' : 'url(#relation-graph-arrow-in)'"
            >
              <title>{{ entry.edge.constraintName }} · {{ entry.edge.label }}</title>
            </path>
            <circle
                v-if="entry.dots"
                class="relation-graph__anchor relation-graph__anchor--start"
                :class="`relation-graph__anchor--${entry.edge.direction}`"
                :cx="entry.dots.start.x"
                :cy="entry.dots.start.y"
                r="3.5"
            />
            <circle
                v-if="entry.dots"
                class="relation-graph__anchor relation-graph__anchor--end"
                :class="`relation-graph__anchor--${entry.edge.direction}`"
                :cx="entry.dots.end.x"
                :cy="entry.dots.end.y"
                r="3.5"
            />
          </template>
        </g>

        <g
            v-for="node in enrichedGraph.nodes"
            :key="node.id"
            class="relation-graph__node"
            :class="[
              `relation-graph__node--${node.role}`,
              { 'is-dragging': dragging?.node.id === node.id },
            ]"
            :transform="`translate(${positions[node.id]?.x ?? 0}, ${positions[node.id]?.y ?? 0})`"
            @pointerdown="onNodePointerDown($event, node)"
        >
          <rect
              class="relation-graph__node-shell"
              :width="RELATION_GRAPH_NODE_WIDTH"
              :height="relationGraphNodeHeight(node)"
              rx="10"
              ry="10"
          />
          <rect
              class="relation-graph__node-header"
              :width="RELATION_GRAPH_NODE_WIDTH"
              :height="RELATION_GRAPH_HEADER_HEIGHT"
              rx="10"
              ry="10"
          />
          <rect
              class="relation-graph__node-header-fill"
              :x="1"
              :y="RELATION_GRAPH_HEADER_HEIGHT - 10"
              :width="RELATION_GRAPH_NODE_WIDTH - 2"
              height="10"
          />
          <text
              class="relation-graph__node-title"
              :x="RELATION_GRAPH_NODE_WIDTH / 2"
              :y="20"
              text-anchor="middle"
          >
            {{ node.tableName }}
          </text>

          <g
              v-for="(column, rowIndex) in visibleColumns(node)"
              :key="`${node.id}-${column.name}-${rowIndex}`"
              class="relation-graph__row"
              :class="{
                'is-highlight': column.highlighted,
                'is-pk': column.keyType === 'PRI',
                'is-fk': column.highlighted && column.keyType !== 'PRI',
              }"
          >
            <rect
                :x="6"
                :y="RELATION_GRAPH_HEADER_HEIGHT + rowIndex * RELATION_GRAPH_ROW_HEIGHT + 1"
                :width="RELATION_GRAPH_NODE_WIDTH - 12"
                :height="RELATION_GRAPH_ROW_HEIGHT - 2"
                rx="4"
                class="relation-graph__row-bg"
            />
            <text
                class="relation-graph__col-name"
                :x="12"
                :y="RELATION_GRAPH_HEADER_HEIGHT + rowIndex * RELATION_GRAPH_ROW_HEIGHT + 14"
            >
              {{ column.name }}
            </text>
            <text
                v-if="column.keyType"
                class="relation-graph__col-key"
                :x="RELATION_GRAPH_NODE_WIDTH - 12"
                :y="RELATION_GRAPH_HEADER_HEIGHT + rowIndex * RELATION_GRAPH_ROW_HEIGHT + 14"
                text-anchor="end"
            >
              {{ column.keyType }}
            </text>
            <text
                v-else-if="column.dataType"
                class="relation-graph__col-type"
                :x="RELATION_GRAPH_NODE_WIDTH - 12"
                :y="RELATION_GRAPH_HEADER_HEIGHT + rowIndex * RELATION_GRAPH_ROW_HEIGHT + 14"
                text-anchor="end"
            >
              {{ column.dataType }}
            </text>
          </g>

          <text
              v-if="relationGraphHiddenColumnCount(node) > 0"
              class="relation-graph__more"
              :x="RELATION_GRAPH_NODE_WIDTH / 2"
              :y="RELATION_GRAPH_HEADER_HEIGHT + relationGraphVisibleRowCount(node.columns.length) * RELATION_GRAPH_ROW_HEIGHT + 2"
              text-anchor="middle"
          >
            {{ t('workspace.tableDetail.relationGraphMoreColumns', {count: relationGraphHiddenColumnCount(node)}) }}
          </text>

          <title>{{ node.qualifiedName }}</title>
        </g>
      </svg>
    </div>
  </div>
</template>

<style scoped>
.relation-graph {
  --rg-canvas-bg: color-mix(in srgb, var(--dw-bg-editor) 94%, var(--dw-border-light) 6%);
  --rg-grid-stroke: color-mix(in srgb, var(--dw-border) 70%, var(--dw-text-muted) 30%);
  --rg-node-fill: var(--dw-bg);
  --rg-node-stroke: color-mix(in srgb, var(--dw-border) 75%, var(--dw-text-secondary) 25%);
  --rg-header-fill: color-mix(in srgb, var(--dw-bg-muted) 45%, var(--dw-on-accent) 55%);
  --rg-center-header: color-mix(in srgb, var(--dw-info) 12%, var(--dw-on-accent) 88%);
  --rg-text: var(--dw-text);
  --rg-text-type: var(--dw-text-secondary);
  --rg-text-more: var(--dw-text-secondary);
  --rg-row-alt: color-mix(in srgb, var(--dw-bg-muted) 28%, transparent);
  --rg-fk-bg: color-mix(in srgb, var(--dw-info) 14%, transparent);
  --rg-pk-bg: color-mix(in srgb, var(--dw-warning) 12%, transparent);
  --rg-key: var(--dw-warning-fg);

  display: flex;
  flex-direction: column;
  flex: 1;
  min-height: 0;
  gap: var(--dw-gap);
  padding: var(--dw-space-6);
}

[data-theme='dark'] .relation-graph {
  --rg-canvas-bg: var(--dw-bg-rail);
  --rg-grid-stroke: rgb(255 255 255 / 10%);
  --rg-node-fill: var(--dw-bg-hover);
  --rg-node-stroke: var(--dw-text-secondary);
  --rg-header-fill: var(--dw-graph-node-dark);
  --rg-center-header: color-mix(in srgb, var(--dw-info) 22%, var(--dw-graph-node-dark) 78%);
  --rg-text: var(--dw-border-light);
  --rg-text-type: var(--dw-text-muted);
  --rg-text-more: var(--dw-text-muted);
  --rg-row-alt: rgb(255 255 255 / 4%);
  --rg-fk-bg: rgb(56 189 248 / 18%);
  --rg-pk-bg: rgb(251 191 36 / 14%);
  --rg-key: var(--dw-warning);
}

.relation-graph__toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--dw-space-6);
}

.relation-graph__hint {
  margin: 0;
  color: var(--dw-text-muted);
  font-size: var(--dw-text-xs);
}

.relation-graph__canvas-wrap {
  flex: 1;
  min-height: 360px;
  border: 1px solid var(--dw-border-light);
  border-radius: var(--dw-radius-xl);
  background: var(--rg-canvas-bg);
  overflow: auto;
}

.relation-graph__canvas {
  display: block;
  width: 100%;
  min-height: 420px;
  touch-action: none;
  user-select: none;
  text-rendering: geometricPrecision;
  shape-rendering: geometricPrecision;
}

.relation-graph__grid-bg {
  fill: url(#relation-graph-grid);
}

.relation-graph__grid-line {
  stroke: var(--rg-grid-stroke);
  stroke-width: 1;
}

.relation-graph__edge {
  fill: none;
  stroke-width: 2;
  opacity: 0.92;
}

[data-theme='dark'] .relation-graph__edge--outgoing {
  stroke: var(--dw-info);
}

[data-theme='dark'] .relation-graph__edge--incoming {
  stroke: var(--dw-success);
}

[data-theme='dark'] .relation-graph__arrow-out {
  fill: var(--dw-info);
}

[data-theme='dark'] .relation-graph__arrow-in {
  fill: var(--dw-success);
}

[data-theme='dark'] .relation-graph__anchor--outgoing {
  fill: var(--dw-info);
}

[data-theme='dark'] .relation-graph__anchor--incoming {
  fill: var(--dw-success);
}

.relation-graph__edge--outgoing {
  stroke: var(--dw-info);
}

.relation-graph__edge--incoming {
  stroke: var(--dw-success);
}

.relation-graph__arrow-out {
  fill: var(--dw-info);
}

.relation-graph__arrow-in {
  fill: var(--dw-success);
}

.relation-graph__anchor {
  stroke: var(--rg-node-fill);
  stroke-width: 1.5;
}

.relation-graph__anchor--outgoing {
  fill: var(--dw-info);
}

.relation-graph__anchor--incoming {
  fill: var(--dw-success);
}

.relation-graph__node {
  cursor: grab;
}

.relation-graph__node--center {
  cursor: default;
}

.relation-graph__node.is-dragging {
  cursor: grabbing;
}

.relation-graph__node-shell {
  fill: var(--rg-node-fill);
  stroke: var(--rg-node-stroke);
  stroke-width: 1.5;
}

.relation-graph__node-header {
  fill: var(--rg-header-fill);
  stroke: none;
}

.relation-graph__node-header-fill {
  fill: var(--rg-header-fill);
}

.relation-graph__node--center .relation-graph__node-header,
.relation-graph__node--center .relation-graph__node-header-fill {
  fill: var(--rg-center-header);
}

.relation-graph__node--center .relation-graph__node-shell {
  stroke: var(--dw-info);
  stroke-width: 2;
}

.relation-graph__node--reference .relation-graph__node-shell {
  stroke: color-mix(in srgb, var(--dw-info) 75%, var(--rg-node-stroke));
}

.relation-graph__node--referrer .relation-graph__node-shell {
  stroke: color-mix(in srgb, var(--dw-success) 75%, var(--rg-node-stroke));
}

.relation-graph__node-title {
  fill: var(--rg-text);
  font-size: var(--dw-text-md);
  font-weight: 700;
  pointer-events: none;
}

.relation-graph__row:nth-child(even) .relation-graph__row-bg {
  fill: var(--rg-row-alt);
}

.relation-graph__row-bg {
  fill: transparent;
}

.relation-graph__row.is-fk .relation-graph__row-bg {
  fill: var(--rg-fk-bg);
}

.relation-graph__row.is-pk .relation-graph__row-bg {
  fill: var(--rg-pk-bg);
}

.relation-graph__col-name {
  fill: var(--rg-text);
  font-family: var(--dw-mono);
  font-size: var(--dw-text-sm);
  font-weight: 600;
  pointer-events: none;
}

.relation-graph__row.is-highlight .relation-graph__col-name {
  font-weight: 700;
}

[data-theme='dark'] .relation-graph__col-name {
  paint-order: stroke fill;
  stroke: rgb(0 0 0 / 28%);
  stroke-width: 0.35px;
}

.relation-graph__col-type {
  fill: var(--rg-text-type);
  font-family: var(--dw-mono);
  font-size: var(--dw-text-xs);
  font-weight: 500;
  pointer-events: none;
}

.relation-graph__col-key {
  fill: var(--rg-key);
  font-family: var(--dw-mono);
  font-size: var(--dw-text-xs);
  font-weight: 800;
  pointer-events: none;
}

.relation-graph__more {
  fill: var(--rg-text-more);
  font-size: var(--dw-text-xs);
  pointer-events: none;
}

.relation-graph__node:not(.relation-graph__node--center):hover .relation-graph__node-shell {
  filter: drop-shadow(0 3px 8px rgb(0 0 0 / 10%));
}

</style>
