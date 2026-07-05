<script setup lang="ts">
import {nextTick, ref, watch} from 'vue'
import {AppModal, FormField, ModalActions} from '@/core/components'

const props = defineProps<{
  open: boolean
  title: string
  subtitle?: string
  label: string
  defaultValue?: string
  placeholder?: string
  requiredMessage?: string
  confirmLabel?: string
  cancelLabel?: string
}>()

const emit = defineEmits<{
  'update:open': [value: boolean]
  confirm: [value: string]
}>()

const value = ref('')
const error = ref('')
const inputRef = ref<HTMLInputElement>()

watch(
    () => props.open,
    async (isOpen) => {
      if (!isOpen) return
      value.value = props.defaultValue ?? ''
      error.value = ''
      await nextTick()
      inputRef.value?.focus()
      inputRef.value?.select()
    },
)

function close() {
  emit('update:open', false)
}

function submit() {
  const text = value.value.trim()
  if (!text) {
    error.value = props.requiredMessage ?? ''
    return
  }
  emit('confirm', text)
  close()
}

function onKeydown(e: KeyboardEvent) {
  if (e.key === 'Enter') {
    e.preventDefault()
    submit()
  }
}
</script>

<template>
  <AppModal :open="open" :title="title" :subtitle="subtitle" width="400px" @close="close">
    <form class="modal-form" @submit.prevent="submit">
      <FormField :label="label">
        <template #default="{ id }">
          <input
              :id="id"
              ref="inputRef"
              v-model="value"
              class="dw-input"
              type="text"
              :placeholder="placeholder"
              @keydown="onKeydown"
          />
        </template>
      </FormField>
      <p v-if="error" class="dw-form-error" role="alert">{{ error }}</p>
    </form>

    <template #footer>
      <ModalActions
          :cancel-label="cancelLabel"
          :confirm-label="confirmLabel"
          @cancel="close"
          @confirm="submit"
      />
    </template>
  </AppModal>
</template>
