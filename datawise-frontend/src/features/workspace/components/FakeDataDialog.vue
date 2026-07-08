<script setup lang="ts">
import {computed, ref, watch} from 'vue'
import {useI18n} from 'vue-i18n'
import {AppModal, DwButton, FormField} from '@/core/components'
import type {TablePropertiesResult} from '@/shared/api/types'
import {
    buildFakeDataRows,
    clampFakeDataRowCount,
    columnsForFakeInsert,
    FAKE_DATA_DEFAULT_ROWS,
    FAKE_DATA_MAX_ROWS,
    FAKE_DATA_PREVIEW_ROWS,
} from '@/features/workspace/services/fake-data.service'

const props = defineProps<{
  open: boolean
  loading?: boolean
  executing?: boolean
  tableName?: string
  properties: TablePropertiesResult | null
  canExecute?: boolean
  executeDisabledHint?: string
}>()

const emit = defineEmits<{
  'update:open': [value: boolean]
  execute: [rowCount: number]
  export: [rowCount: number]
}>()

const {t} = useI18n()
const rowCount = ref(FAKE_DATA_DEFAULT_ROWS)
const rowCountError = ref('')

const insertColumns = computed(() =>
    props.properties ? columnsForFakeInsert(props.properties.columns) : [],
)

const previewRows = computed(() => {
    if (!props.properties || !insertColumns.value.length) return []
    return buildFakeDataRows(props.properties, FAKE_DATA_PREVIEW_ROWS)
})

const previewColumnNames = computed(() => insertColumns.value.map((column) => column.name))

watch(
    () => props.open,
    (isOpen) => {
      if (!isOpen) return
      rowCount.value = FAKE_DATA_DEFAULT_ROWS
      rowCountError.value = ''
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
</script>

<template>
  <AppModal
      :open="open"
      :title="t('workspace.fakeData.title', {table: tableName || '—'})"
      :subtitle="t('workspace.fakeData.subtitle')"
      width="720px"
      @close="close"
  >
    <div v-if="loading" class="modal-empty-state">
      {{ t('workspace.fakeData.loading') }}
    </div>

    <div v-else-if="!insertColumns.length" class="modal-empty-state">
      {{ t('workspace.fakeData.noColumns') }}
    </div>

    <div v-else class="modal-form modal-form--compact">
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
      <p v-if="rowCountError" class="dw-form-error" role="alert">{{ rowCountError }}</p>
      <p class="modal-body-hint">
        {{ t('workspace.fakeData.columnHint', {count: insertColumns.length}) }}
      </p>
      <p class="modal-body-hint">
        {{ t('workspace.fakeData.previewHint', {preview: FAKE_DATA_PREVIEW_ROWS, max: FAKE_DATA_MAX_ROWS}) }}
      </p>
      <p class="modal-body-hint">
        {{ t('workspace.fakeData.auditHint') }}
      </p>

      <div>
        <div class="modal-data-table__head">
          {{ t('workspace.fakeData.previewTitle') }}
        </div>
        <div class="modal-data-table-wrap">
          <table class="modal-data-table">
            <thead>
              <tr>
                <th v-for="column in previewColumnNames" :key="column">{{ column }}</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="(row, rowIndex) in previewRows" :key="rowIndex">
                <td v-for="column in previewColumnNames" :key="column">
                  {{ row[column] ?? 'NULL' }}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
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
