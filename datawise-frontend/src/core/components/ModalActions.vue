<script setup lang="ts">
import {useI18n} from 'vue-i18n'
import {DwButton} from '@/core/components'

withDefaults(
    defineProps<{
      cancelLabel?: string
      confirmLabel?: string
      confirmDisabled?: boolean
      confirmLoading?: boolean
      confirmVariant?: 'primary' | 'danger'
    }>(),
    {confirmDisabled: false, confirmLoading: false, confirmVariant: 'primary'},
)

const emit = defineEmits<{
  cancel: []
  confirm: []
}>()

const {t} = useI18n()
</script>

<template>
  <DwButton variant="ghost" type="button" @click="emit('cancel')">
    {{ cancelLabel ?? t('common.cancel') }}
  </DwButton>
  <DwButton
      :variant="confirmVariant"
      type="button"
      :disabled="confirmDisabled"
      :loading="confirmLoading"
      @click="emit('confirm')"
  >
    {{ confirmLabel ?? t('common.save') }}
  </DwButton>
</template>
