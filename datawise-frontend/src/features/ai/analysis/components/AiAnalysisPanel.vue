<script setup lang="ts">
import {computed} from 'vue'
import {useI18n} from 'vue-i18n'
import type {AiAnalysisResult} from '@/features/ai/types/analysis'
import {
  exportAnalysisHtml,
  exportAnalysisMarkdown,
} from '@/features/ai/analysis/services/analysis-export.service'
import {
  isFederatedSourceColumn,
  shouldShowFederatedHint,
} from '@/features/ai/analysis/services/analysis-federated.service'
import {buildAiChartOption} from '@/features/ai/analysis/services/ai-chart.service'
import AiAnalysisChart from '@/features/ai/analysis/components/AiAnalysisChart.vue'
import AiAnalysisReportSection from '@/features/ai/analysis/components/AiAnalysisReportSection.vue'
import {useLayoutStore} from '@/features/layout/stores/layout'

const props = defineProps<{
  analysis: AiAnalysisResult
  federatedTargetCount?: number
}>()

const emit = defineEmits<{
  openInConsole: [sql: string]
}>()

const {t} = useI18n()
const layout = useLayoutStore()

const PREVIEW_LIMIT = 8

const chartOption = computed(() => {
  if (!props.analysis.chart) return null
  return buildAiChartOption(props.analysis.chart, props.analysis.columns, props.analysis.rows)
})

const previewRows = computed(() => props.analysis.rows.slice(0, PREVIEW_LIMIT))

const columnKeys = computed(() =>
    props.analysis.columns.map((column) => column.key ?? column.name),
)

const showFederatedHint = computed(() =>
    shouldShowFederatedHint(props.federatedTargetCount ?? 0, props.analysis.columns),
)

function columnHeader(column: AiAnalysisResult['columns'][number]) {
  const key = column.key ?? column.name
  if (isFederatedSourceColumn(key)) return t('ai.analysis.federatedSourceColumn')
  return column.name
}

const chartTypeLabel = computed(() => {
  const type = props.analysis.chart?.type
  if (!type) return ''
  const key = `ai.analysis.chartTypes.${type}`
  const label = t(key)
  return label === key ? type : label
})

function exportMarkdown() {
  exportAnalysisMarkdown(props.analysis)
  layout.showToast(t('ai.analysis.exportMarkdownDone'))
}

function exportHtml() {
  exportAnalysisHtml(props.analysis)
  layout.showToast(t('ai.analysis.exportHtmlDone'))
}
</script>

<template>
  <div class="ai-analysis-panel">
    <header class="analysis-export-bar">
      <span class="analysis-export-bar__label">{{ t('ai.analysis.exportTitle') }}</span>
      <button class="ai-text-action" type="button" @click="exportMarkdown">
        {{ t('ai.analysis.exportMarkdown') }}
      </button>
      <button class="ai-text-action" type="button" @click="exportHtml">
        {{ t('ai.analysis.exportHtml') }}
      </button>
    </header>
    <section class="ai-section-card analysis-sql-card">
      <header class="ai-section-card__head">
        <h3 class="ai-section-card__title">
          <span class="ai-section-card__icon" aria-hidden="true">SQL</span>
          {{ t('ai.analysis.sqlLabel') }}
        </h3>
        <button class="ai-text-action" type="button" @click="emit('openInConsole', analysis.sql)">
          {{ t('ai.openInConsole') }}
        </button>
      </header>
      <div class="analysis-sql-body ai-code-surface">
        <pre><code>{{ analysis.sql }}</code></pre>
      </div>
    </section>

    <section v-if="chartOption && analysis.chart" class="ai-section-card">
      <header class="ai-section-card__head">
        <h3 class="ai-section-card__title">
          <span class="ai-section-card__icon" aria-hidden="true">V</span>
          {{ analysis.chart.title || t('ai.analysis.chartSection') }}
        </h3>
        <span v-if="chartTypeLabel" class="analysis-chip">{{ chartTypeLabel }}</span>
      </header>
      <AiAnalysisChart :option="chartOption"/>
    </section>

    <section v-if="analysis.pythonInsight" class="ai-section-card">
      <header class="ai-section-card__head">
        <h3 class="ai-section-card__title">
          <span class="ai-section-card__icon" aria-hidden="true">Py</span>
          {{ t('ai.analysis.pythonInsightLabel') }}
        </h3>
      </header>
      <div class="analysis-python-body">
        <p class="analysis-python-text">{{ analysis.pythonInsight }}</p>
      </div>
    </section>

    <AiAnalysisReportSection
        v-if="analysis.report?.markdown"
        :report="analysis.report"
    />

    <section v-if="analysis.rows.length" class="ai-section-card">
      <header class="ai-section-card__head">
        <h3 class="ai-section-card__title">
          <span class="ai-section-card__icon" aria-hidden="true">#</span>
          {{ t('ai.analysis.dataPreview', {count: analysis.rows.length}) }}
        </h3>
        <span v-if="analysis.rows.length > PREVIEW_LIMIT" class="analysis-chip analysis-chip--muted">
          {{ t('ai.analysis.previewShown', {shown: PREVIEW_LIMIT, total: analysis.rows.length}) }}
        </span>
      </header>
      <p v-if="showFederatedHint" class="analysis-federated-hint">
        {{ t('ai.analysis.federatedSourceHint') }}
      </p>
      <div class="analysis-table-scroll">
        <table class="analysis-table">
          <thead>
          <tr>
            <th v-for="column in analysis.columns" :key="column.key ?? column.name">
              {{ columnHeader(column) }}
            </th>
          </tr>
          </thead>
          <tbody>
          <tr v-for="(row, rowIndex) in previewRows" :key="rowIndex">
            <td v-for="key in columnKeys" :key="key">
              {{ row[key] ?? '' }}
            </td>
          </tr>
          </tbody>
        </table>
      </div>
    </section>
  </div>
</template>

<style scoped>
.ai-analysis-panel {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.analysis-export-bar {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
  padding: 0 2px;
}

.analysis-export-bar__label {
  font-size: 11px;
  font-weight: 600;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  color: var(--dw-text-muted);
}

.analysis-sql-card .analysis-sql-body {
  border: none;
  border-radius: 0;
  background: color-mix(in srgb, #1e1f26 94%, var(--dw-bg-panel));
}

.analysis-sql-body pre {
  margin: 0;
  padding: 12px 14px;
  overflow-x: auto;
}

.analysis-sql-body code {
  color: color-mix(in srgb, #e4e4e7 95%, var(--dw-text));
  font-family: var(--dw-mono);
  font-size: 12px;
  line-height: 1.55;
  white-space: pre-wrap;
}

.analysis-chip {
  padding: 4px 10px;
  border-radius: 999px;
  border: 1px solid color-mix(in srgb, var(--dw-primary) 28%, var(--dw-border));
  background: linear-gradient(180deg, color-mix(in srgb, var(--dw-primary-soft) 90%, #fff), var(--dw-primary-soft));
  color: var(--dw-primary);
  font-size: 11px;
  font-weight: 600;
  white-space: nowrap;
  box-shadow: inset 0 1px 0 color-mix(in srgb, #fff 40%, transparent);
}

.analysis-table-scroll {
  overflow-x: auto;
  border-radius: 0 0 14px 14px;
}

.analysis-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 12px;
}

.analysis-table th,
.analysis-table td {
  padding: 10px 14px;
  border-bottom: 1px solid var(--dw-border-light);
  text-align: left;
  white-space: nowrap;
}

.analysis-table th {
  background: linear-gradient(
      180deg,
      color-mix(in srgb, var(--dw-bg-panel) 90%, var(--dw-bg)),
      color-mix(in srgb, var(--dw-bg-panel) 60%, var(--dw-bg))
  );
  color: var(--dw-text-secondary);
  font-weight: 600;
  font-size: 11px;
  letter-spacing: 0.03em;
  text-transform: uppercase;
}

.analysis-table tbody tr {
  transition: background 0.12s ease;
}

.analysis-table tbody tr:nth-child(even) td {
  background: color-mix(in srgb, var(--dw-bg-panel) 40%, transparent);
}

.analysis-table tbody tr:hover td {
  background: color-mix(in srgb, var(--dw-primary) 8%, var(--dw-bg));
}

.analysis-chip--muted {
  border-color: var(--dw-border-light);
  background: var(--dw-bg);
  color: var(--dw-text-muted);
  box-shadow: none;
}

.analysis-federated-hint {
  margin: 0;
  padding: 0 14px 10px;
  font-size: 11px;
  line-height: 1.45;
  color: var(--dw-text-muted);
}

.analysis-python-body {
  padding: 12px 14px;
}

.analysis-python-text {
  margin: 0;
  font-size: 13px;
  line-height: 1.65;
  white-space: pre-wrap;
  color: var(--dw-text);
}

.analysis-table tr:last-child td {
  border-bottom: none;
}
</style>
