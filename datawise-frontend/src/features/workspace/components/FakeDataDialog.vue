<script setup lang="ts">
import {computed, ref, watch} from 'vue'
import {useI18n} from 'vue-i18n'
import {AppModal, DwButton, FormField} from '@/core/components'
import type {TablePropertiesResult} from '@/shared/api/types'
import type {TableRow} from '@/core/types'
import {
    clampFakeDataRowCount,
    columnsForFakeInsert,
    FAKE_DATA_DEFAULT_ROWS,
    FAKE_DATA_MAX_ROWS,
    FAKE_DATA_PREVIEW_ROWS,
} from '@/features/workspace/services/fake-data.service'
import {useLayoutStore} from '@/features/layout/stores/layout'
import {downloadTextFile} from '@/features/ai/analysis/services/analysis-export.service'

const props = defineProps<{
  open: boolean
  loading?: boolean
  executing?: boolean
  tableName?: string
  properties: TablePropertiesResult | null
  previewRows?: TableRow[] | null
  previewSql?: string | null
  previewLoading?: boolean
  errorMessage?: string
  canExecute?: boolean
  executeDisabledHint?: string
}>()

const emit = defineEmits<{
  'update:open': [value: boolean]
  execute: [rowCount: number]
  export: [rowCount: number]
  'refresh-preview': [rowCount: number]
}>()

const {t} = useI18n()
const layout = useLayoutStore()
const rowCount = ref(FAKE_DATA_DEFAULT_ROWS)
const rowCountError = ref('')
const activeView = ref<'split' | 'preview' | 'sql'>('split')
const sqlWrap = ref(false)

const insertColumns = computed(() =>
    props.properties ? columnsForFakeInsert(props.properties.columns) : [],
)

const previewRows = computed(() => props.previewRows ?? [])
const effectiveTableName = computed(() => props.properties?.tableName || props.tableName || 'table')
const hasSqlPreview = computed(() => !!props.previewSql?.trim())
const previewSqlText = computed(() => {
    const sql = props.previewSql ?? ''
    const lines = sql.split('\n')
    const maxLines = 40
    const head = lines.slice(0, maxLines).join('\n')
    if (lines.length > maxLines) return head + '\n...'
    return head
})

const previewColumnNames = computed(() => insertColumns.value.map((column) => column.name))

watch(
    () => props.open,
    (isOpen) => {
      if (!isOpen) return
      rowCount.value = FAKE_DATA_DEFAULT_ROWS
      rowCountError.value = ''
      activeView.value = 'split'
      sqlWrap.value = false
    },
)

function close() {
  emit('update:open', false)
}

function validateRowCount(): number | null {
  const value = clampFakeDataRowCount(rowCount.value)
  if (value < 1 || value > FAKE_DATA_MAX_ROWS) {
    rowCountError.value = t('workspace.fakeData.rowCountInvalid', {max: FAKE_DATA_MAX_ROWS})
    return null
  }
  rowCountError.value = ''
  rowCount.value = value
  return value
}

function onExecute() {
  const count = validateRowCount()
  if (count == null) return
  emit('execute', count)
}

function onExport() {
  const count = validateRowCount()
  if (count == null) return
  emit('export', count)
}

function onRefreshPreview() {
  const count = validateRowCount()
  if (count == null) return
  emit('refresh-preview', count)
}

async function copySql() {
  const sql = props.previewSql?.trim()
  if (!sql) return
  try {
    await navigator.clipboard.writeText(sql)
    layout.showToast(t('explorer.exportSqlCopied'))
  } catch {
    layout.showToast(t('explorer.exportSqlFailed'))
  }
}

function downloadSql() {
  const sql = props.previewSql?.trim()
  if (!sql) return
  const stamp = new Date().toISOString().replace(/[:.]/g, '-')
  const tableName = effectiveTableName.value || 'table'
  downloadTextFile(sql, `${tableName}-fake-data-${stamp}.sql`, 'text/plain;charset=utf-8')
  layout.showToast(t('workspace.fakeData.exported'))
}
</script>

<template>
  <AppModal
      :open="open"
      :title="t('workspace.fakeData.title', {table: tableName || '—'})"
      :subtitle="t('workspace.fakeData.subtitle')"
      width="980px"
      max-height="min(90vh, 860px)"
      @close="close"
  >
    <div v-if="loading" class="fake-data-empty-state">
      {{ t('workspace.fakeData.loading') }}
    </div>

    <div v-else-if="!insertColumns.length" class="fake-data-empty-state">
      {{ t('workspace.fakeData.noColumns') }}
    </div>

    <div v-else class="fake-data-modal">
      <section class="fake-data-toolbar">
        <div class="fake-data-toolbar__field">
          <FormField :label="t('workspace.fakeData.rowCountLabel')">
            <template #default="{ id }">
              <input
                  :id="id"
                  v-model.number="rowCount"
                  class="dw-input"
                  type="number"
                  min="1"
                  :max="FAKE_DATA_MAX_ROWS"
              />
            </template>
          </FormField>
        </div>
        <DwButton
            variant="secondary"
            type="button"
            class="fake-data-toolbar__refresh"
            :disabled="loading || previewLoading || executing || !insertColumns.length"
            @click="onRefreshPreview"
        >
          {{ t('common.refresh') }}
        </DwButton>
        <div class="fake-data-view-switch">
          <button
              type="button"
              class="fake-data-view-switch__btn"
              :class="{'is-active': activeView === 'split'}"
              @click="activeView = 'split'"
              title="Split view"
          >
            S
          </button>
          <button
              type="button"
              class="fake-data-view-switch__btn"
              :class="{'is-active': activeView === 'preview'}"
              @click="activeView = 'preview'"
              :title="t('workspace.fakeData.previewTitle')"
          >
            P
          </button>
          <button
              type="button"
              class="fake-data-view-switch__btn"
              :class="{'is-active': activeView === 'sql'}"
              @click="activeView = 'sql'"
              title="SQL view"
          >
            Q
          </button>
        </div>
      </section>
      <p v-if="rowCountError" class="dw-form-error" role="alert">{{ rowCountError }}</p>

      <section class="fake-data-hints">
        <span>{{ t('workspace.fakeData.columnHint', {count: insertColumns.length}) }}</span>
        <span>{{ t('workspace.fakeData.previewHint', {preview: FAKE_DATA_PREVIEW_ROWS, max: FAKE_DATA_MAX_ROWS}) }}</span>
        <span>{{ t('workspace.fakeData.auditHint') }}</span>
      </section>

      <section class="fake-data-panels" :class="`is-${activeView}`">
        <article v-show="activeView !== 'sql'" class="fake-data-panel">
          <header class="fake-data-panel__header">
            <strong>{{ t('workspace.fakeData.previewTitle') }}</strong>
            <span v-if="previewLoading" class="fake-data-panel__status">{{ t('workspace.fakeData.loading') }}</span>
          </header>
          <div class="fake-data-panel__body fake-data-panel__body--scroll">
            <div class="modal-data-table-wrap">
              <table class="modal-data-table">
                <thead>
                  <tr>
                    <th class="is-index">#</th>
                    <th v-for="column in previewColumnNames" :key="column">{{ column }}</th>
                  </tr>
                </thead>
                <tbody>
                  <tr v-for="(row, rowIndex) in previewRows" :key="rowIndex">
                    <td class="is-index">{{ rowIndex + 1 }}</td>
                    <td v-for="column in previewColumnNames" :key="column">
                      {{ row[column] ?? 'NULL' }}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </article>

        <article v-show="activeView !== 'preview'" class="fake-data-panel">
          <header class="fake-data-panel__header">
            <strong>{{ t('workspace.fakeData.previewTitle') }} · SQL</strong>
            <div class="fake-data-panel__actions">
              <button
                  type="button"
                  class="fake-data-wrap-toggle"
                  :class="{'is-active': sqlWrap}"
                  @click="sqlWrap = !sqlWrap"
              >
                {{ sqlWrap ? 'No Wrap' : 'Wrap' }}
              </button>
              <DwButton
                  variant="ghost"
                  type="button"
                  :disabled="!hasSqlPreview"
                  @click="copySql"
              >
                {{ t('workspace.fakeData.copySql') }}
              </DwButton>
              <DwButton
                  variant="secondary"
                  type="button"
                  :disabled="!hasSqlPreview"
                  @click="downloadSql"
              >
                {{ t('workspace.fakeData.downloadSql') }}
              </DwButton>
            </div>
          </header>
          <div class="fake-data-panel__body fake-data-panel__body--scroll">
            <pre class="fake-data-sql-preview__code" :class="{'is-wrap': sqlWrap}">{{ previewSqlText || '--' }}</pre>
          </div>
        </article>
      </section>

      <div v-if="executing" class="fake-data-running-banner" role="status" aria-live="polite">
        {{ t('workspace.fakeData.executing') }}
      </div>
      <div v-else-if="errorMessage" class="fake-data-error-banner" role="alert">
        {{ errorMessage }}
      </div>
    </div>

    <template #footer>
      <div class="modal-footer-row">
        <DwButton
            variant="secondary"
            type="button"
            :disabled="loading || executing || !canExecute || !insertColumns.length"
            :title="!canExecute ? executeDisabledHint : undefined"
            @click="onExecute"
        >
          {{ executing ? t('workspace.fakeData.executing') : t('workspace.fakeData.execute') }}
        </DwButton>
        <div class="modal-footer-row__end">
          <DwButton variant="ghost" type="button" @click="close">
            {{ t('common.cancel') }}
          </DwButton>
          <DwButton
              variant="primary"
              type="button"
              :disabled="loading || !insertColumns.length"
              @click="onExport"
          >
            {{ t('workspace.fakeData.export') }}
          </DwButton>
        </div>
      </div>
    </template>
  </AppModal>
</template>

<style scoped>
.fake-data-modal {
  display: flex;
  flex: 1 1 auto;
  flex-direction: column;
  gap: 14px;
  min-width: 0;
  min-height: 0;
  overflow: hidden;
}

.fake-data-toolbar,
.fake-data-hints,
.fake-data-running-banner,
.fake-data-error-banner {
  flex-shrink: 0;
}

.fake-data-empty-state {
  min-height: 220px;
  display: grid;
  place-items: center;
  color: var(--dw-text-muted);
}

.fake-data-toolbar {
  display: flex;
  align-items: flex-end;
  gap: 12px;
  padding: 12px;
  border: 1px solid var(--dw-panel-border);
  border-radius: var(--dw-panel-radius, 10px);
  background: var(--dw-bg-panel);
  box-shadow: var(--dw-panel-shadow);
}

.fake-data-toolbar__field {
  flex: 0 0 260px;
}

.fake-data-toolbar__refresh {
  height: 36px;
}

.fake-data-view-switch {
  margin-left: auto;
  display: inline-flex;
  border: 1px solid var(--dw-tab-bar-border, var(--dw-border-light));
  border-radius: var(--dw-tab-pill-radius, 8px);
  overflow: hidden;
  background: var(--dw-tab-bar-bg, var(--dw-bg-muted));
}

.fake-data-view-switch__btn {
  height: 36px;
  width: 38px;
  border: 0;
  background: transparent;
  color: var(--dw-text-muted);
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.5px;
  cursor: pointer;
  transition: background 0.12s ease, color 0.12s ease;
}

.fake-data-view-switch__btn + .fake-data-view-switch__btn {
  border-left: 1px solid var(--dw-border-light);
}

.fake-data-view-switch__btn:hover {
  background: var(--dw-bg-hover);
  color: var(--dw-text-secondary);
}

.fake-data-view-switch__btn.is-active {
  background: color-mix(in srgb, var(--dw-primary) 14%, var(--dw-bg-panel));
  color: var(--dw-primary);
}

.fake-data-hints {
  display: grid;
  gap: 6px;
  font-size: 12px;
  color: var(--dw-text-muted);
  padding: 2px 2px 0;
}

.fake-data-running-banner {
  padding: 8px 10px;
  border: 1px solid color-mix(in srgb, var(--dw-primary) 28%, var(--dw-border-light));
  border-radius: var(--dw-panel-radius, 8px);
  background: color-mix(in srgb, var(--dw-primary) 8%, var(--dw-bg));
  color: var(--dw-text-secondary);
  font-size: 12px;
}

.fake-data-error-banner {
  padding: 8px 10px;
  border: 1px solid color-mix(in srgb, var(--dw-danger, #dc2626) 28%, var(--dw-border-light));
  border-radius: var(--dw-panel-radius, 8px);
  background: color-mix(in srgb, var(--dw-danger, #dc2626) 8%, var(--dw-bg));
  color: var(--dw-danger, #dc2626);
  font-size: 12px;
}

.fake-data-panels {
  display: grid;
  grid-template-columns: minmax(0, 1.2fr) minmax(0, 1fr);
  grid-template-rows: minmax(0, 1fr);
  gap: 12px;
  flex: 1 1 auto;
  min-height: 240px;
  height: 0;
  min-width: 0;
  overflow: hidden;
}

.fake-data-panels.is-preview,
.fake-data-panels.is-sql {
  grid-template-columns: minmax(0, 1fr);
}

.fake-data-panel {
  display: flex;
  flex-direction: column;
  min-width: 0;
  min-height: 0;
  height: 100%;
  max-height: 100%;
  border: 1px solid var(--dw-panel-border);
  border-radius: var(--dw-panel-radius, 10px);
  overflow: hidden;
  background: var(--dw-bg-panel);
  box-shadow: var(--dw-panel-shadow);
}

.fake-data-panel__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  padding: 10px 12px;
  border-bottom: 1px solid var(--dw-border-light);
  background: var(--dw-bg-muted);
  color: var(--dw-text);
  min-width: 0;
  flex-shrink: 0;
}

.fake-data-panel__header strong {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.fake-data-panel__status {
  font-size: 12px;
  color: var(--dw-text-muted);
}

.fake-data-panel__actions {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  flex-wrap: wrap;
  gap: 6px;
  flex-shrink: 0;
  max-width: 100%;
}

.fake-data-wrap-toggle {
  height: 30px;
  padding: 0 10px;
  border-radius: 6px;
  border: 1px solid var(--dw-border-light);
  background: var(--dw-bg);
  color: var(--dw-text-secondary);
  font-size: 12px;
  cursor: pointer;
  flex-shrink: 0;
  white-space: nowrap;
  transition: background 0.12s ease, color 0.12s ease, border-color 0.12s ease;
}

.fake-data-wrap-toggle:hover {
  background: var(--dw-bg-hover);
}

.fake-data-wrap-toggle.is-active {
  color: var(--dw-primary);
  border-color: color-mix(in srgb, var(--dw-primary) 35%, var(--dw-border-light));
  background: color-mix(in srgb, var(--dw-primary) 10%, var(--dw-bg));
}

.fake-data-panel__body {
  display: flex;
  flex: 1 1 auto;
  flex-direction: column;
  min-width: 0;
  min-height: 0;
  padding: 10px;
  overflow: hidden;
}

.fake-data-panel__body--scroll {
  min-height: 0;
}

.modal-data-table-wrap {
  flex: 1 1 auto;
  min-height: 0;
  max-width: 100%;
  overflow: auto;
  border: 1px solid var(--dw-border-light);
  border-radius: var(--dw-panel-radius, 8px);
}

.modal-data-table {
  width: max-content;
  min-width: 100%;
  border-collapse: collapse;
  font-size: 12px;
}

.modal-data-table thead {
  position: sticky;
  top: 0;
  z-index: 1;
}

.modal-data-table th,
.modal-data-table td {
  padding: 6px 8px;
  border-bottom: 1px solid var(--dw-border-subtle, var(--dw-border-light));
  white-space: nowrap;
}

.modal-data-table th.is-index,
.modal-data-table td.is-index {
  position: sticky;
  left: 0;
  z-index: 2;
  min-width: 42px;
  text-align: right;
  color: var(--dw-text-muted);
  background: var(--dw-bg-panel);
  border-right: 1px solid var(--dw-border-light);
}

.modal-data-table th {
  background: var(--dw-bg-muted);
  color: var(--dw-text-secondary);
  font-weight: 600;
}

.modal-data-table td {
  color: var(--dw-text-secondary);
  font-family: var(--dw-font-mono, monospace);
}

.modal-data-table tr:nth-child(2n) td {
  background: color-mix(in srgb, var(--dw-text) 2%, transparent);
}

.fake-data-sql-preview__code {
  display: block;
  box-sizing: border-box;
  margin: 0;
  flex: 1 1 auto;
  width: 100%;
  max-width: 100%;
  min-width: 0;
  min-height: 0;
  overflow: auto;
  white-space: pre;
  font-size: 12px;
  line-height: 1.5;
  font-family: var(--dw-font-mono, monospace);
  color: var(--dw-text);
  background: var(--dw-bg-muted);
  border: 1px solid var(--dw-border-light);
  border-radius: var(--dw-panel-radius, 8px);
  padding: 10px;
}

.fake-data-sql-preview__code.is-wrap {
  white-space: pre-wrap;
  overflow-wrap: anywhere;
  word-break: break-word;
}

@media (max-width: 1024px) {
  .fake-data-panels {
    grid-template-columns: 1fr;
  }

  .fake-data-toolbar {
    flex-wrap: wrap;
  }

  .fake-data-view-switch {
    margin-left: 0;
  }
}
</style>
