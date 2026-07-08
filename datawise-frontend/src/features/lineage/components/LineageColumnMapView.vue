<script setup lang="ts">
import {computed, onBeforeUnmount, onMounted, ref, watch} from 'vue'
import {useI18n} from 'vue-i18n'
import type {LineageGraph} from '@/features/lineage/types/lineage.types'
import type {ColumnLineageLayoutEntity} from '@/features/lineage/services/lineage-column-map.service'
import {
    buildColumnLineageMap,
    hasColumnLineage,
    layoutColumnLineageMap,
} from '@/features/lineage/services/lineage-column-map.service'

const props = withDefaults(defineProps<{
    graph: LineageGraph | null
    compact?: boolean
}>(), {
    compact: false,
})

const ROW_HEIGHT = 32

const {t} = useI18n()
const canvasWrapRef = ref<HTMLDivElement | null>(null)
const zoom = ref(1)
const hoverId = ref<string | null>(null)

const columnMap = computed(() => buildColumnLineageMap(props.graph))
const layout = computed(() => layoutColumnLineageMap(columnMap.value))
const hasContent = computed(() => hasColumnLineage(columnMap.value))

const sourceEntities = computed(() =>
    layout.value?.entities.filter((entity) => entity.side === 'source') ?? [],
)
const outputEntity = computed(() =>
    layout.value?.entities.find((entity) => entity.side === 'output') ?? null,
)

const activeLinkIds = computed(() => {
    if (!hoverId.value || !layout.value) return new Set<string>()
    const id = hoverId.value
    return new Set(
        layout.value.links
            .filter((link) => link.sourceId === id || link.outputId === id)
            .map((link) => link.id),
    )
})

const activeFieldIds = computed(() => {
    if (!hoverId.value || !layout.value) return new Set<string>()
    const id = hoverId.value
    const related = new Set<string>([id])
    for (const link of layout.value.links) {
        if (link.sourceId === id) related.add(link.outputId)
        if (link.outputId === id) related.add(link.sourceId)
    }
    return related
})

function fitView() {
    const wrap = canvasWrapRef.value
    const current = layout.value
    if (!wrap || !current) return
    const fit = Math.min(
        wrap.clientWidth / current.width,
        wrap.clientHeight / current.height,
    )
    zoom.value = Math.max(0.35, Math.min(1.15, fit * 0.94))
}

function onFieldEnter(id: string) {
    hoverId.value = id
}

function onFieldLeave() {
    hoverId.value = null
}

function entityTitle(entity: ColumnLineageLayoutEntity): string {
    return entity.name
}

let resizeObserver: ResizeObserver | null = null

onMounted(() => {
    if (!canvasWrapRef.value) return
    resizeObserver = new ResizeObserver(() => fitView())
    resizeObserver.observe(canvasWrapRef.value)
})

onBeforeUnmount(() => {
    resizeObserver?.disconnect()
})

watch(
    () => props.graph,
    () => {
        hoverId.value = null
        requestAnimationFrame(() => fitView())
    },
    {immediate: true},
)

defineExpose({fitView})
</script>

<template>
  <div class="er-lineage" :class="{'er-lineage--compact': compact}">
    <div v-if="!hasContent" class="er-lineage__empty">
      {{ t('lineage.columnMapEmpty') }}
    </div>
    <div v-else ref="canvasWrapRef" class="er-lineage__canvas-wrap">
      <svg
          class="er-lineage__canvas"
          :viewBox="`0 0 ${layout?.width ?? 720} ${layout?.height ?? 360}`"
          preserveAspectRatio="xMidYMid meet"
          :style="{width: `${(layout?.width ?? 720) * zoom}px`, height: `${(layout?.height ?? 360) * zoom}px`}"
      >
        <defs>
          <marker id="er-arrow" markerWidth="8" markerHeight="8" refX="7" refY="4" orient="auto">
            <path d="M0,0 L8,4 L0,8 Z" class="er-lineage__arrow"/>
          </marker>
          <marker id="er-arrow-dim" markerWidth="8" markerHeight="8" refX="7" refY="4" orient="auto">
            <path d="M0,0 L8,4 L0,8 Z" class="er-lineage__arrow-dim"/>
          </marker>
          <marker id="er-arrow-warn" markerWidth="8" markerHeight="8" refX="7" refY="4" orient="auto">
            <path d="M0,0 L8,4 L0,8 Z" class="er-lineage__arrow-warn"/>
          </marker>
        </defs>

        <g v-if="layout" class="er-lineage__labels">
          <text
              :x="layout.sourceColumnX + 124"
              :y="24"
              class="er-lineage__column-label"
              text-anchor="middle"
          >
            {{ t('lineage.sourceTitle') }}
          </text>
          <text
              :x="layout.outputColumnX + 124"
              :y="24"
              class="er-lineage__column-label"
              text-anchor="middle"
          >
            {{ t('lineage.outputTitle') }}
          </text>
        </g>

        <g v-if="layout" class="er-lineage__links">
          <g
              v-for="link in layout.links"
              :key="link.id"
              class="er-lineage__link-group"
          >
            <path
                :d="link.path"
                class="er-lineage__link"
                :class="{
                    'er-lineage__link--transform': link.transform,
                    'er-lineage__link--active': activeLinkIds.has(link.id),
                    'er-lineage__link--dim': hoverId && !activeLinkIds.has(link.id),
                }"
                :marker-end="link.transform
                    ? (activeLinkIds.has(link.id) || !hoverId ? 'url(#er-arrow-warn)' : 'url(#er-arrow-dim)')
                    : (activeLinkIds.has(link.id) || !hoverId ? 'url(#er-arrow)' : 'url(#er-arrow-dim)')"
            />
            <g
                v-if="link.showExpression"
                class="er-lineage__expr-label"
                :class="{
                    'er-lineage__expr-label--active': activeLinkIds.has(link.id),
                    'er-lineage__expr-label--dim': hoverId && !activeLinkIds.has(link.id),
                }"
            >
              <rect
                  class="er-lineage__expr-bg"
                  :x="link.labelX - link.labelWidth / 2"
                  :y="link.labelY - link.labelHeight / 2"
                  :width="link.labelWidth"
                  :height="link.labelHeight"
                  rx="10"
                  ry="10"
              />
              <text
                  class="er-lineage__expr-text"
                  :x="link.labelX"
                  :y="link.labelY + 4"
                  text-anchor="middle"
              >
                {{ link.labelLines[0] }}
              </text>
              <title v-if="link.expression">{{ link.expression }}</title>
            </g>
          </g>
        </g>

        <g v-if="layout" class="er-lineage__entities">
          <g
              v-for="entity in sourceEntities"
              :key="entity.id"
              class="er-lineage__entity er-lineage__entity--source"
          >
            <rect
                class="er-lineage__entity-body"
                :x="entity.x"
                :y="entity.y"
                :width="entity.width"
                :height="entity.height"
            />
            <rect
                class="er-lineage__entity-header"
                :x="entity.x"
                :y="entity.y"
                :width="entity.width"
                :height="entity.headerHeight"
            />
            <line
                class="er-lineage__entity-header-line"
                :x1="entity.x"
                :y1="entity.y + entity.headerHeight"
                :x2="entity.x + entity.width"
                :y2="entity.y + entity.headerHeight"
            />
            <text
                :x="entity.x + entity.width / 2"
                :y="entity.y + 23"
                class="er-lineage__entity-title"
                text-anchor="middle"
            >
              {{ entityTitle(entity) }}
            </text>

            <g
                v-for="field in entity.fields"
                :key="field.id"
                class="er-lineage__field"
                :class="{
                    'er-lineage__field--active': activeFieldIds.has(field.id),
                    'er-lineage__field--dim': hoverId && !activeFieldIds.has(field.id),
                }"
                @mouseenter="onFieldEnter(field.id)"
                @mouseleave="onFieldLeave"
            >
              <rect
                  class="er-lineage__field-bg"
                  :x="entity.x + 1"
                  :y="field.y"
                  :width="entity.width - 2"
                  :height="ROW_HEIGHT"
                  :class="{'er-lineage__field-bg--alt': field.rowIndex % 2 === 1}"
              />
              <line
                  v-if="field.rowIndex < entity.fields.length - 1"
                  class="er-lineage__field-divider"
                  :x1="entity.x"
                  :y1="field.y + ROW_HEIGHT"
                  :x2="entity.x + entity.width"
                  :y2="field.y + ROW_HEIGHT"
              />
              <text
                  :x="entity.x + 12"
                  :y="field.y + 21"
                  class="er-lineage__field-label"
              >
                {{ field.label }}
              </text>
              <circle
                  class="er-lineage__port er-lineage__port--out"
                  :cx="field.portX"
                  :cy="field.portY"
                  r="3.5"
              />
            </g>
          </g>

          <g v-if="outputEntity" class="er-lineage__entity er-lineage__entity--output">
            <rect
                class="er-lineage__entity-body er-lineage__entity-body--output"
                :x="outputEntity.x"
                :y="outputEntity.y"
                :width="outputEntity.width"
                :height="outputEntity.height"
            />
            <rect
                class="er-lineage__entity-header er-lineage__entity-header--output"
                :x="outputEntity.x"
                :y="outputEntity.y"
                :width="outputEntity.width"
                :height="outputEntity.headerHeight"
            />
            <line
                class="er-lineage__entity-header-line"
                :x1="outputEntity.x"
                :y1="outputEntity.y + outputEntity.headerHeight"
                :x2="outputEntity.x + outputEntity.width"
                :y2="outputEntity.y + outputEntity.headerHeight"
            />
            <text
                :x="outputEntity.x + outputEntity.width / 2"
                :y="outputEntity.y + 23"
                class="er-lineage__entity-title"
                text-anchor="middle"
            >
              {{ outputEntity.name }}
            </text>

            <g
                v-for="field in outputEntity.fields"
                :key="field.id"
                class="er-lineage__field"
                :class="{
                    'er-lineage__field--active': activeFieldIds.has(field.id),
                    'er-lineage__field--dim': hoverId && !activeFieldIds.has(field.id),
                    'er-lineage__field--transform': field.transform,
                }"
                @mouseenter="onFieldEnter(field.id)"
                @mouseleave="onFieldLeave"
            >
              <rect
                  class="er-lineage__field-bg"
                  :x="outputEntity.x + 1"
                  :y="field.y"
                  :width="outputEntity.width - 2"
                  :height="ROW_HEIGHT"
                  :class="{'er-lineage__field-bg--alt': field.rowIndex % 2 === 1}"
              />
              <line
                  v-if="field.rowIndex < outputEntity.fields.length - 1"
                  class="er-lineage__field-divider"
                  :x1="outputEntity.x"
                  :y1="field.y + ROW_HEIGHT"
                  :x2="outputEntity.x + outputEntity.width"
                  :y2="field.y + ROW_HEIGHT"
              />
              <polygon
                  class="er-lineage__port-in"
                  :points="`${field.portX},${field.portY - 4} ${field.portX + 6},${field.portY} ${field.portX},${field.portY + 4}`"
              />
              <text
                  :x="outputEntity.x + 16"
                  :y="field.y + 21"
                  class="er-lineage__field-label"
              >
                {{ field.label }}
              </text>
            </g>
          </g>
        </g>
      </svg>

      <div class="er-lineage__legend">
        <span class="er-lineage__legend-item">
          <i class="er-lineage__legend-line"/>
          {{ t('lineage.directLineage') }}
        </span>
        <span class="er-lineage__legend-item">
          <i class="er-lineage__legend-line er-lineage__legend-line--transform"/>
          {{ t('lineage.transformLineage') }}
        </span>
      </div>
    </div>
  </div>
</template>

<style scoped>
.er-lineage {
  --er-canvas-bg: color-mix(in srgb, var(--dw-bg-editor) 94%, #e2e8f0 6%);
  --er-node-fill: #ffffff;
  --er-node-stroke: color-mix(in srgb, var(--dw-border) 75%, #64748b 25%);
  --er-header-fill: color-mix(in srgb, var(--dw-bg-muted) 45%, #fff 55%);
  --er-output-header: color-mix(in srgb, var(--dw-primary) 14%, #fff 86%);
  --er-output-stroke: color-mix(in srgb, var(--dw-primary) 45%, #64748b 55%);
  --er-text: #0f172a;
  --er-text-label: #64748b;
  --er-row-alt: color-mix(in srgb, var(--dw-bg-muted) 28%, transparent);
  --er-row-active: color-mix(in srgb, var(--dw-primary) 14%, transparent);
  --er-divider: color-mix(in srgb, var(--dw-border) 80%, #94a3b8 20%);
  --er-link: #6366f1;
  --er-link-warn: #d97706;
  --er-port: #6366f1;

  display: flex;
  flex-direction: column;
  min-height: 0;
  flex: 1;
}

[data-theme='dark'] .er-lineage {
  --er-canvas-bg: #151518;
  --er-node-fill: #26262b;
  --er-node-stroke: #5f6672;
  --er-header-fill: #303038;
  --er-output-header: color-mix(in srgb, var(--dw-primary) 24%, #303038 76%);
  --er-output-stroke: color-mix(in srgb, var(--dw-primary) 55%, #5f6672 45%);
  --er-text: #eef1f5;
  --er-text-label: #b8bec8;
  --er-row-alt: rgb(255 255 255 / 4%);
  --er-row-active: color-mix(in srgb, var(--dw-primary) 22%, transparent);
  --er-divider: rgb(255 255 255 / 10%);
  --er-link: #818cf8;
  --er-link-warn: #fbbf24;
  --er-port: #818cf8;
}

.er-lineage__empty {
  padding: 24px;
  color: var(--dw-text-muted);
  font-size: 13px;
}

.er-lineage__canvas-wrap {
  position: relative;
  flex: 1;
  min-height: 440px;
  overflow: auto;
  border: 1px solid var(--dw-border);
  border-radius: 8px;
  background: var(--er-canvas-bg);
  display: flex;
  align-items: flex-start;
  justify-content: center;
  padding: 16px;
}

.er-lineage--compact .er-lineage__canvas-wrap {
  min-height: 240px;
}

.er-lineage__canvas {
  display: block;
  flex-shrink: 0;
  font-family: var(--dw-font);
}

.er-lineage__column-label {
  font-size: 12px;
  font-weight: 700;
  fill: var(--er-text-label);
  letter-spacing: 0.04em;
}

.er-lineage__link {
  fill: none;
  stroke: var(--er-link);
  stroke-width: 1.75;
  opacity: 0.85;
}

.er-lineage__link--transform {
  stroke: var(--er-link-warn);
  stroke-dasharray: 6 4;
}

.er-lineage__link--active {
  stroke-width: 2.5;
  opacity: 1;
}

.er-lineage__link--dim {
  opacity: 0.12;
}

.er-lineage__expr-label {
  pointer-events: none;
}

.er-lineage__expr-label--dim {
  opacity: 0.2;
}

.er-lineage__expr-bg {
  fill: color-mix(in srgb, var(--er-node-fill) 94%, var(--er-link-warn) 6%);
  stroke: var(--er-link-warn);
  stroke-width: 1.25;
}

.er-lineage__expr-label--active .er-lineage__expr-bg {
  stroke-width: 1.75;
  fill: color-mix(in srgb, var(--er-node-fill) 88%, var(--er-link-warn) 12%);
}

.er-lineage__expr-text {
  font-size: 10px;
  font-weight: 700;
  fill: var(--er-link-warn);
  font-family: var(--dw-mono);
  pointer-events: none;
}

.er-lineage__arrow {
  fill: var(--er-link);
}

.er-lineage__arrow-warn {
  fill: var(--er-link-warn);
}

.er-lineage__arrow-dim {
  fill: color-mix(in srgb, var(--er-text-label) 35%, transparent);
}

.er-lineage__entity-body {
  fill: var(--er-node-fill);
  stroke: var(--er-node-stroke);
  stroke-width: 1.5;
}

.er-lineage__entity-body--output {
  stroke: var(--er-output-stroke);
  stroke-width: 2;
}

.er-lineage__entity-header {
  fill: var(--er-header-fill);
  stroke: none;
}

.er-lineage__entity-header--output {
  fill: var(--er-output-header);
}

.er-lineage__entity-header-line {
  stroke: var(--er-divider);
  stroke-width: 1;
}

.er-lineage__entity-title {
  font-size: 12px;
  font-weight: 700;
  fill: var(--er-text);
}

.er-lineage__field {
  cursor: default;
}

.er-lineage__field-bg {
  fill: transparent;
}

.er-lineage__field-bg--alt {
  fill: var(--er-row-alt);
}

.er-lineage__field--active .er-lineage__field-bg {
  fill: var(--er-row-active);
}

.er-lineage__field-divider {
  stroke: var(--er-divider);
  stroke-width: 1;
}

.er-lineage__field-label {
  font-size: 13px;
  font-weight: 500;
  fill: var(--er-text);
  font-family: var(--dw-mono);
  pointer-events: none;
}

.er-lineage__field--dim .er-lineage__field-label {
  fill: color-mix(in srgb, var(--er-text) 35%, var(--er-canvas-bg));
}

.er-lineage__field--transform .er-lineage__field-label {
  fill: var(--er-link-warn);
}

.er-lineage__port {
  fill: var(--er-port);
  stroke: var(--er-node-fill);
  stroke-width: 1.5;
  pointer-events: none;
}

.er-lineage__port-in {
  fill: var(--er-port);
  pointer-events: none;
}

.er-lineage__legend {
  position: absolute;
  right: 14px;
  bottom: 12px;
  display: flex;
  gap: 14px;
  padding: 6px 10px;
  border-radius: 6px;
  background: color-mix(in srgb, var(--er-node-fill) 92%, transparent);
  border: 1px solid var(--er-node-stroke);
  font-size: 11px;
  color: var(--er-text-label);
}

.er-lineage__legend-item {
  display: inline-flex;
  align-items: center;
  gap: 6px;
}

.er-lineage__legend-line {
  display: inline-block;
  width: 22px;
  border-top: 2px solid var(--er-link);
}

.er-lineage__legend-line--transform {
  border-top-style: dashed;
  border-top-color: var(--er-link-warn);
}
</style>
