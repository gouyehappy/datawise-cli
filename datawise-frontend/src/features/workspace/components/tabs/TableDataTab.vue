<script setup lang="ts">
import {computed} from 'vue'
import {QueryResultPane} from '@/features/workspace/components'
import type {GridPendingBatch} from '@/core/composables/useGridPendingEdit'
import type {WorkspaceTab} from '@/core/types'
import type {QueryResultItem} from '@/features/workspace/types'
import {useTableDataView} from '@/features/workspace/composables/useTableDataView'
import {useQueryResultAiSummary} from '@/features/workspace/composables/useQueryResultAiSummary'
import {useLayoutStore} from '@/features/layout/stores/layout'
import {useExplorerStore} from '@/features/explorer/stores/explorer'
import {useAppConfigStore} from '@/features/layout/stores/app-config-store'
import {isProductionEnvironment} from '@/features/connection/services/connection-environment.service'
import {useI18n} from 'vue-i18n'

const props = defineProps<{ tab: WorkspaceTab }>()
const {t} = useI18n()
const layout = useLayoutStore()
const explorer = useExplorerStore()
const appConfig = useAppConfigStore()

const {
  tableData,
  tableProperties,
  viewOptions,
  gridEditable,
  effectiveCanDelete,
  effectiveCanUpdate,
  editDisabledHint,
  primaryKeyColumns,
  submitChanges,
  tableHasMore,
  cursorLoading,
  loadMore,
  refresh,
} = useTableDataView(props.tab)

async function onSubmitChanges(batch: GridPendingBatch) {
  const ok = await submitChanges(batch)
  if (ok) layout.showToast(t('dataGrid.submitSuccess'))
  return ok
}

const gridStateScope = computed(() => {
  const tab = props.tab
  if (!tab.connectionId || !tab.tableName) return undefined
  const database = tab.database ?? tab.instanceId ?? ''
  return `table:${tab.connectionId}:${database}:${tab.tableName}`
})

const exportSuggestMask = computed(() => {
  const connId = props.tab.connectionId
  if (!connId) return false
  const node = explorer.findNode(connId)
  return isProductionEnvironment(node?.env, node?.envCustom)
})

const {
  summaryOpen: aiSummaryOpen,
  summaryText: aiSummaryText,
  loading: aiSummaryLoading,
  summarize: summarizeActiveResult,
  closeSummary: closeAiSummary,
} = useQueryResultAiSummary({
  getConnectionId: () => props.tab.connectionId,
  getDatabase: () => props.tab.database ?? props.tab.instanceId ?? undefined,
  getDbType: () => explorer.findNode(props.tab.connectionId ?? '')?.dbType,
  getConnectionLabel: () =>
      explorer.findNode(props.tab.connectionId ?? '')?.label ?? t('common.unnamedConnection'),
  resolveAiPrefs: () => appConfig.aiPreferences,
})

const tableResultSnapshot = computed<QueryResultItem>(() => ({
  id: 'table-data',
  label: props.tab.tableName ?? 'Result 1',
  sql: `SELECT * FROM ${props.tab.tableName ?? 'table'}`,
  columns: tableData.value.columns,
  rows: tableData.value.rows,
  total: tableData.value.rows.length,
  where: viewOptions.value.where,
  orderBy: viewOptions.value.orderBy,
  durationMs: 0,
  status: 'success',
}))

function onRequestAiSummary() {
  void summarizeActiveResult(tableResultSnapshot.value)
}
</script>

<template>
  <QueryResultPane
      enable-ai-summary
      :ai-summary-loading="aiSummaryLoading"
      :ai-summary-open="aiSummaryOpen"
      :ai-summary-text="aiSummaryText"
      :grid-state-scope="gridStateScope"
      :editable="gridEditable"
      :read-only-hint="editDisabledHint"
      :can-delete="effectiveCanDelete"
      :can-update="effectiveCanUpdate"
      :column-details="tableProperties.columns"
      :pk-columns="primaryKeyColumns"
      :table-auto-increment="tableProperties.autoIncrement"
      :columns="tableData.columns"
      :rows="tableData.rows"
      :total="tableData.rows.length"
      :show-filter="viewOptions.showFilter"
      :where="viewOptions.where"
      :order-by="viewOptions.orderBy"
      :result-label="tab.tableName ?? 'Result 1'"
      :export-name="`${tab.tableName ?? 'table'}.csv`"
      :export-suggest-mask="exportSuggestMask"
      :on-submit-changes="onSubmitChanges"
      :result-has-more="tableHasMore"
      :cursor-loading="cursorLoading"
      @refresh="refresh"
      @load-more="loadMore"
      @request-ai-summary="onRequestAiSummary"
      @close-ai-summary="closeAiSummary"
  />
</template>
