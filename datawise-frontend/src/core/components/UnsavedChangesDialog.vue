<script setup lang="ts">
import {useI18n} from 'vue-i18n'
import {AppModal, DwButton} from '@/core/components'

defineProps<{
  open: boolean
  title: string
  message: string
}>()

const emit = defineEmits<{
  'update:open': [value: boolean]
  save: []
  discard: []
  cancel: []
}>()

const {t} = useI18n()

function onSave() {
  emit('update:open', false)
  emit('save')
}

function onDiscard() {
  emit('update:open', false)
  emit('discard')
}

function onCancel() {
  emit('update:open', false)
  emit('cancel')
}
</script>

<template>
  <AppModal :open="open" :title="title" width="420px" @close="onCancel">
    <p class="modal-message">{{ message }}</p>

    <template #footer>
      <DwButton variant="ghost" type="button" @click="onDiscard">
        {{ t('workspace.unsavedDiscard') }}
      </DwButton>
      <DwButton variant="ghost" type="button" @click="onCancel">
        {{ t('common.cancel') }}
      </DwButton>
      <DwButton variant="primary" type="button" @click="onSave">
        {{ t('workspace.unsavedSave') }}
      </DwButton>
    </template>
  </AppModal>
</template>
