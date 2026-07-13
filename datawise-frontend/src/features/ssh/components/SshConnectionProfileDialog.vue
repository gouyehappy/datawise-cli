<script setup lang="ts">
import {ref, watch} from 'vue'
import {AppModal, FormField, ModalActions} from '@/core/components'
import type {MyCommandMode} from '@/features/ssh/services/ssh-my-commands.service'
import type {SshConnectionProfile} from '@/features/ssh/services/ssh-connection-profile.service'

const props = defineProps<{
  open: boolean
  title: string
  subtitle?: string
  profile: SshConnectionProfile
  confirmLabel?: string
  cancelLabel?: string
  tabNoteLabel: string
  onConnectLabel: string
  onConnectModeLabel: string
  defaultCwdLabel: string
  runModeLabel: string
  pasteModeLabel: string
}>()

const emit = defineEmits<{
  'update:open': [value: boolean]
  confirm: [profile: SshConnectionProfile]
}>()

const tabNote = ref('')
const onConnectCommand = ref('')
const onConnectMode = ref<MyCommandMode>('paste')
const defaultCwd = ref('')

watch(
    () => props.open,
    (isOpen) => {
      if (!isOpen) return
      tabNote.value = props.profile.tabNote ?? ''
      onConnectCommand.value = props.profile.onConnectCommand ?? ''
      onConnectMode.value = props.profile.onConnectMode ?? 'paste'
      defaultCwd.value = props.profile.defaultCwd ?? ''
    },
)

function close() {
  emit('update:open', false)
}

function submit() {
  emit('confirm', {
    tabNote: tabNote.value.trim() || undefined,
    onConnectCommand: onConnectCommand.value.trim() || undefined,
    onConnectMode: onConnectMode.value,
    defaultCwd: defaultCwd.value.trim() || undefined,
  })
  close()
}
</script>

<template>
  <AppModal :open="open" :title="title" :subtitle="subtitle" width="480px" @close="close">
    <form class="modal-form" @submit.prevent="submit">
      <FormField :label="tabNoteLabel">
        <template #default="{ id }">
          <input :id="id" v-model="tabNote" class="dw-input" type="text">
        </template>
      </FormField>
      <FormField :label="defaultCwdLabel">
        <template #default="{ id }">
          <input :id="id" v-model="defaultCwd" class="dw-input" type="text" placeholder="/var/log">
        </template>
      </FormField>
      <FormField :label="onConnectLabel">
        <template #default="{ id }">
          <textarea :id="id" v-model="onConnectCommand" class="dw-input ssh-profile__textarea" rows="3" />
        </template>
      </FormField>
      <FormField :label="onConnectModeLabel">
        <template #default="{ id }">
          <select :id="id" v-model="onConnectMode" class="dw-input">
            <option value="paste">{{ pasteModeLabel }}</option>
            <option value="run">{{ runModeLabel }}</option>
          </select>
        </template>
      </FormField>
    </form>

    <template #footer>
      <ModalActions
          :confirm-label="confirmLabel"
          :cancel-label="cancelLabel"
          @confirm="submit"
          @cancel="close"
      />
    </template>
  </AppModal>
</template>

<style scoped>
.ssh-profile__textarea {
  min-height: 72px;
  resize: vertical;
  font-family: inherit;
}
</style>
