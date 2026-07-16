<script setup lang="ts">
import {computed, ref, watch} from 'vue'
import {useI18n} from 'vue-i18n'
import {AppModal, FormField, ModalActions} from '@/core/components'
import type {TableColumn, TableRow} from '@/core/types'
import {
    buildResultDmlSql,
    type ResultDmlKind,
} from '@/features/workspace/services/result-dml.service'
import {useLayoutStore} from '@/features/layout/stores/layout'

const props = defineProps<{
  open: boolean
  columns: TableColumn[]
  rows: TableRow[]
  defaultTableName?: string
  pkColumns?: string[]
}>()

const emit = defineEmits<{
  'update:open': [value: boolean]
}>()

const {t} = useI18n()
const layout = useLayoutStore()

const tableName = ref('')
const kind = ref<ResultDmlKind>('insert')
const pkInput = ref('')

const kindOptions: ResultDmlKind[] = ['insert', 'update', 'delete']

watch(
    () => props.open,
    (open) => {
        if (!open) return
        tableName.value = props.defaultTableName?.trim() || 'query_result'
        kind.value = 'insert'
        pkInput.value = props.pkColumns?.join(', ') ?? inferPkFromColumns(props.columns)
    },
)

function inferPkFromColumns(columns: TableColumn[]): string {
    const idCol = columns.find((col) => /^(id|.+_id)$/i.test(col.name))
    return idCol?.name ?? ''
}

const rowCount = computed(() => props.rows.length)

const generatedSql = computed(() =>
    buildResultDmlSql(
        kind.value,
        props.columns,
        props.rows,
        tableName.value,
        pkInput.value
            .split(',')
            .map((item) => item.trim())
            .filter(Boolean),
    ),
)

const needsPk = computed(() => kind.value !== 'insert')

const scopeHint = computed(() =>
    t('console.generateDml.scopeRows', {count: rowCount.value}),
)

function close() {
  emit('update:open', false)
}

async function copySql() {
  await navigator.clipboard.writeText(generatedSql.value)
  layout.showSuccessToast(t('console.generateDml.copied'))
}
</script>

<template>
  <AppModal
      :open="open"
      :title="t('console.generateDml.title')"
      :subtitle="scopeHint"
      width="680px"
      @close="close"
  >
    <div class="modal-form">
      <div class="modal-segment" role="tablist">
        <button
            v-for="option in kindOptions"
            :key="option"
            type="button"
            class="modal-segment__btn"
            :class="{ 'is-active': kind === option }"
            role="tab"
            :aria-selected="kind === option"
            @click="kind = option"
        >
          {{ t(`console.generateDml.${option}`) }}
        </button>
      </div>

      <div class="modal-form-grid">
        <FormField :label="t('console.generateDml.tableName')">
          <template #default="{ id }">
            <input :id="id" v-model="tableName" class="dw-input" type="text" />
          </template>
        </FormField>
        <FormField v-if="needsPk" :label="t('console.generateDml.pkColumns')">
          <template #default="{ id }">
            <input :id="id" v-model="pkInput" class="dw-input" type="text" placeholder="id" />
          </template>
        </FormField>
      </div>

      <p class="modal-body-hint">{{ t('console.generateDml.hint') }}</p>

      <section class="modal-preview-section">
        <header class="modal-preview-section__head">
          <span>{{ t('console.generateDml.preview') }}</span>
          <span class="modal-preview-section__meta">{{ rowCount }} {{ t('console.generateDml.rowsShort') }}</span>
        </header>
        <pre class="modal-code-block modal-code-block--preview">{{ generatedSql }}</pre>
      </section>
    </div>

    <template #footer>
      <ModalActions
          :cancel-label="t('common.cancel')"
          :confirm-label="t('console.generateDml.copy')"
          @cancel="close"
          @confirm="copySql"
      />
    </template>
  </AppModal>
</template>
