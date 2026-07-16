<script setup lang="ts">
import {computed, ref, watch} from 'vue'
import {useI18n} from 'vue-i18n'
import {AppModal, DwInlineAlert, ModalActions} from '@/core/components'
import {
    MAX_RESULT_ROWS_MAX,
    MAX_RESULT_ROWS_MIN,
} from '@/features/settings/constants/editor-presets'
import {
    createDefaultSqlExportWizardForm,
    type SqlExportWizardContext,
    type SqlExportWizardForm,
    validateSqlExportWizardForm,
} from '@/features/explorer/services/sql-export-wizard.service'

const props = defineProps<{
    open: boolean
    context: SqlExportWizardContext | null
    maxRowsDefault: number
    exporting?: boolean
}>()

const emit = defineEmits<{
    'update:open': [value: boolean]
    export: [form: SqlExportWizardForm]
}>()

const {t} = useI18n()

const form = ref<SqlExportWizardForm>(createDefaultSqlExportWizardForm(props.maxRowsDefault))

const scopeLabel = computed(() => {
    const ctx = props.context
    if (!ctx) return ''
    if (ctx.scope === 'table') {
        return t('explorer.sqlExportWizard.scopeTable', {table: ctx.tableName ?? '—'})
    }
    return t('explorer.sqlExportWizard.scopeDatabase', {
        database: ctx.database,
        count: ctx.tableCount ?? 0,
    })
})

const connectionLabel = computed(() => props.context?.connectionLabel ?? props.context?.connectionId ?? '—')

const validationError = computed(() => {
    const code = validateSqlExportWizardForm(form.value)
    return code ? t(`explorer.sqlExportWizard.errors.${code}`) : null
})

const canExport = computed(() => !validationError.value && !props.exporting)

watch(
    () => props.open,
    (open) => {
        if (!open) return
        form.value = createDefaultSqlExportWizardForm(props.maxRowsDefault)
    },
)

function close() {
    emit('update:open', false)
}

function submit() {
    if (!canExport.value) return
    emit('export', {...form.value})
}
</script>

<template>
  <AppModal
      :open="open"
      :title="t('explorer.sqlExportWizard.title')"
      :subtitle="t('explorer.sqlExportWizard.subtitle')"
      width="520px"
      @close="close"
  >
    <form class="modal-form modal-form--compact" @submit.prevent="submit">
      <section class="modal-summary-box">
        <div class="modal-summary-row">
          <span class="modal-summary-row__label">{{ t('explorer.sqlExportWizard.connection') }}</span>
          <span class="modal-summary-row__value">{{ connectionLabel }}</span>
        </div>
        <div class="modal-summary-row">
          <span class="modal-summary-row__label">{{ t('explorer.sqlExportWizard.scope') }}</span>
          <span class="modal-summary-row__value">{{ scopeLabel }}</span>
        </div>
      </section>

      <fieldset class="modal-fieldset">
        <legend>{{ t('explorer.sqlExportWizard.content') }}</legend>
        <label class="modal-radio-option">
          <input v-model="form.contentMode" type="radio" value="structure">
          <span>
            <strong>{{ t('explorer.sqlExportWizard.contentStructure') }}</strong>
            <span class="hint">{{ t('explorer.sqlExportWizard.contentStructureHint') }}</span>
          </span>
        </label>
        <label class="modal-radio-option">
          <input v-model="form.contentMode" type="radio" value="structureAndData">
          <span>
            <strong>{{ t('explorer.sqlExportWizard.contentStructureAndData') }}</strong>
            <span class="hint">{{ t('explorer.sqlExportWizard.contentStructureAndDataHint') }}</span>
          </span>
        </label>
      </fieldset>

      <label
          v-if="form.contentMode === 'structureAndData'"
          class="modal-inline-field"
      >
        <span>{{ t('explorer.sqlExportWizard.maxRows') }}</span>
        <input
            v-model.number="form.maxRows"
            class="dw-input"
            type="number"
            :min="MAX_RESULT_ROWS_MIN"
            :max="MAX_RESULT_ROWS_MAX"
        >
        <span class="modal-hint">{{ t('explorer.sqlExportWizard.maxRowsHint') }}</span>
      </label>

      <fieldset class="modal-fieldset">
        <legend>{{ t('explorer.sqlExportWizard.output') }}</legend>
        <label class="modal-radio-option">
          <input v-model="form.output" type="radio" value="download">
          <span>{{ t('explorer.sqlExportWizard.outputDownload') }}</span>
        </label>
        <label class="modal-radio-option">
          <input v-model="form.output" type="radio" value="clipboard">
          <span>{{ t('explorer.sqlExportWizard.outputClipboard') }}</span>
        </label>
      </fieldset>

      <DwInlineAlert :message="validationError"/>
    </form>

    <template #footer>
      <ModalActions
          :confirm-label="exporting ? t('explorer.sqlExportWizard.exporting') : t('explorer.sqlExportWizard.export')"
          :confirm-disabled="!canExport"
          @cancel="close"
          @confirm="submit"
      />
    </template>
  </AppModal>
</template>
