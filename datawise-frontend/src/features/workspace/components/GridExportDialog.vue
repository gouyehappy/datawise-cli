<script setup lang="ts">
import {computed, ref, watch} from 'vue'
import {useI18n} from 'vue-i18n'
import type {TableColumn} from '@/core/types'
import {AppModal, CollapsibleSection, ModalActions} from '@/core/components'
import DwSelect from '@/core/components/DwSelect.vue'
import type {SelectOption} from '@/core/components/select.types'
import type {GridExportFormat} from '@/features/workspace/services/grid-export.service'
import {
    createDefaultExportMaskConfig,
    type DataMaskTemplate,
    type ExportColumnMaskRule,
    type GridExportMaskConfig,
} from '@/features/workspace/services/data-masking.service'

const props = defineProps<{
    open: boolean
    columns: TableColumn[]
    suggestMask?: boolean
    maskExportEnabled?: boolean
    exporting?: boolean
    /** Result hit a hard row cap (federated JOIN / maxRows) — export is incomplete. */
    truncatedAtCap?: boolean
}>()

const emit = defineEmits<{
    'update:open': [value: boolean]
    export: [payload: { format: GridExportFormat; mask?: GridExportMaskConfig; incomplete?: boolean }]
}>()

const {t} = useI18n()

const EXPORT_FORMATS: GridExportFormat[] = ['csv', 'xlsx', 'json', 'tsv', 'sql']

const format = ref<GridExportFormat>('csv')
const maskEnabled = ref(false)
const columnRules = ref<ExportColumnMaskRule[]>([])

const formatOptions = computed<SelectOption[]>(() =>
    EXPORT_FORMATS.map((item) => ({
        value: item,
        label: t(`dataGrid.exportFormats.${item}`),
    })),
)

const templateOptions = computed<SelectOption[]>(() => [
    {value: 'phone', label: t('dataGrid.exportMask.templates.phone')},
    {value: 'email', label: t('dataGrid.exportMask.templates.email')},
    {value: 'idCard', label: t('dataGrid.exportMask.templates.idCard')},
])

const enabledColumnCount = computed(() => columnRules.value.filter((rule) => rule.enabled).length)

const showMaskSection = computed(() => props.maskExportEnabled !== false)

const canExport = computed(() => props.columns.length > 0 && !props.exporting)

watch(
    () => props.open,
    (open) => {
        if (!open) return
        format.value = 'csv'
        const defaults = createDefaultExportMaskConfig(
            props.columns,
            showMaskSection.value && (props.suggestMask ?? false),
        )
        maskEnabled.value = defaults.enabled
        columnRules.value = defaults.columns.map((rule) => ({...rule}))
    },
)

function close() {
    emit('update:open', false)
}

function toggleColumnRule(columnName: string, checked: boolean) {
    columnRules.value = columnRules.value.map((rule) =>
        rule.columnName === columnName ? {...rule, enabled: checked} : rule,
    )
}

function updateColumnTemplate(columnName: string, template: DataMaskTemplate) {
    columnRules.value = columnRules.value.map((rule) =>
        rule.columnName === columnName ? {...rule, template} : rule,
    )
}

function submit() {
    if (!canExport.value) return
    const mask: GridExportMaskConfig | undefined = maskEnabled.value
        ? {
            enabled: true,
            columns: columnRules.value.map((rule) => ({...rule})),
        }
        : undefined
    emit('export', {
        format: format.value,
        mask,
        incomplete: props.truncatedAtCap === true,
    })
    close()
}
</script>

<template>
  <AppModal
      :open="open"
      :title="t('dataGrid.exportDialog.title')"
      :subtitle="t('dataGrid.exportDialog.subtitle')"
      width="560px"
      @close="close"
  >
    <label class="modal-field">
      <span>{{ t('dataGrid.exportDialog.format') }}</span>
      <DwSelect v-model="format" size="sm" :options="formatOptions"/>
    </label>

    <p v-if="truncatedAtCap" class="modal-warn-box" role="status">
      {{ t('dataGrid.exportDialog.truncatedWarning') }}
    </p>

    <CollapsibleSection
        v-if="showMaskSection"
        :title="t('dataGrid.exportMask.title')"
        :description="t('dataGrid.exportMask.description')"
        :default-open="suggestMask"
        joined="single"
    >
      <p v-if="suggestMask" class="modal-warn-box">{{ t('dataGrid.exportMask.prodHint') }}</p>

      <label class="modal-check-toggle">
        <input v-model="maskEnabled" type="checkbox"/>
        <span>{{ t('dataGrid.exportMask.enable') }}</span>
      </label>

      <div v-if="maskEnabled" class="modal-check-list">
        <header class="modal-check-list__head">
          <span>{{ t('dataGrid.exportMask.columns') }}</span>
          <span>{{ t('dataGrid.exportMask.selectedCount', {count: enabledColumnCount}) }}</span>
        </header>
        <ul class="modal-check-list__items">
          <li v-for="rule in columnRules" :key="rule.columnName">
            <label class="modal-check-row">
              <input
                  type="checkbox"
                  :checked="rule.enabled"
                  @change="toggleColumnRule(rule.columnName, ($event.target as HTMLInputElement).checked)"
              />
              <span class="modal-check-row__name">{{ rule.columnName }}</span>
            </label>
            <DwSelect
                :model-value="rule.template"
                size="sm"
                :disabled="!rule.enabled"
                :options="templateOptions"
                @update:model-value="updateColumnTemplate(rule.columnName, $event as DataMaskTemplate)"
            />
          </li>
        </ul>
      </div>
    </CollapsibleSection>

    <template #footer>
      <ModalActions
          :cancel-label="t('common.cancel')"
          :confirm-label="exporting ? t('dataGrid.exportDialog.exporting') : t('dataGrid.exportDialog.export')"
          :confirm-disabled="!canExport"
          @cancel="close"
          @confirm="submit"
      />
    </template>
  </AppModal>
</template>
