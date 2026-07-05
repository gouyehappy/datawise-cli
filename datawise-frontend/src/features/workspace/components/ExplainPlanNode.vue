<script setup lang="ts">
import {useI18n} from 'vue-i18n'
import type {ExplainMetricPair, ExplainPlanNode} from '@/features/workspace/types/explain-plan'

defineProps<{
  node: ExplainPlanNode
  depth: number
  collapsed: Record<string, boolean>
}>()

const emit = defineEmits<{
  toggle: [id: string]
}>()

const {t, te} = useI18n()

function metricEntries(node: ExplainPlanNode): [string, string | number][] {
  if (!node.metrics || node.metricPairs?.length) return []
  return Object.entries(node.metrics)
}

function metricLabel(key: string): string {
  const i18nKey = `queryResult.explainColumn.${key}`
  return te(i18nKey) ? t(i18nKey) : key
}

function pairLabel(id: ExplainMetricPair['id']) {
  return t(`queryResult.explainMetric.${id}`)
}
</script>

<template>
  <li class="explain-node">
    <div class="explain-node__row" :style="{ paddingLeft: `${depth * 16 + 8}px` }">
      <button
          v-if="node.children?.length"
          class="explain-node__toggle"
          type="button"
          :aria-expanded="!collapsed[node.id]"
          @click="emit('toggle', node.id)"
      >
        {{ collapsed[node.id] ? '▸' : '▾' }}
      </button>
      <span v-else class="explain-node__spacer" aria-hidden="true"/>

      <div class="explain-node__body">
        <div class="explain-node__label">{{ node.label }}</div>
        <div v-if="node.detail" class="explain-node__detail">{{ node.detail }}</div>
        <table v-if="node.metricPairs?.length" class="explain-node__pairs">
          <thead>
            <tr>
              <th scope="col"/>
              <th scope="col">{{ t('queryResult.explainMetric.estimate') }}</th>
              <th scope="col">{{ t('queryResult.explainMetric.actual') }}</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="pair in node.metricPairs" :key="pair.id">
              <th scope="row">{{ pairLabel(pair.id) }}</th>
              <td>{{ pair.estimate ?? '—' }}</td>
              <td>{{ pair.actual ?? '—' }}</td>
            </tr>
          </tbody>
        </table>
        <dl v-else-if="metricEntries(node).length" class="explain-node__metrics">
          <template v-for="([key, value], metricIndex) in metricEntries(node)" :key="metricIndex">
            <dt>{{ metricLabel(key) }}</dt>
            <dd>{{ value }}</dd>
          </template>
        </dl>
      </div>
    </div>

    <ul v-if="node.children?.length && !collapsed[node.id]" class="explain-node__children">
      <ExplainPlanNode
          v-for="child in node.children"
          :key="child.id"
          :node="child"
          :depth="depth + 1"
          :collapsed="collapsed"
          @toggle="emit('toggle', $event)"
      />
    </ul>
  </li>
</template>

<style scoped>
.explain-node__children {
  list-style: none;
  margin: 0;
  padding: 0;
}

.explain-node__row {
  display: flex;
  gap: 6px;
  align-items: flex-start;
  padding: 10px 12px;
  border-bottom: 1px solid var(--dw-border-light);
}

.explain-node__toggle {
  flex-shrink: 0;
  width: 18px;
  height: 18px;
  border: none;
  border-radius: 4px;
  background: var(--dw-bg-muted);
  color: var(--dw-text-secondary);
  cursor: pointer;
  font-size: 11px;
  line-height: 1;
}

.explain-node__spacer {
  flex-shrink: 0;
  width: 18px;
}

.explain-node__label {
  font-size: 13px;
  font-weight: 600;
  color: var(--dw-text);
}

.explain-node__detail {
  margin-top: 2px;
  font-size: 12px;
  line-height: 1.45;
  color: var(--dw-text-secondary);
}

.explain-node__metrics {
  display: grid;
  grid-template-columns: auto 1fr;
  gap: 2px 10px;
  margin: 6px 0 0;
  font-size: 11px;
}

.explain-node__pairs {
  width: 100%;
  margin: 8px 0 0;
  border-collapse: collapse;
  font-size: 11px;
}

.explain-node__pairs th,
.explain-node__pairs td {
  padding: 3px 8px;
  border: 1px solid var(--dw-border-subtle, rgba(128, 128, 128, 0.15));
  text-align: left;
}

.explain-node__pairs thead th {
  color: var(--dw-text-muted);
  font-weight: 600;
}

.explain-node__pairs tbody th {
  color: var(--dw-text-muted);
  font-weight: 500;
}

.explain-node__pairs td {
  font-family: var(--dw-mono, monospace);
  color: var(--dw-text-secondary);
}

.explain-node__metrics dt {
  margin: 0;
  color: var(--dw-text-muted);
}

.explain-node__metrics dd {
  margin: 0;
  font-family: var(--dw-mono, monospace);
  color: var(--dw-text-secondary);
}
</style>
