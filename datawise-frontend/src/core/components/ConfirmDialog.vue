<script setup lang="ts">
import {AppModal, ModalActions} from '@/core/components'

defineProps<{
  open: boolean
  title: string
  message: string
  confirmLabel?: string
  confirmLoading?: boolean
}>()

const emit = defineEmits<{
  'update:open': [value: boolean]
  confirm: []
}>()

function close() {
  emit('update:open', false)
}

function onConfirm() {
  emit('confirm')
}
</script>

<template>
  <AppModal :open="open" :title="title" width="420px" @close="close">
    <p class="modal-message confirm-dialog__message">{{ message }}</p>

    <template #footer>
      <ModalActions
          :confirm-label="confirmLabel"
          :confirm-loading="confirmLoading"
          @cancel="close"
          @confirm="onConfirm"
      />
    </template>
  </AppModal>
</template>

<style scoped>
.confirm-dialog__message {
  white-space: pre-line;
}
</style>
