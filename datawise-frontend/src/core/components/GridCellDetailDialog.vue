<script setup lang="ts">
import {ref, watch} from 'vue'
import {useI18n} from 'vue-i18n'
import {AppModal, DwButton} from '@/core/components'

const props = defineProps<{
  open: boolean
  columnName: string
  rowLabel: string
  content: string
}>()

const emit = defineEmits<{
  close: []
}>()

const {t} = useI18n()
const copied = ref(false)

watch(
    () => props.open,
    (open) => {
        if (!open) copied.value = false
    },
)

async function onCopy() {
  if (!props.content) return
  await navigator.clipboard.writeText(props.content)
  copied.value = true
}
</script>

<template>
  <AppModal
      :open="open"
      :title="t('dataGrid.cellDetailTitle', { column: columnName })"
      :subtitle="rowLabel"
      width="min(920px, 92vw)"
      @close="emit('close')"
  >
    <pre class="modal-code-block modal-code-block--scroll">{{ content || t('common.nullValue') }}</pre>

    <template #footer>
      <DwButton variant="ghost" type="button" @click="emit('close')">
        {{ t('common.close') }}
      </DwButton>
      <DwButton variant="primary" type="button" :disabled="!content" @click="onCopy">
        {{ copied ? t('dataGrid.cellDetailCopied') : t('dataGrid.cellDetailCopy') }}
      </DwButton>
    </template>
  </AppModal>
</template>
