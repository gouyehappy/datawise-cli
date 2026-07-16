<script setup lang="ts">
import {reactive, ref, watch} from 'vue'
import {useI18n} from 'vue-i18n'
import {AppModal, DwInput, DwSecretInput, FormField, ModalActions, DwInlineAlert} from '@/core/components'
import {useAuthStore} from '@/features/auth/stores/auth-store'
import {useAppToast} from '@/features/layout/composables/useAppToast'

const props = defineProps<{ open: boolean }>()
const emit = defineEmits<{ 'update:open': [value: boolean]; success: [] }>()

const {t} = useI18n()
const auth = useAuthStore()
const toast = useAppToast()

const loading = ref(false)
const isDev = import.meta.env.DEV

const form = reactive({
  userName: isDev ? 'admin' : '',
  userPassword: '',
})

const errors = reactive({
  userName: '',
  userPassword: '',
  form: '',
})

watch(
    () => props.open,
    (isOpen) => {
      if (!isOpen) return
      errors.userName = ''
      errors.userPassword = ''
      errors.form = ''
      form.userPassword = ''
      if (!form.userName && isDev) form.userName = 'admin'
    },
)

function close() {
  emit('update:open', false)
}

function clearErrors() {
  errors.userName = ''
  errors.userPassword = ''
  errors.form = ''
}

function validateForm(): boolean {
  clearErrors()
  let valid = true
  if (!form.userName.trim()) {
    errors.userName = t('auth.usernameRequired')
    valid = false
  }
  if (!form.userPassword) {
    errors.userPassword = t('auth.passwordRequired')
    valid = false
  }
  return valid
}

function resolveErrorMessage(err: unknown): string {
  if (err instanceof Error) {
    if (err.message === 'INVALID_CREDENTIALS') return t('auth.invalidCredentials')
    return err.message
  }
  return t('auth.failed')
}

async function handleSubmit() {
  if (loading.value) return
  if (!validateForm()) return

  loading.value = true
  clearErrors()
  try {
    await auth.login(form.userName.trim(), form.userPassword)
    toast.success(t('auth.success'))
    emit('success')
    close()
  } catch (err) {
    errors.form = resolveErrorMessage(err)
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <AppModal
      :open="open"
      :title="t('auth.dialogTitle')"
      :subtitle="t('auth.dialogSubtitle')"
      width="420px"
      @close="close"
  >
    <form class="modal-form" @submit.prevent="handleSubmit">
      <FormField :label="t('auth.usernameLabel')" input-id="login-dialog-username" :error="errors.userName">
        <template #default="{ id }">
          <DwInput
              :id="id"
              v-model="form.userName"
              type="text"
              autocomplete="username"
              :placeholder="t('auth.usernamePlaceholder')"
          />
        </template>
      </FormField>

      <FormField :label="t('auth.passwordLabel')" input-id="login-dialog-password" :error="errors.userPassword">
        <template #default="{ id }">
          <DwSecretInput
              :id="id"
              v-model="form.userPassword"
              autocomplete="current-password"
              :placeholder="t('auth.passwordPlaceholder')"
              @keyup.enter="handleSubmit"
          />
        </template>
      </FormField>

      <DwInlineAlert :message="errors.form"/>
      <p v-if="isDev" class="modal-body-hint">{{ t('auth.defaultHint') }}</p>
    </form>

    <template #footer>
      <ModalActions
          :confirm-label="loading ? '…' : t('auth.submit')"
          :cancel-label="t('common.cancel')"
          :confirm-disabled="loading"
          @cancel="close"
          @confirm="handleSubmit"
      />
    </template>
  </AppModal>
</template>
