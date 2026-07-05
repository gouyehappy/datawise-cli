<script setup lang="ts">
import {computed, ref} from 'vue'
import {useI18n} from 'vue-i18n'
import DwDataGrid from '@/core/components/DwDataGrid.vue'
import {DwIcon} from '@/core/icons'
import type {DwDataGridColumn, DwDataGridLabels} from '@/core/components/dw-data-grid.types'
import type {WorkspaceTab} from '@/core/types'
import {rebuildAiRagIndex} from '@/features/ai/rag/services/ai-rag.service'
import {useLayoutStore} from '@/features/layout/stores/layout'
import {useSchemaTables} from '@/features/workspace/composables/useSchemaTables'
import {
  displaySchemaTableText,
  formatSchemaTableCreateTime,
  formatSchemaTableDataLength,
  formatSchemaTableRowCount,
} from '@/features/workspace/services/schema-tables.service'
import {useWorkspaceStore} from '@/features/workspace/stores/workspace'
import type {SchemaTableSummary} from '@/shared/api/types'

const props = defineProps<{ tab: WorkspaceTab }>()
const {t} = useI18n()
const workspace = useWorkspaceStore()
const layout = useLayoutStore()

const {rows, loading, error, databaseName, loadSchemaTables} = useSchemaTables(props.tab)
const selectedKeys = ref<string[]>([])
const syncingToAi = ref(false)

const columns = computed<DwDataGridColumn<SchemaTableSummary>[]>(() => [
  {
    key: 'tableName',
    label: t('workspace.schemaTables.tableName'),
    mono: true,
    cellClass: 'col-name',
  },
  {
    key: 'rowCount',
    label: t('workspace.schemaTables.rowCount'),
    align: 'right',
    headerClass: 'col-num',
    cellClass: 'col-num',
    format: (row) => formatSchemaTableRowCount(row.rowCount),
  },
  {
    key: 'engine',
    label: t('workspace.schemaTables.engine'),
    format: (row) => displaySchemaTableText(row.engine),
  },
  {
    key: 'collation',
    label: t('workspace.schemaTables.collation'),
    mono: true,
    cellClass: 'col-collation',
    format: (row) => displaySchemaTableText(row.collation),
  },
  {
    key: 'dataLength',
    label: t('workspace.schemaTables.dataLength'),
    align: 'right',
    headerClass: 'col-num',
    cellClass: 'col-num',
    format: (row) => formatSchemaTableDataLength(row.dataLength),
  },
  {
    key: 'createTime',
    label: t('workspace.schemaTables.createTime'),
    headerClass: 'col-time',
    cellClass: 'col-time',
    mono: true,
    format: (row) => formatSchemaTableCreateTime(row.createTime),
  },
  {
    key: 'comment',
    label: t('workspace.schemaTables.comment'),
    cellClass: 'col-comment',
    format: (row) => displaySchemaTableText(row.comment),
  },
])

const gridLabels = computed<Partial<DwDataGridLabels>>(() => ({
  filterValue: t('workspace.schemaTables.filter'),
  empty: t('workspace.schemaTables.empty'),
  noMatch: t('workspace.schemaTables.noMatch'),
  loading: t('workspace.tableDetail.loading'),
}))

function openErDiagram() {
  if (!props.tab.connectionId) return
  workspace.openSchemaEr({
    connectionId: props.tab.connectionId,
    database: props.tab.database ?? databaseName.value ?? '',
    instanceId: props.tab.instanceId ?? undefined,
    explorerNodeId: props.tab.explorerNodeId,
  })
}

async function syncToAiDataset() {
  if (!props.tab.connectionId || syncingToAi.value) return
  syncingToAi.value = true
  try {
    const result = await rebuildAiRagIndex(
        props.tab.connectionId,
        props.tab.database ?? databaseName.value,
    )
    layout.showToast(result.message || t('workspace.schemaTables.syncToAiSuccess'))
  } catch {
    layout.showErrorToast(t('workspace.schemaTables.syncToAiFailed'))
  } finally {
    syncingToAi.value = false
  }
}
</script>

<template>
  <DwDataGrid
      v-model:selected-keys="selectedKeys"
      :rows="rows"
      :columns="columns"
      row-key="tableName"
      column-filter
      :loading="loading"
      :error="error"
      :labels="gridLabels"
  >
    <template #toolbar-actions>
      <button
          type="button"
          :disabled="loading"
          @click="loadSchemaTables"
      >
        <DwIcon name="refresh" size="sm" :stroke-width="1.35"/>
        {{ t('workspace.schemaTables.refresh') }}
      </button>
      <button
          type="button"
          :disabled="loading || syncingToAi"
          @click="syncToAiDataset"
      >
        <DwIcon name="ai" size="sm" :stroke-width="1.35"/>
        {{ syncingToAi ? t('workspace.schemaTables.syncingToAi') : t('workspace.schemaTables.syncToAi') }}
      </button>
      <button
          type="button"
          @click="openErDiagram"
      >
        <DwIcon name="tab-schema-er" size="sm" :stroke-width="1.35"/>
        {{ t('workspace.schemaTables.openEr') }}
      </button>
    </template>

    <template #toolbar-end>
      <div class="dw-data-grid__end-chip" :title="databaseName || '—'">
        <DwIcon name="database" size="sm" :stroke-width="1.3"/>
        <strong>{{ databaseName || '—' }}</strong>
        <DwIcon name="chevron-down" size="xs" :stroke-width="1.5" style="opacity: 0.65; flex-shrink: 0"/>
      </div>
    </template>
  </DwDataGrid>
</template>

<style scoped>
:deep(.col-name) {
  font-weight: 600;
  white-space: nowrap;
}

:deep(.col-comment) {
  color: var(--dw-text-secondary);
  min-width: 180px;
}

:deep(.col-collation) {
  font-size: 11px;
}

:deep(.col-num) {
  width: 88px;
  white-space: nowrap;
}

:deep(.col-time) {
  width: 168px;
  white-space: nowrap;
  color: var(--dw-text-secondary);
}
</style>
