<script setup lang="ts">
import {computed, ref, watch} from 'vue'
import {useI18n} from 'vue-i18n'
import {AppModal, DwButton, DwInlineAlert} from '@/core/components'
import {
    formatJsonEditorText,
    validateJsonEditorText,
    type GridCellEditorKind,
} from '@/features/workspace/services/grid-cell-editor.service'

const props = withDefaults(
    defineProps<{
      open: boolean
      columnName: string
      rowLabel: string
      content: string
      title?: string
      editable?: boolean
      editorKind?: GridCellEditorKind
    }>(),
    {
      editable: false,
      editorKind: 'longText',
    },
)

const emit = defineEmits<{
  close: []
  apply: [value: string]
}>()

const {t} = useI18n()
const copied = ref(false)
const draft = ref('')
const jsonError = ref<string | null>(null)

const isJsonEditor = computed(() => props.editorKind === 'json')
const isBinaryPreview = computed(() => props.editorKind === 'binary')
const canEdit = computed(() => props.editable && !isBinaryPreview.value)

watch(
    () => [props.open, props.content] as const,
    ([open]) => {
        if (!open) {
            copied.value = false
            jsonError.value = null
            return
        }
        draft.value = props.content
        jsonError.value = null
    },
    {immediate: true},
)

async function onCopy() {
  const text = canEdit.value ? draft.value : props.content
  if (!text) return
  await navigator.clipboard.writeText(text)
  copied.value = true
}

function onFormatJson() {
  if (!isJsonEditor.value) return
  const errorKey = validateJsonEditorText(draft.value)
  if (errorKey) {
    jsonError.value = errorKey
    return
  }
  try {
    draft.value = formatJsonEditorText(draft.value)
    jsonError.value = null
  } catch {
    jsonError.value = 'invalidJson'
  }
}

function onApply() {
  if (!canEdit.value) return
  if (isJsonEditor.value) {
    const errorKey = validateJsonEditorText(draft.value)
    if (errorKey) {
      jsonError.value = errorKey
      return
    }
    try {
      emit('apply', formatJsonEditorText(draft.value))
      return
    } catch {
      jsonError.value = 'invalidJson'
      return
    }
  }
  emit('apply', draft.value)
}
</script>

<template>
  <AppModal
      :open="open"
      :title="title || t('dataGrid.cellDetailTitle', { column: columnName })"
      :subtitle="rowLabel"
      width="min(920px, 92vw)"
      max-height="85vh"
      @close="emit('close')"
  >
    <div class="cell-detail-body">
      <DwInlineAlert
          v-if="jsonError"
          density="banner"
          variant="error"
          :message="t(`dataGrid.cellEditor.${jsonError}`)"
      />
      <p v-if="isBinaryPreview" class="cell-detail-hint">
        {{ t('dataGrid.cellEditor.binaryHint') }}
      </p>

      <textarea
          v-if="canEdit"
          v-model="draft"
          class="cell-detail-editor"
          :class="{ 'cell-detail-editor--json': isJsonEditor }"
          spellcheck="false"
      />
      <pre v-else class="modal-code-block modal-code-block--scroll">{{ content || t('common.nullValue') }}</pre>
    </div>

    <template #footer>
      <DwButton v-if="isJsonEditor && canEdit" variant="ghost" type="button" @click="onFormatJson">
        {{ t('dataGrid.cellEditor.formatJson') }}
      </DwButton>
      <DwButton variant="ghost" type="button" @click="emit('close')">
        {{ t('common.close') }}
      </DwButton>
      <DwButton variant="ghost" type="button" :disabled="!(canEdit ? draft : content)" @click="onCopy">
        {{ copied ? t('dataGrid.cellDetailCopied') : t('dataGrid.cellDetailCopy') }}
      </DwButton>
      <DwButton v-if="canEdit" variant="primary" type="button" @click="onApply">
        {{ t('dataGrid.cellEditor.apply') }}
      </DwButton>
    </template>
  </AppModal>
</template>

<style scoped>
.cell-detail-body {
  display: grid;
  gap: var(--dw-space-3);
}

.cell-detail-hint {
  margin: 0;
  font-size: var(--dw-text-xs);
  color: var(--dw-text-muted);
}

.cell-detail-editor {
  width: 100%;
  min-height: 280px;
  max-height: 55vh;
  padding: var(--dw-space-4);
  border: 1px solid var(--dw-border-light);
  border-radius: var(--dw-radius-md);
  background: var(--dw-bg-panel);
  color: var(--dw-text-primary);
  font-size: var(--dw-text-sm);
  font-family: var(--dw-mono);
  line-height: var(--dw-leading-relaxed);
  resize: vertical;
}

.cell-detail-editor--json {
  tab-size: 2;
}
</style>
