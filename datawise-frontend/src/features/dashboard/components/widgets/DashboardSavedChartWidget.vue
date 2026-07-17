<script setup lang="ts">
import {computed} from 'vue'
import {useI18n} from 'vue-i18n'
import {DwButton} from '@/core/components'
import AiAnalysisChart from '@/features/ai/analysis/components/AiAnalysisChart.vue'
import {buildAiChartOption} from '@/features/ai/analysis/services/ai-chart.service'
import DashboardWidgetFrame from '@/features/dashboard/components/DashboardWidgetFrame.vue'
import type {DashboardChartWidget} from '@/features/dashboard/services/dashboard-chart-widget.service'
import {
    pivotQueryResultRows,
    toAiChartSpec,
} from '@/features/workspace/services/query-result-chart.service'
import '@/features/dashboard/styles/dashboard-widgets.css'

const props = defineProps<{
  widget: DashboardChartWidget
  editMode: boolean
}>()

const emit = defineEmits<{
  remove: []
}>()

const {t} = useI18n()

const chartRows = computed(() => {
  if (!props.widget.pivotEnabled) return props.widget.rows
  return pivotQueryResultRows(
      props.widget.rows,
      props.widget.config.xField,
      props.widget.config.yFields,
  )
})

const chartOption = computed(() => {
  const spec = toAiChartSpec(props.widget.config, props.widget.columns)
  return buildAiChartOption(spec, props.widget.columns, chartRows.value)
})
</script>

<template>
  <DashboardWidgetFrame
      :edit-mode="editMode"
      :is-dragging="false"
      :is-drop-target="false"
      card-class="dash-card--chart"
  >
    <header class="dash-card__head">
      <div class="dash-card__head-main">
        <h2 class="dash-card__title">{{ widget.title }}</h2>
        <p class="dash-card__sub">{{ t('dashboard.savedChart.snapshotHint') }}</p>
      </div>
      <div class="dash-card__head-actions">
        <span class="dash-card__badge">{{ t(`queryResult.chart.types.${widget.config.chartType}`) }}</span>
        <DwButton
            v-if="editMode"
            variant="ghost"
            size="sm"
            type="button"
            @click="emit('remove')"
        >
          {{ t('dashboard.savedChart.remove') }}
        </DwButton>
      </div>
    </header>
    <div class="dash-card__body dash-card__body--chart">
      <AiAnalysisChart v-if="chartOption" :option="chartOption"/>
    </div>
    <footer class="dash-card__foot">
      <span class="dash-card__meta">
        {{ t('dashboard.savedChart.meta', {rows: chartRows.length}) }}
      </span>
    </footer>
  </DashboardWidgetFrame>
</template>

<style scoped>
.dash-card--chart :deep(.ai-analysis-chart) {
  min-height: 240px;
  height: 280px;
}

.dash-card__head-main {
  display: grid;
  gap: var(--dw-gap-xs);
  min-width: 0;
}

.dash-card__sub {
  margin: 0;
  font-size: var(--dw-text-xs);
  color: var(--dw-text-muted);
}

.dash-card__head-actions {
  display: inline-flex;
  align-items: center;
  gap: var(--dw-gap-sm);
  flex-shrink: 0;
}

.dash-card__body--chart {
  padding: var(--dw-space-4) var(--dw-space-5) var(--dw-space-2);
}

.dash-card__foot {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: var(--dw-space-3) var(--dw-space-5);
  border-top: 1px solid var(--dw-border-light);
}

.dash-card__meta {
  font-size: var(--dw-text-xs);
  color: var(--dw-text-muted);
}
</style>
