<script setup lang="ts">
import {computed, ref, watch} from 'vue'
import {useI18n} from 'vue-i18n'
import type {WorkspaceTab} from '@/core/types'
import {useExplorerStore} from '@/features/explorer/stores/explorer'
import {extractConnectionsFromTree} from '@/features/explorer/utils/tree-targets'
import {compareSchemaScopes} from '@/features/schema-compare/services/schema-compare.service'
import {exportSchemaCompareMigration} from '@/features/schema-compare/services/schema-compare-export.service'
import {useSchemaCompareAiMigration} from '@/features/schema-compare/composables/useSchemaCompareAiMigration'
import SchemaCompareAiMigrationDialog from '@/features/schema-compare/components/SchemaCompareAiMigrationDialog.vue'
import {
    buildDefaultColumnSelection,
    buildDefaultTableSelection,
    buildSelectedSchemaMigrateDdl,
    countSelectedChanges,
    listConflictTableDiffs,
} from '@/features/schema-compare/services/schema-compare-selection.service'
import {scopesEqual} from '@/features/schema-compare/services/schema-scope.service'
import type {SchemaCompareResult, SchemaScope} from '@/features/schema-compare/types/schema-compare.types'
import {useLayoutStore} from '@/features/layout/stores/layout'
import {useAuthStore} from '@/features/auth/stores/auth-store'
import {useAppConfigStore} from '@/features/layout/stores/app-config-store'
import {
    buildDefaultMigrationFileName,
    normalizeMigrationFileName,
} from '@/features/workspace/services/migration-file-name.service'
import DwSelect from '@/core/components/DwSelect.vue'
import {DwButton, EmptyState, PromptDialog, StatusPill} from '@/core/components'
import type {SelectOption} from '@/core/components/select.types'

const props = defineProps<{ tab: WorkspaceTab }>()

const {t} = useI18n()
const explorer = useExplorerStore()
const layout = useLayoutStore()
const auth = useAuthStore()
const appConfig = useAppConfigStore()

const leftScope = ref<SchemaScope | null>(props.tab.schemaCompareLeft ?? null)
const rightScope = ref<SchemaScope | null>(props.tab.schemaCompareRight ?? null)
const comparing = ref(false)
const result = ref<SchemaCompareResult | null>(null)
const selectedTable = ref<string | null>(null)
const tableFilter = ref('')
const selectedTables = ref<Set<string>>(new Set())
const selectedColumnsByTable = ref<Map<string, Set<string>>>(new Map())
const exportDialogOpen = ref(false)
const exporting = ref(false)

const connections = computed(() => extractConnectionsFromTree(explorer.tree))

const leftConnectionId = computed({
  get: () => leftScope.value?.connectionId ?? '',
  set: (connectionId: string) => {
    const conn = connections.value.find((item) => item.id === connectionId)
    if (!conn) {
      leftScope.value = null
      return
    }
    const database = conn.databases[0]?.label ?? conn.label
    leftScope.value = {
      connectionId: conn.id,
      connectionLabel: conn.label,
      database,
      dbType: conn.dbType,
    }
  },
})

const rightConnectionId = computed({
  get: () => rightScope.value?.connectionId ?? '',
  set: (connectionId: string) => {
    const conn = connections.value.find((item) => item.id === connectionId)
    if (!conn) {
      rightScope.value = null
      return
    }
    const database = conn.databases[0]?.label ?? conn.label
    rightScope.value = {
      connectionId: conn.id,
      connectionLabel: conn.label,
      database,
      dbType: conn.dbType,
    }
  },
})

const leftDatabase = computed({
  get: () => leftScope.value?.database ?? '',
  set: (database: string) => {
    if (!leftScope.value) return
    leftScope.value = {...leftScope.value, database}
  },
})

const rightDatabase = computed({
  get: () => rightScope.value?.database ?? '',
  set: (database: string) => {
    if (!rightScope.value) return
    rightScope.value = {...rightScope.value, database}
  },
})

const leftDatabases = computed(() =>
    connections.value.find((item) => item.id === leftConnectionId.value)?.databases ?? [],
)

const rightDatabases = computed(() =>
    connections.value.find((item) => item.id === rightConnectionId.value)?.databases ?? [],
)

const connectionOptions = computed<SelectOption[]>(() => [
  {value: '', label: t('schemaCompare.selectConnection')},
  ...connections.value.map((conn) => ({
    value: conn.id,
    label: `${conn.groupLabel} / ${conn.label}`,
  })),
])

function databaseOptions(databases: { id: string; label: string }[]): SelectOption[] {
  return [
    {value: '', label: t('schemaCompare.selectDatabase')},
    ...databases.map((db) => ({value: db.label, label: db.label})),
  ]
}

const leftDatabaseOptions = computed(() => databaseOptions(leftDatabases.value))
const rightDatabaseOptions = computed(() => databaseOptions(rightDatabases.value))

const canCompare = computed(
    () =>
        !!leftScope.value?.connectionId
        && !!leftScope.value.database
        && !!rightScope.value?.connectionId
        && !!rightScope.value.database
        && !scopesEqual(leftScope.value, rightScope.value),
)

const filteredTableDiffs = computed(() => {
  const diffs = result.value?.tableDiffs ?? []
  const query = tableFilter.value.trim().toLowerCase()
  if (!query) return diffs
  return diffs.filter((item) => item.tableName.toLowerCase().includes(query))
})

const selectedTableDiff = computed(() =>
    filteredTableDiffs.value.find((item) => item.tableName === selectedTable.value) ?? null,
)

const conflictTables = computed(() =>
    result.value ? listConflictTableDiffs(result.value.tableDiffs) : [],
)

const selectedDdl = computed(() => {
    if (!result.value || !rightScope.value) return ''
    return buildSelectedSchemaMigrateDdl(
        result.value,
        rightScope.value.dbType,
        rightScope.value.database,
        selectedTables.value,
        selectedColumnsByTable.value,
    )
})

const {
    dialogOpen: aiMigrationDialogOpen,
    loading: aiMigrationLoading,
    baselineDdl: aiMigrationBaseline,
    suggestion: aiMigrationSuggestion,
    appliedUpDdl,
    suggestMigration,
    applySuggestion,
    clearAppliedMigration,
} = useSchemaCompareAiMigration({
    getLeftScope: () => leftScope.value,
    getRightScope: () => rightScope.value,
    getResult: () => result.value,
    getBaselineDdl: () => selectedDdl.value,
    getSelectedTables: () => selectedTables.value,
    getSelectedColumnsByTable: () => selectedColumnsByTable.value,
    resolveAiPrefs: () => appConfig.aiPreferences,
})

const effectiveDdl = computed(() => appliedUpDdl.value ?? selectedDdl.value)

const selectedChangeCount = computed(() => {
    if (!result.value) return 0
    return countSelectedChanges(
        result.value.tableDiffs,
        selectedTables.value,
        selectedColumnsByTable.value,
    )
})

const canExportMigration = computed(() =>
    selectedChangeCount.value > 0 && !!rightScope.value?.connectionId,
)

const exportDialogDefault = computed(() =>
    buildDefaultMigrationFileName('schema_compare'),
)

function resetSelection(next: SchemaCompareResult) {
    selectedTables.value = buildDefaultTableSelection(next.tableDiffs)
    const columns = new Map<string, Set<string>>()
    for (const table of listConflictTableDiffs(next.tableDiffs)) {
        if (table.status === 'changed' && table.columnDiffs.length) {
            columns.set(table.tableName, buildDefaultColumnSelection(table))
        }
    }
    selectedColumnsByTable.value = columns
}

function isTableSelected(tableName: string): boolean {
    return selectedTables.value.has(tableName)
}

function toggleTable(tableName: string, checked: boolean) {
    const next = new Set(selectedTables.value)
    if (checked) next.add(tableName)
    else next.delete(tableName)
    selectedTables.value = next
}

function isColumnSelected(tableName: string, columnName: string): boolean {
    const set = selectedColumnsByTable.value.get(tableName)
    return set ? set.has(columnName) : true
}

function toggleColumn(tableName: string, columnName: string, checked: boolean) {
    const current = selectedColumnsByTable.value.get(tableName) ?? new Set<string>()
    const next = new Set(current)
    if (checked) next.add(columnName)
    else next.delete(columnName)
    const map = new Map(selectedColumnsByTable.value)
    map.set(tableName, next)
    selectedColumnsByTable.value = map
    if (next.size > 0) {
        const tables = new Set(selectedTables.value)
        tables.add(tableName)
        selectedTables.value = tables
    }
}

function selectAllConflicts() {
    if (!result.value) return
    resetSelection(result.value)
}

function clearAllConflicts() {
    selectedTables.value = new Set()
    selectedColumnsByTable.value = new Map()
}

watch([leftScope, rightScope], () => {
  result.value = null
  selectedTable.value = null
  selectedTables.value = new Set()
  selectedColumnsByTable.value = new Map()
  clearAppliedMigration()
})

watch([selectedTables, selectedColumnsByTable], () => {
  clearAppliedMigration()
})

async function runCompare() {
  if (!canCompare.value || !leftScope.value || !rightScope.value) return
  comparing.value = true
  try {
    result.value = await compareSchemaScopes(leftScope.value, rightScope.value)
    resetSelection(result.value)
    selectedTable.value = result.value.tableDiffs.find((item) => item.status !== 'unchanged')?.tableName
        ?? result.value.tableDiffs[0]?.tableName
        ?? null
    layout.showToast(t('schemaCompare.compareDone'))
  } catch (error) {
    const message = error instanceof Error ? error.message : t('schemaCompare.compareFailed')
    layout.showToast(message)
  } finally {
    comparing.value = false
  }
}

async function copyDdl() {
  if (!effectiveDdl.value) return
  try {
    await navigator.clipboard.writeText(effectiveDdl.value)
    layout.showToast(t('schemaCompare.ddlCopied'))
  } catch {
    layout.showToast(t('schemaCompare.ddlCopyFailed'))
  }
}

function openExportDialog() {
  if (auth.isGuest) {
    layout.showToast(t('auth.guestReadOnlyHint'))
    return
  }
  if (!canExportMigration.value) return
  exportDialogOpen.value = true
}

async function confirmExportMigration(fileName: string) {
  if (!result.value || !rightScope.value) return
  const normalized = normalizeMigrationFileName(fileName)
  if (!normalized) {
    layout.showToast(t('schemaCompare.exportInvalidName'))
    return
  }
  exporting.value = true
  try {
    const relativePath = await exportSchemaCompareMigration({
      scope: rightScope.value,
      fileName: normalized,
      ddl: effectiveDdl.value,
    })
    layout.showToast(t('schemaCompare.exportDone', {path: relativePath}))
  } catch (error) {
    const message = error instanceof Error ? error.message : t('schemaCompare.exportFailed')
    layout.showToast(message)
  } finally {
    exporting.value = false
  }
}

function statusLabel(status: string) {
  const key = `schemaCompare.status.${status}`
  const label = t(key)
  return label === key ? status : label
}
</script>

<template>
  <div class="schema-compare">
    <header class="schema-compare__head">
      <div>
        <h2>{{ t('schemaCompare.title') }}</h2>
        <p>{{ t('schemaCompare.subtitle') }}</p>
      </div>
      <DwButton variant="primary" :disabled="!canCompare || comparing" :loading="comparing" @click="runCompare">
        {{ comparing ? t('schemaCompare.comparing') : t('schemaCompare.compareAction') }}
      </DwButton>
    </header>

    <section class="schema-compare__scopes">
      <div class="scope-card">
        <h3>{{ t('schemaCompare.leftTitle') }}</h3>
        <label class="scope-field">
          <span>{{ t('schemaCompare.connection') }}</span>
          <DwSelect v-model="leftConnectionId" size="sm" :options="connectionOptions"/>
        </label>
        <label class="scope-field">
          <span>{{ t('schemaCompare.database') }}</span>
          <DwSelect
              v-model="leftDatabase"
              size="sm"
              :options="leftDatabaseOptions"
              :disabled="!leftConnectionId"
          />
        </label>
        <p v-if="leftScope" class="scope-summary">{{ leftScope.connectionLabel }} / {{ leftScope.database }}</p>
      </div>

      <div class="scope-card">
        <h3>{{ t('schemaCompare.rightTitle') }}</h3>
        <label class="scope-field">
          <span>{{ t('schemaCompare.connection') }}</span>
          <DwSelect v-model="rightConnectionId" size="sm" :options="connectionOptions"/>
        </label>
        <label class="scope-field">
          <span>{{ t('schemaCompare.database') }}</span>
          <DwSelect
              v-model="rightDatabase"
              size="sm"
              :options="rightDatabaseOptions"
              :disabled="!rightConnectionId"
          />
        </label>
        <p v-if="rightScope" class="scope-summary">{{ rightScope.connectionLabel }} / {{ rightScope.database }}</p>
      </div>
    </section>

    <section v-if="result" class="schema-compare__summary">
      <StatusPill chip status="added" domain="schema">
        {{ t('schemaCompare.summaryAdded', {count: result.summary.added}) }}
      </StatusPill>
      <StatusPill chip status="removed" domain="schema">
        {{ t('schemaCompare.summaryRemoved', {count: result.summary.removed}) }}
      </StatusPill>
      <StatusPill chip status="changed" domain="schema">
        {{ t('schemaCompare.summaryChanged', {count: result.summary.changed}) }}
      </StatusPill>
      <StatusPill chip status="unchanged" domain="schema">
        {{ t('schemaCompare.summaryUnchanged', {count: result.summary.unchanged}) }}
      </StatusPill>
    </section>

    <div v-if="result" class="schema-compare__body">
      <aside class="table-list">
        <div class="table-list__toolbar">
          <input v-model="tableFilter" class="table-list__search" :placeholder="t('schemaCompare.filterTables')"/>
          <div class="table-list__bulk">
            <button type="button" class="link-btn" @click="selectAllConflicts">{{ t('schemaCompare.selectAll') }}</button>
            <button type="button" class="link-btn" @click="clearAllConflicts">{{ t('schemaCompare.selectNone') }}</button>
          </div>
        </div>
        <ul>
          <li v-for="item in filteredTableDiffs" :key="item.tableName">
            <div
                class="table-list__item"
                :class="{ 'is-active': selectedTable === item.tableName, [`is-${item.status}`]: true }"
            >
              <label v-if="item.status !== 'unchanged'" class="table-list__check">
                <input
                    type="checkbox"
                    :checked="isTableSelected(item.tableName)"
                    @change="toggleTable(item.tableName, ($event.target as HTMLInputElement).checked)"
                />
              </label>
              <button
                  class="table-list__label"
                  type="button"
                  @click="selectedTable = item.tableName"
              >
                <span>{{ item.tableName }}</span>
                <StatusPill :status="item.status" domain="schema">{{ statusLabel(item.status) }}</StatusPill>
              </button>
            </div>
          </li>
        </ul>
        <p v-if="conflictTables.length" class="table-list__hint">
          {{ t('schemaCompare.selectedCount', {count: selectedChangeCount}) }}
        </p>
      </aside>

      <section class="table-detail">
        <template v-if="selectedTableDiff">
          <h3>{{ selectedTableDiff.tableName }}</h3>
          <EmptyState
              v-if="!selectedTableDiff.columnDiffs.length"
              embedded
              :title="t('schemaCompare.noColumnDiffs')"
          />
          <table v-else class="diff-grid">
            <thead>
            <tr>
              <th v-if="selectedTableDiff.status === 'changed'" class="col-check">{{ t('schemaCompare.include') }}</th>
              <th>{{ t('schemaCompare.column') }}</th>
              <th>{{ t('schemaCompare.change') }}</th>
              <th>{{ t('schemaCompare.leftValue') }}</th>
              <th>{{ t('schemaCompare.rightValue') }}</th>
            </tr>
            </thead>
            <tbody>
            <tr v-for="column in selectedTableDiff.columnDiffs" :key="column.name">
              <td v-if="selectedTableDiff.status === 'changed'" class="col-check">
                <input
                    type="checkbox"
                    :checked="isColumnSelected(selectedTableDiff.tableName, column.name)"
                    @change="toggleColumn(
                        selectedTableDiff.tableName,
                        column.name,
                        ($event.target as HTMLInputElement).checked,
                    )"
                />
              </td>
              <td class="mono">{{ column.name }}</td>
              <td>
                <StatusPill inline :status="column.status" domain="schema">{{ statusLabel(column.status) }}</StatusPill>
              </td>
              <td class="mono">{{ column.left?.dataType ?? '—' }}</td>
              <td class="mono">{{ column.right?.dataType ?? '—' }}</td>
            </tr>
            </tbody>
          </table>
        </template>
        <EmptyState v-else embedded :title="t('schemaCompare.selectTableHint')"/>
      </section>

      <section class="ddl-panel">
        <header>
          <h3>{{ t('schemaCompare.ddlTitle') }}</h3>
          <div class="ddl-panel__actions">
            <DwButton
                variant="ghost"
                size="sm"
                type="button"
                :disabled="!selectedDdl || aiMigrationLoading"
                :loading="aiMigrationLoading"
                @click="suggestMigration"
            >
              {{ aiMigrationLoading ? t('schemaCompare.aiMigrationLoading') : t('schemaCompare.aiMigration') }}
            </DwButton>
            <DwButton
                variant="primary"
                size="sm"
                type="button"
                :disabled="!canExportMigration || exporting"
                :loading="exporting"
                @click="openExportDialog"
            >
              {{ t('schemaCompare.exportMigration') }}
            </DwButton>
            <DwButton variant="secondary" size="sm" type="button" :disabled="!effectiveDdl" @click="copyDdl">
              {{ t('schemaCompare.copyDdl') }}
            </DwButton>
          </div>
        </header>
        <p v-if="appliedUpDdl" class="ddl-panel__ai-note">{{ t('schemaCompare.aiMigrationApplied') }}</p>
        <pre class="ddl-panel__code">{{ effectiveDdl || t('schemaCompare.noSelectionDdl') }}</pre>
      </section>
    </div>

    <EmptyState v-else embedded :title="t('schemaCompare.empty')"/>

    <PromptDialog
        v-model:open="exportDialogOpen"
        :title="t('schemaCompare.exportTitle')"
        :subtitle="t('schemaCompare.exportHint')"
        :label="t('schemaCompare.exportFileName')"
        :default-value="exportDialogDefault"
        :confirm-label="t('schemaCompare.exportAction')"
        :cancel-label="t('common.cancel')"
        @confirm="confirmExportMigration"
    />

    <SchemaCompareAiMigrationDialog
        v-model:open="aiMigrationDialogOpen"
        :baseline-ddl="aiMigrationBaseline"
        :up-ddl="aiMigrationSuggestion?.up ?? ''"
        :down-ddl="aiMigrationSuggestion?.down ?? ''"
        :loading="aiMigrationLoading"
        @apply="applySuggestion"
    />
  </div>
</template>

<style scoped>
.schema-compare {
  display: flex;
  flex-direction: column;
  gap: 14px;
  height: 100%;
  min-height: 0;
  padding: 16px 18px;
  overflow: auto;
}

.schema-compare__head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
}

.schema-compare__head h2 {
  margin: 0 0 4px;
  font-size: 20px;
}

.schema-compare__head p {
  margin: 0;
  color: var(--dw-text-muted);
  font-size: 13px;
}

.schema-compare__scopes {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 12px;
}

.scope-card {
  padding: 12px 14px;
  border: 1px solid var(--dw-border-light);
  border-radius: 10px;
  background: var(--dw-bg-panel);
}

.scope-card h3 {
  margin: 0 0 10px;
  font-size: 13px;
}

.scope-field {
  display: grid;
  gap: 4px;
  margin-bottom: 8px;
  font-size: 12px;
}

.scope-field :deep(.dw-select) {
  width: 100%;
}

.scope-summary {
  margin: 4px 0 0;
  font-size: 11px;
  color: var(--dw-text-muted);
}

.schema-compare__summary {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.schema-compare__body {
  display: grid;
  grid-template-columns: 240px minmax(0, 1fr);
  grid-template-rows: minmax(220px, 1fr) auto;
  gap: 12px;
  min-height: 360px;
}

.table-list {
  grid-row: 1 / span 2;
  display: flex;
  flex-direction: column;
  min-height: 0;
  border: 1px solid var(--dw-border-light);
  border-radius: 10px;
  background: var(--dw-bg-panel);
}

.table-list__search {
  width: 100%;
  padding: 6px 8px;
  border: 1px solid var(--dw-border-light);
  border-radius: 6px;
  font-size: 12px;
}

.table-list__toolbar {
  display: flex;
  flex-direction: column;
  gap: 6px;
  margin: 8px;
}

.table-list__bulk {
  display: flex;
  gap: 10px;
}

.link-btn {
  padding: 0;
  border: none;
  background: none;
  color: var(--dw-primary);
  font-size: 11px;
  cursor: pointer;
}

.table-list__hint {
  margin: 0;
  padding: 0 10px 8px;
  font-size: 11px;
  color: var(--dw-text-muted);
}

.table-list ul {
  list-style: none;
  margin: 0;
  padding: 0 6px 8px;
  overflow: auto;
}

.table-list__item {
  width: 100%;
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 4px 6px;
  border-radius: 6px;
}

.table-list__check {
  display: flex;
  align-items: center;
  flex-shrink: 0;
}

.table-list__label {
  flex: 1;
  display: flex;
  justify-content: space-between;
  gap: 8px;
  padding: 3px 4px;
  border: none;
  border-radius: 6px;
  background: transparent;
  text-align: left;
  cursor: pointer;
  font-size: 12px;
}

.table-list__item.is-active,
.table-list__label:hover {
  background: var(--dw-bg-muted);
}

.table-detail,
.ddl-panel {
  border: 1px solid var(--dw-border-light);
  border-radius: 10px;
  background: var(--dw-bg-panel);
  padding: 12px;
  min-height: 0;
  overflow: auto;
}

.ddl-panel {
  grid-column: 2;
}

.ddl-panel header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  margin-bottom: 8px;
}

.ddl-panel__actions {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.ddl-panel__ai-note {
  margin: 0 0 8px;
  font-size: 11px;
  color: var(--dw-primary);
}

.ddl-panel header h3,
.table-detail h3 {
  margin: 0;
  font-size: 13px;
}

.ddl-panel__code {
  margin: 0;
  padding: 10px;
  border-radius: 8px;
  background: color-mix(in srgb, var(--dw-bg) 90%, #1e1f26);
  font-family: var(--dw-mono, monospace);
  font-size: 12px;
  line-height: 1.5;
  white-space: pre-wrap;
}

.diff-grid {
  width: 100%;
  border-collapse: collapse;
  font-size: 12px;
}

.diff-grid th,
.diff-grid td {
  padding: 8px 10px;
  border-bottom: 1px solid var(--dw-border-light);
  text-align: left;
}

.mono {
  font-family: var(--dw-mono, monospace);
}

.col-check {
  width: 36px;
  text-align: center;
}

@media (max-width: 960px) {
  .schema-compare__scopes,
  .schema-compare__body {
    grid-template-columns: 1fr;
  }

  .table-list {
    grid-row: auto;
    max-height: 220px;
  }

  .ddl-panel {
    grid-column: 1;
  }
}
</style>
