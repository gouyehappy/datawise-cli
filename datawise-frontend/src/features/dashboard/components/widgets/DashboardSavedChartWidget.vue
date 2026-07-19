<script setup lang="ts">
import {computed, ref} from 'vue'
import {useI18n} from 'vue-i18n'
import {DwButton} from '@/core/components'
import {sharesApi} from '@/api'
import AiAnalysisChart from '@/features/ai/analysis/components/AiAnalysisChart.vue'
import {buildAiChartOption} from '@/features/ai/analysis/services/ai-chart.service'
import DashboardWidgetFrame from '@/features/dashboard/components/DashboardWidgetFrame.vue'
import type {DashboardChartWidget} from '@/features/dashboard/services/dashboard-chart-widget.service'
import {
    pivotQueryResultRows,
    toAiChartSpec,
} from '@/features/workspace/services/query-result-chart.service'
import {useAppToast} from '@/features/layout/composables/useAppToast'
import {resolveDisplayApiErrorMessage} from '@/shared/api/http/api-error-message'
import '@/features/dashboard/styles/dashboard-widgets.css'

const props = defineProps<{
  widget: DashboardChartWidget
  editMode: boolean
}>()

const emit = defineEmits<{
  remove: []
}>()

const {t} = useI18n()
const toast = useAppToast()
const sharing = ref(false)
const shareExpiresInDays = ref(30)

const shareExpiryOptions = [
  {value: 7, labelKey: 'dashboard.savedChart.shareExpiresDays' as const},
  {value: 14, labelKey: 'dashboard.savedChart.shareExpiresDays' as const},
  {value: 30, labelKey: 'dashboard.savedChart.shareExpiresDays' as const},
  {value: 90, labelKey: 'dashboard.savedChart.shareExpiresDays' as const},
]

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

async function shareSnapshot() {
  if (sharing.value) return
  sharing.value = true
  try {
    const expiresInDays = shareExpiresInDays.value
    const created = await sharesApi.create({
      title: props.widget.title,
      kind: 'dashboard_chart',
      payloadJson: JSON.stringify({
        columns: props.widget.columns,
        rows: props.widget.rows.slice(0, 500),
        config: props.widget.config,
        pivotEnabled: props.widget.pivotEnabled,
      }),
      expiresInDays,
    })
    const url = sharesApi.publicPageUrl(created.token)
    await navigator.clipboard.writeText(url)
    toast.success(t('dashboard.savedChart.shareCopiedWithExpiry', {days: expiresInDays}))
  } catch (error) {
    toast.error(
        resolveDisplayApiErrorMessage(error, (key) => String(t(key)))
        || t('dashboard.savedChart.shareFailed'),
    )
  } finally {
    sharing.value = false
  }
}
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
        <label class="dash-card__share-expiry" :title="t('dashboard.savedChart.shareExpiresHint')">
          <span class="visually-hidden">{{ t('dashboard.savedChart.shareExpiresLabel') }}</span>
          <select
              v-model.number="shareExpiresInDays"
              class="dash-card__share-select"
              :disabled="sharing"
          >
            <option
                v-for="option in shareExpiryOptions"
                :key="option.value"
                :value="option.value"
            >
              {{ t(option.labelKey, {days: option.value}) }}
            </option>
          </select>
        </label>
        <DwButton
            variant="ghost"
            size="sm"
            type="button"
            :disabled="sharing"
            @click="shareSnapshot"
        >
          {{ t('dashboard.savedChart.share') }}
        </DwButton>
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

.dash-card__share-select {
  appearance: auto;
  max-width: 7.5rem;
  padding: 2px 6px;
  border: 1px solid var(--dw-border-light);
  border-radius: var(--dw-radius-sm);
  background: var(--dw-surface);
  color: var(--dw-text-secondary);
  font-size: var(--dw-text-xs);
}

.visually-hidden {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
  border: 0;
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
