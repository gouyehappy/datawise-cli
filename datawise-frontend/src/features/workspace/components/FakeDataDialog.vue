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
            class="fake-data-toolbar__refresh fake-data-btn fake-data-btn--accent"
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
          <div class="fake-data-panel__body">
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
                  class="fake-data-btn"
                  :disabled="!hasSqlPreview"
                  @click="copySql"
              >
                {{ t('workspace.fakeData.copySql') }}
              </DwButton>
              <DwButton
                  variant="secondary"
                  type="button"
                  class="fake-data-btn fake-data-btn--accent"
                  :disabled="!hasSqlPreview"
                  @click="downloadSql"
              >
                {{ t('workspace.fakeData.downloadSql') }}
              </DwButton>
            </div>
          </header>
          <div class="fake-data-panel__body">
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
            class="fake-data-btn fake-data-btn--danger"
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
              class="fake-data-btn fake-data-btn--accent"
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
  flex-direction: column;
  gap: 14px;
}

.fake-data-empty-state {
  min-height: 220px;
  display: grid;
  place-items: center;
  color: var(--color-text-muted, #9ca3af);
}

.fake-data-toolbar {
  display: flex;
  align-items: flex-end;
  gap: 12px;
  padding: 12px;
  border: 1px solid rgba(125, 92, 255, 0.34);
  border-radius: 10px;
  background: linear-gradient(120deg, rgba(30, 18, 59, 0.85), rgba(18, 22, 38, 0.92));
  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.05);
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
  border: 1px solid rgba(125, 92, 255, 0.35);
  border-radius: 8px;
  overflow: hidden;
}

.fake-data-view-switch__btn {
  height: 36px;
  width: 38px;
  border: 0;
  background: rgba(20, 24, 38, 0.9);
  color: var(--color-text-muted, #a1a8bd);
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.5px;
  cursor: pointer;
}

.fake-data-view-switch__btn + .fake-data-view-switch__btn {
  border-left: 1px solid rgba(125, 92, 255, 0.25);
}

.fake-data-view-switch__btn.is-active {
  background: rgba(125, 92, 255, 0.25);
  color: #efeaff;
}

.fake-data-hints {
  display: grid;
  gap: 6px;
  font-size: 12px;
  color: var(--color-text-muted, #9ca3af);
  padding: 2px 2px 0;
}

.fake-data-running-banner {
  padding: 8px 10px;
  border: 1px solid rgba(125, 92, 255, 0.35);
  border-radius: 8px;
  background: rgba(125, 92, 255, 0.12);
  color: #ddd5ff;
  font-size: 12px;
}

.fake-data-error-banner {
  padding: 8px 10px;
  border: 1px solid rgba(246, 98, 132, 0.45);
  border-radius: 8px;
  background: rgba(246, 98, 132, 0.14);
  color: #ffd7e1;
  font-size: 12px;
}

.fake-data-panels {
  display: grid;
  grid-template-columns: 1.2fr 1fr;
  gap: 12px;
  min-height: 360px;
}

.fake-data-panels.is-preview,
.fake-data-panels.is-sql {
  grid-template-columns: 1fr;
}

.fake-data-panel {
  display: flex;
  flex-direction: column;
  min-height: 0;
  border: 1px solid rgba(125, 92, 255, 0.25);
  border-radius: 10px;
  overflow: hidden;
  background: linear-gradient(180deg, rgba(18, 20, 34, 0.95), rgba(13, 15, 27, 0.95));
  box-shadow: 0 10px 24px rgba(0, 0, 0, 0.24);
}

.fake-data-panel__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  padding: 10px 12px;
  border-bottom: 1px solid rgba(125, 92, 255, 0.2);
  background: rgba(125, 92, 255, 0.08);
}

.fake-data-panel__status {
  font-size: 12px;
  color: var(--color-text-muted, #9ca3af);
}

.fake-data-panel__actions {
  display: flex;
  align-items: center;
  gap: 8px;
}

.fake-data-wrap-toggle {
  height: 30px;
  padding: 0 10px;
  border-radius: 6px;
  border: 1px solid rgba(125, 92, 255, 0.35);
  background: rgba(20, 24, 38, 0.9);
  color: var(--color-text-muted, #a1a8bd);
  font-size: 12px;
  cursor: pointer;
}

.fake-data-wrap-toggle.is-active {
  color: #efeaff;
  background: rgba(125, 92, 255, 0.25);
}

.fake-data-panel__body {
  flex: 1;
  min-height: 0;
  padding: 10px;
}

.modal-data-table-wrap {
  height: 100%;
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
  border-bottom: 1px solid rgba(125, 92, 255, 0.16);
  white-space: nowrap;
}

.modal-data-table th.is-index,
.modal-data-table td.is-index {
  position: sticky;
  left: 0;
  z-index: 2;
  min-width: 42px;
  text-align: right;
  color: #bfc5dd;
  background: rgba(16, 18, 30, 0.98);
  border-right: 1px solid rgba(125, 92, 255, 0.2);
}

.modal-data-table th {
  background: rgba(125, 92, 255, 0.18);
  color: #d9cfff;
  font-weight: 600;
}

.modal-data-table tr:nth-child(2n) td {
  background: rgba(255, 255, 255, 0.02);
}

.fake-data-sql-preview__code {
  margin: 0;
  height: 100%;
  overflow: auto;
  white-space: pre;
  font-size: 12px;
  line-height: 1.5;
  color: #d7ddff;
  background: rgba(7, 9, 17, 0.75);
  border: 1px solid rgba(125, 92, 255, 0.22);
  border-radius: 8px;
  padding: 10px;
}

.fake-data-sql-preview__code.is-wrap {
  white-space: pre-wrap;
  word-break: break-word;
}

.fake-data-btn {
  border-color: rgba(125, 92, 255, 0.35) !important;
}

.fake-data-btn--accent {
  box-shadow: 0 0 0 1px rgba(125, 92, 255, 0.24) inset;
}

.fake-data-btn--danger {
  border-color: rgba(246, 98, 132, 0.45) !important;
  box-shadow: 0 0 0 1px rgba(246, 98, 132, 0.2) inset;
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
