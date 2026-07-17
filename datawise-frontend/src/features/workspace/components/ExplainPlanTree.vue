<script setup lang="ts">
import {computed, ref} from 'vue'
import {useI18n} from 'vue-i18n'
import {DwIcon} from '@/core/icons'
import ExplainPlanNode from '@/features/workspace/components/ExplainPlanNode.vue'
import ExplainPlanTable from '@/features/workspace/components/ExplainPlanTable.vue'
import ExplainPlanGraph from '@/features/workspace/components/ExplainPlanGraph.vue'
import type {DbType} from '@/core/types'
import type {ExplainPlanMode, ExplainPlanNode as ExplainPlanNodeType} from '@/features/workspace/types/explain-plan'
import {buildExplainIndexHints} from '@/features/workspace/services/explain-index-hints.service'
import {collectExplainPlanRisks} from '@/features/workspace/services/explain-plan-risk.service'
import {
  buildTabularExplainPlan,
  isTabularExplainPlan,
  stripExplainPrefix,
} from '@/features/workspace/services/explain-plan-tabular.service'

const emit = defineEmits<{
  'open-index-draft': [payload?: {table?: string}]
  'request-ai-explain': []
  'request-ai-index-suggest': []
}>()

const props = withDefaults(defineProps<{
  nodes: ExplainPlanNodeType[]
  sql?: string
  dbType?: DbType
  explainMode?: ExplainPlanMode
  aiExplainLoading?: boolean
  enableAiExplain?: boolean
  /** 始终允许启发式「打开索引草稿」（不依赖 AI 插件） */
  enableIndexDraft?: boolean
  /** AI 增强索引建议（插件 p-ai-index-suggest） */
  enableAiIndexSuggest?: boolean
  aiIndexSuggestLoading?: boolean
}>(), {
  aiExplainLoading: false,
  enableAiExplain: false,
  enableIndexDraft: true,
  enableAiIndexSuggest: false,
  aiIndexSuggestLoading: false,
})

const {t} = useI18n()
const collapsed = ref<Record<string, boolean>>({})
const viewMode = ref<'steps' | 'graph'>('steps')

const indexHints = computed(() => buildExplainIndexHints(props.nodes, props.dbType))
const nodeRisks = computed(() => collectExplainPlanRisks(props.nodes))
const displaySql = computed(() => stripExplainPrefix(props.sql))
const showTabularPlan = computed(() => isTabularExplainPlan(props.nodes, props.dbType))
const tabularPlan = computed(() => buildTabularExplainPlan(props.nodes))
const canShowGraph = computed(() => props.nodes.length > 0 && !showTabularPlan.value)

const canOpenIndexDraft = computed(() =>
    props.enableIndexDraft
    && indexHints.value.length > 0
    && Boolean(props.sql?.trim()),
)

function toggleNode(id: string) {
  collapsed.value[id] = !collapsed.value[id]
}

function openDraftForHint(table?: string) {
  emit('open-index-draft', table ? {table} : undefined)
}
</script>

<template>
  <div class="explain-plan">
    <header class="explain-plan__head">
      <div class="explain-plan__title-row">
        <div class="explain-plan__title-group">
          <span class="explain-plan__title">{{ t('queryResult.explainPlanTitle') }}</span>
          <span v-if="explainMode" class="explain-plan__mode">
            {{ explainMode === 'analyze'
                ? t('queryResult.explainPlanModeAnalyze')
                : t('queryResult.explainPlanModeEstimate') }}
          </span>
        </div>
        <div class="explain-plan__actions">
          <div
              v-if="canShowGraph"
              class="dw-segment"
              role="tablist"
              :aria-label="t('queryResult.explainPlanView')"
          >
            <button
                type="button"
                class="dw-segment__btn"
                :class="{ 'is-active': viewMode === 'steps' }"
                role="tab"
                :aria-selected="viewMode === 'steps'"
                @click="viewMode = 'steps'"
            >
              {{ t('queryResult.explainPlanViewSteps') }}
            </button>
            <button
                type="button"
                class="dw-segment__btn"
                :class="{ 'is-active': viewMode === 'graph' }"
                role="tab"
                :aria-selected="viewMode === 'graph'"
                @click="viewMode = 'graph'"
            >
              {{ t('queryResult.explainPlanViewGraph') }}
            </button>
          </div>
          <button
              v-if="enableAiExplain"
              type="button"
              class="dw-text-btn dw-text-btn--accent"
              :disabled="aiExplainLoading"
              @click="emit('request-ai-explain')"
          >
            <DwIcon name="ai" size="xs" :stroke-width="1.5"/>
            <span>{{ aiExplainLoading ? t('queryResult.aiExplainLoading') : t('queryResult.aiExplain') }}</span>
          </button>
          <button
              v-if="canOpenIndexDraft"
              type="button"
              class="dw-text-btn"
              @click="emit('open-index-draft')"
          >
            {{ t('queryResult.indexDraftAction') }}
          </button>
          <button
              v-if="enableAiIndexSuggest && canOpenIndexDraft"
              type="button"
              class="dw-text-btn dw-text-btn--accent"
              :disabled="aiIndexSuggestLoading"
              @click="emit('request-ai-index-suggest')"
          >
            <DwIcon name="ai" size="xs" :stroke-width="1.5"/>
            <span>{{ aiIndexSuggestLoading ? t('queryResult.indexSuggestLoading') : t('queryResult.indexSuggestAction') }}</span>
          </button>
        </div>
      </div>
    </header>

    <details v-if="displaySql" class="explain-plan__sql-panel">
      <summary class="explain-plan__sql-summary">
        <DwIcon class="explain-plan__sql-chevron" name="chevron-down" size="xs" :stroke-width="1.5"/>
        <span>{{ t('queryResult.failedSql') }}</span>
      </summary>
      <pre class="explain-plan__sql">{{ displaySql }}</pre>
    </details>

    <details v-if="indexHints.length" class="explain-plan__hints-panel" open>
      <summary class="explain-plan__hints-summary">
        <DwIcon class="explain-plan__hints-chevron" name="chevron-down" size="xs" :stroke-width="1.5"/>
        <span>{{ t('queryResult.explainPlanHints', {count: indexHints.length}) }}</span>
      </summary>
      <ul class="explain-plan__hints">
        <li
            v-for="hint in indexHints"
            :key="hint.id"
            :class="`explain-plan__hint explain-plan__hint--${hint.severity}`"
        >
          <div class="explain-plan__hint-body">
            <strong>{{ hint.message }}</strong>
            <span v-if="hint.suggestion">{{ hint.suggestion }}</span>
          </div>
          <button
              v-if="canOpenIndexDraft"
              type="button"
              class="explain-plan__hint-action"
              @click="openDraftForHint(hint.table)"
          >
            {{ t('queryResult.indexDraftHintAction') }}
          </button>
        </li>
      </ul>
    </details>

    <details v-if="nodes.length" class="explain-plan__steps-panel" open>
      <summary class="explain-plan__steps-summary">
        <DwIcon class="explain-plan__steps-chevron" name="chevron-down" size="xs" :stroke-width="1.5"/>
        <span>{{ t('queryResult.explainPlanStepsPanel', {count: nodes.length}) }}</span>
      </summary>
      <div class="explain-plan__steps-content">
        <ExplainPlanTable
            v-if="showTabularPlan"
            :columns="tabularPlan.columns"
            :rows="tabularPlan.rows"
        />

        <ExplainPlanGraph
            v-else-if="viewMode === 'graph'"
            :nodes="nodes"
        />

        <ul v-else class="explain-plan__tree">
          <ExplainPlanNode
              v-for="node in nodes"
              :key="node.id"
              :node="node"
              :depth="0"
              :collapsed="collapsed"
              :risks="nodeRisks"
              @toggle="toggleNode"
          />
        </ul>
      </div>
    </details>
  </div>
</template>

<style scoped>
.explain-plan {
  flex: 1;
  min-height: 0;
  overflow: auto;
  padding: var(--dw-space-7) var(--dw-space-8) var(--dw-space-8);
  display: block;
}

.explain-plan__head {
  margin-bottom: var(--dw-space-5);
}

.explain-plan__title-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--dw-space-6);
}

.explain-plan__title-group {
  display: inline-flex;
  align-items: center;
  gap: var(--dw-gap);
  min-width: 0;
}

.explain-plan__title {
  font-size: var(--dw-text-md);
  font-weight: 700;
  color: var(--dw-text);
}

.explain-plan__mode {
  padding: var(--dw-space-1) var(--dw-space-3);
  border-radius: var(--dw-radius-pill);
  background: color-mix(in srgb, var(--dw-text) 6%, transparent);
  color: var(--dw-text-muted);
  font-size: var(--dw-text-xs);
  font-weight: 600;
  letter-spacing: 0.02em;
}










.explain-plan__sql-panel,
.explain-plan__hints-panel,
.explain-plan__steps-panel {
  margin-bottom: var(--dw-space-5);
  border: 1px solid var(--dw-border-light);
  border-radius: var(--dw-control-radius);
  background: color-mix(in srgb, var(--dw-bg-panel) 90%, var(--dw-bg));
}

.explain-plan__sql-summary,
.explain-plan__hints-summary,
.explain-plan__steps-summary {
  display: flex;
  align-items: center;
  gap: var(--dw-gap-sm);
  padding: var(--dw-space-4) var(--dw-space-6);
  color: var(--dw-text-secondary);
  font-size: var(--dw-text-xs);
  font-weight: 600;
  letter-spacing: 0.03em;
  text-transform: uppercase;
  cursor: pointer;
  list-style: none;
  user-select: none;
}

.explain-plan__sql-summary::-webkit-details-marker,
.explain-plan__hints-summary::-webkit-details-marker,
.explain-plan__steps-summary::-webkit-details-marker {
  display: none;
}

.explain-plan__sql-chevron,
.explain-plan__hints-chevron,
.explain-plan__steps-chevron {
  color: var(--dw-text-muted);
  transition: transform var(--dw-duration) var(--dw-ease);
}

.explain-plan__sql-panel[open] .explain-plan__sql-chevron,
.explain-plan__hints-panel[open] .explain-plan__hints-chevron,
.explain-plan__steps-panel[open] .explain-plan__steps-chevron {
  transform: rotate(180deg);
}

.explain-plan__sql {
  margin: 0;
  padding: var(--dw-space-5) var(--dw-space-6) var(--dw-space-6);
  border-top: 1px solid var(--dw-border-light);
  font-family: var(--dw-font-mono);
  font-size: var(--dw-text-sm);
  line-height: var(--dw-leading-loose);
  white-space: pre-wrap;
  color: var(--dw-text-secondary);
}

.explain-plan__hints {
  list-style: none;
  margin: 0;
  padding: 0 var(--dw-space-6) var(--dw-space-5);
  display: flex;
  flex-direction: column;
  gap: var(--dw-gap);
}

.explain-plan__hint {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: var(--dw-gap);
  padding: var(--dw-pad-control);
  border-radius: var(--dw-control-radius);
  font-size: var(--dw-text-sm);
  line-height: var(--dw-leading);
  border: 1px solid var(--dw-border-light);
}

.explain-plan__hint-body {
  min-width: 0;
  flex: 1;
}

.explain-plan__hint-body strong {
  display: block;
  margin-bottom: var(--dw-space-1);
}

.explain-plan__hint-action {
  flex-shrink: 0;
  padding: var(--dw-space-1) var(--dw-space-3);
  border: 1px solid var(--dw-border-light);
  border-radius: var(--dw-control-radius-sm);
  background: var(--dw-bg);
  color: var(--dw-primary);
  font-size: var(--dw-text-xs);
  font-weight: 600;
  cursor: pointer;
}

.explain-plan__hint-action:hover {
  background: var(--dw-primary-soft);
}

.explain-plan__hint--warning {
  background: color-mix(in srgb, var(--dw-warning) 12%, var(--dw-bg-panel));
}

.explain-plan__hint--info {
  background: color-mix(in srgb, var(--dw-bg-panel) 90%, var(--dw-bg));
}

.explain-plan__steps-content {
  padding: 0 var(--dw-space-6) var(--dw-space-6);
}

.explain-plan__tree {
  list-style: none;
  margin: 0;
  padding: 0;
  border: 1px solid var(--dw-border-light);
  border-radius: var(--dw-control-radius);
  background: var(--dw-bg-panel);
}
</style>
