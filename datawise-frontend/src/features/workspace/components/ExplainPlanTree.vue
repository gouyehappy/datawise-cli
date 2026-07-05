<script setup lang="ts">
import {computed, ref} from 'vue'
import {useI18n} from 'vue-i18n'
import {DwIcon} from '@/core/icons'
import ExplainPlanNode from '@/features/workspace/components/ExplainPlanNode.vue'
import ExplainPlanTable from '@/features/workspace/components/ExplainPlanTable.vue'
import type {DbType} from '@/core/types'
import type {ExplainPlanMode, ExplainPlanNode as ExplainPlanNodeType} from '@/features/workspace/types/explain-plan'
import {buildExplainIndexHints} from '@/features/workspace/services/explain-index-hints.service'
import {
  buildTabularExplainPlan,
  isTabularExplainPlan,
  stripExplainPrefix,
} from '@/features/workspace/services/explain-plan-tabular.service'

const emit = defineEmits<{
  'suggest-indexes': []
  'request-ai-explain': []
}>()

const props = withDefaults(defineProps<{
  nodes: ExplainPlanNodeType[]
  sql?: string
  dbType?: DbType
  explainMode?: ExplainPlanMode
  aiExplainLoading?: boolean
  enableAiExplain?: boolean
}>(), {
  aiExplainLoading: false,
  enableAiExplain: false,
})

const {t} = useI18n()
const collapsed = ref<Record<string, boolean>>({})

const indexHints = computed(() => buildExplainIndexHints(props.nodes, props.dbType))
const displaySql = computed(() => stripExplainPrefix(props.sql))
const showTabularPlan = computed(() => isTabularExplainPlan(props.nodes, props.dbType))
const tabularPlan = computed(() => buildTabularExplainPlan(props.nodes))

function toggleNode(id: string) {
  collapsed.value[id] = !collapsed.value[id]
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
          <button
              v-if="enableAiExplain"
              type="button"
              class="explain-plan__action explain-plan__action--ai"
              :disabled="aiExplainLoading"
              @click="emit('request-ai-explain')"
          >
            <DwIcon name="ai" size="xs" :stroke-width="1.5"/>
            <span>{{ aiExplainLoading ? t('queryResult.aiExplainLoading') : t('queryResult.aiExplain') }}</span>
          </button>
          <button
              v-if="indexHints.length"
              type="button"
              class="explain-plan__action"
              @click="emit('suggest-indexes')"
          >
            {{ t('queryResult.indexSuggestAction') }}
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

    <details v-if="indexHints.length" class="explain-plan__hints-panel">
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
          <strong>{{ hint.message }}</strong>
          <span v-if="hint.suggestion">{{ hint.suggestion }}</span>
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

        <ul v-else class="explain-plan__tree">
          <ExplainPlanNode
              v-for="node in nodes"
              :key="node.id"
              :node="node"
              :depth="0"
              :collapsed="collapsed"
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
  padding: 14px 16px 16px;
  display: block;
}

.explain-plan__head {
  margin-bottom: 10px;
}

.explain-plan__title-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.explain-plan__title-group {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
}

.explain-plan__title {
  font-size: 13px;
  font-weight: 700;
  color: var(--dw-text);
}

.explain-plan__mode {
  padding: 2px 7px;
  border-radius: 999px;
  background: color-mix(in srgb, var(--dw-text) 6%, transparent);
  color: var(--dw-text-muted);
  font-size: 10px;
  font-weight: 600;
  letter-spacing: 0.02em;
}

.explain-plan__actions {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  flex-shrink: 0;
}

.explain-plan__action {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  height: 28px;
  padding: 0 10px;
  border: 1px solid transparent;
  border-radius: 7px;
  background: transparent;
  color: var(--dw-text-secondary);
  font-size: 11px;
  font-weight: 600;
  cursor: pointer;
  transition: background 0.12s ease, border-color 0.12s ease, color 0.12s ease;
}

.explain-plan__action--ai {
  color: var(--dw-text);
}

.explain-plan__action:hover:not(:disabled) {
  color: var(--dw-text);
  background: color-mix(in srgb, var(--dw-text) 6%, transparent);
  border-color: color-mix(in srgb, var(--dw-border) 80%, transparent);
}

.explain-plan__action--ai:hover:not(:disabled) {
  color: var(--dw-primary);
  background: var(--dw-primary-softer);
  border-color: color-mix(in srgb, var(--dw-primary) 20%, var(--dw-border-light));
}

.explain-plan__action:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.explain-plan__sql-panel,
.explain-plan__hints-panel,
.explain-plan__steps-panel {
  margin-bottom: 10px;
  border: 1px solid var(--dw-border-light);
  border-radius: 8px;
  background: color-mix(in srgb, var(--dw-bg-panel) 90%, var(--dw-bg));
}

.explain-plan__sql-summary,
.explain-plan__hints-summary,
.explain-plan__steps-summary {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 8px 12px;
  color: var(--dw-text-secondary);
  font-size: 11px;
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
  transition: transform 0.15s ease;
}

.explain-plan__sql-panel[open] .explain-plan__sql-chevron,
.explain-plan__hints-panel[open] .explain-plan__hints-chevron,
.explain-plan__steps-panel[open] .explain-plan__steps-chevron {
  transform: rotate(180deg);
}

.explain-plan__sql {
  margin: 0;
  padding: 10px 12px 12px;
  border-top: 1px solid var(--dw-border-light);
  font-family: var(--dw-font-mono, ui-monospace, monospace);
  font-size: 12px;
  line-height: 1.55;
  white-space: pre-wrap;
  color: var(--dw-text-secondary);
}

.explain-plan__hints {
  list-style: none;
  margin: 0;
  padding: 0 12px 10px;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.explain-plan__hint {
  padding: 8px 10px;
  border-radius: 8px;
  font-size: 12px;
  line-height: 1.45;
  border: 1px solid var(--dw-border-light);
}

.explain-plan__hint strong {
  display: block;
  margin-bottom: 2px;
}

.explain-plan__hint--warning {
  background: color-mix(in srgb, #f59e0b 12%, var(--dw-bg-panel));
}

.explain-plan__hint--info {
  background: color-mix(in srgb, var(--dw-bg-panel) 90%, var(--dw-bg));
}

.explain-plan__steps-content {
  padding: 0 12px 12px;
}

.explain-plan__tree {
  list-style: none;
  margin: 0;
  padding: 0;
  border: 1px solid var(--dw-border-light);
  border-radius: 8px;
  background: var(--dw-bg-panel);
}
</style>
