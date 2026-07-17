<script setup lang="ts">
import {computed, ref, watch} from 'vue'
import {useI18n} from 'vue-i18n'
import {DwButton, EmptyState} from '@/core/components'
import DwSelect from '@/core/components/DwSelect.vue'
import type {SelectOption} from '@/core/components/select.types'
import type {TableColumn, TableRow} from '@/core/types'
import AiAnalysisChart from '@/features/ai/analysis/components/AiAnalysisChart.vue'
import {buildAiChartOption} from '@/features/ai/analysis/services/ai-chart.service'
import SaveChartToDashboardDialog from '@/features/dashboard/components/SaveChartToDashboardDialog.vue'
import {useLayoutStore} from '@/features/layout/stores/layout'
import {
    buildDefaultQueryResultChartConfig,
    inferQueryResultChartFields,
    pivotQueryResultRows,
    toAiChartSpec,
    type QueryResultChartConfig,
    type QueryResultChartType,
} from '@/features/workspace/services/query-result-chart.service'
import QueryResultViewToggle from '@/features/workspace/components/QueryResultViewToggle.vue'

const props = defineProps<{
  columns: TableColumn[]
  rows: TableRow[]
  title?: string
}>()

const viewMode = defineModel<'grid' | 'chart'>('viewMode', {default: 'chart'})

const {t} = useI18n()
const layout = useLayoutStore()

const chartTypes: QueryResultChartType[] = ['bar', 'line', 'pie']
const config = ref<QueryResultChartConfig | null>(null)
const pivotEnabled = ref(false)
const saveDialogOpen = ref(false)

const fields = computed(() => inferQueryResultChartFields(props.columns, props.rows))

const dimensionOptions = computed<SelectOption[]>(() =>
    fields.value
        .filter((field) => field.kind === 'dimension')
        .map((field) => ({value: field.key, label: field.label})),
)

const measureOptions = computed<SelectOption[]>(() =>
    fields.value
        .filter((field) => field.kind === 'measure')
        .map((field) => ({value: field.key, label: field.label})),
)

const chartRows = computed(() => {
  if (!config.value) return props.rows
  if (!pivotEnabled.value) return props.rows
  return pivotQueryResultRows(props.rows, config.value.xField, config.value.yFields)
})

const chartSpec = computed(() => {
  if (!config.value) return null
  return toAiChartSpec(config.value, props.columns)
})

const chartOption = computed(() => {
  if (!chartSpec.value) return null
  return buildAiChartOption(chartSpec.value, props.columns, chartRows.value)
})

const selectedMeasureKey = computed({
  get: () => config.value?.yFields[0] ?? '',
  set: (value: string) => {
    if (!config.value || !value) return
    config.value = {...config.value, yFields: [value]}
  },
})

const selectedDimensionKey = computed({
  get: () => config.value?.xField ?? '',
  set: (value: string) => {
    if (!config.value || !value) return
    config.value = {...config.value, xField: value}
  },
})

const selectedChartType = computed({
  get: () => config.value?.chartType ?? 'bar',
  set: (value: QueryResultChartType) => {
    if (!config.value) return
    config.value = {...config.value, chartType: value}
  },
})

function resetConfig() {
  config.value = buildDefaultQueryResultChartConfig(
      props.columns,
      props.rows,
      props.title?.trim() || t('queryResult.chart.defaultTitle'),
  )
  pivotEnabled.value = false
}

function onChartSaved(title: string) {
  layout.showSuccessToast(t('queryResult.chart.savedToDashboard', {title}))
}

watch(
    () => [props.columns, props.rows, props.title] as const,
    () => resetConfig(),
    {immediate: true, deep: true},
)
</script>

<template>
  <section v-if="config" class="result-chart">
    <header class="result-chart__head">
      <div class="result-chart__controls">
        <label class="result-chart__field">
          <span>{{ t('queryResult.chart.dimension') }}</span>
          <DwSelect v-model="selectedDimensionKey" size="sm" :options="dimensionOptions"/>
        </label>
        <label class="result-chart__field">
          <span>{{ t('queryResult.chart.measure') }}</span>
          <DwSelect v-model="selectedMeasureKey" size="sm" :options="measureOptions"/>
        </label>
        <div class="dw-segment" role="tablist" :aria-label="t('queryResult.chart.type')">
          <button
              v-for="chartType in chartTypes"
              :key="chartType"
              type="button"
              class="dw-segment__btn"
              :class="{ 'is-active': selectedChartType === chartType }"
              role="tab"
              :aria-selected="selectedChartType === chartType"
              @click="selectedChartType = chartType"
          >
            {{ t(`queryResult.chart.types.${chartType}`) }}
          </button>
        </div>
      </div>
      <div class="result-chart__head-actions">
        <label v-if="selectedChartType !== 'pie'" class="result-chart__pivot">
          <input v-model="pivotEnabled" type="checkbox"/>
          <span>{{ t('queryResult.chart.pivot') }}</span>
        </label>
        <QueryResultViewToggle v-model="viewMode"/>
      </div>
    </header>

    <AiAnalysisChart v-if="chartOption" :option="chartOption"/>

    <EmptyState
        v-else
        embedded
        bordered
        :title="t('queryResult.chart.unavailable')"
    />

    <footer class="result-chart__foot">
      <span class="result-chart__meta">
        {{ t('queryResult.chart.meta', {rows: chartRows.length, columns: props.columns.length}) }}
      </span>
      <div class="result-chart__foot-actions">
        <DwButton
            variant="secondary"
            size="sm"
            type="button"
            :disabled="!chartOption"
            @click="saveDialogOpen = true"
        >
          {{ t('queryResult.chart.saveToDashboard') }}
        </DwButton>
        <DwButton variant="ghost" size="sm" type="button" @click="resetConfig">
          {{ t('queryResult.chart.reset') }}
        </DwButton>
      </div>
    </footer>

    <SaveChartToDashboardDialog
        v-if="config"
        v-model:open="saveDialogOpen"
        :columns="props.columns"
        :rows="props.rows"
        :config="config"
        :pivot-enabled="pivotEnabled"
        @saved="onChartSaved"
    />
  </section>
</template>

<style scoped>
.result-chart {
  display: flex;
  flex-direction: column;
  flex: 1;
  min-height: 0;
  border-top: var(--dw-border-width) solid var(--dw-border-light);
  background: var(--dw-bg-panel);
}

.result-chart__head {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  gap: var(--dw-space-5);
  padding: var(--dw-space-4) var(--dw-space-6);
  border-bottom: var(--dw-border-width) solid var(--dw-border-light);
  background: var(--dw-bg-muted);
}

.result-chart__head-actions {
  display: inline-flex;
  align-items: center;
  gap: var(--dw-gap);
  flex-shrink: 0;
}

.result-chart__controls {
  display: flex;
  flex-wrap: wrap;
  align-items: flex-end;
  gap: var(--dw-space-4);
  min-width: 0;
}

.result-chart__field {
  display: grid;
  gap: var(--dw-gap-xs);
  min-width: 160px;
  font-size: var(--dw-text-xs);
  color: var(--dw-text-secondary);
}

.result-chart__field :deep(.dw-select) {
  width: 100%;
}




.result-chart__pivot {
  display: inline-flex;
  align-items: center;
  gap: var(--dw-gap-sm);
  font-size: var(--dw-text-xs);
  color: var(--dw-text-secondary);
  white-space: nowrap;
}

.result-chart :deep(.ai-analysis-chart) {
  flex: 1;
  min-height: 280px;
  height: auto;
}

.result-chart__foot {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--dw-gap);
  padding: var(--dw-space-3) var(--dw-space-6);
  border-top: var(--dw-border-width) solid var(--dw-border-light);
  background: var(--dw-bg-muted);
}

.result-chart__foot-actions {
  display: inline-flex;
  align-items: center;
  gap: var(--dw-gap-sm);
  flex-shrink: 0;
}

.result-chart__meta {
  font-size: var(--dw-text-xs);
  color: var(--dw-text-muted);
}
</style>
