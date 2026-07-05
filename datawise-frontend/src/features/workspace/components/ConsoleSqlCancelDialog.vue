<script setup lang="ts">
import {computed} from 'vue'
import {useI18n} from 'vue-i18n'
import {AppModal, ModalActions} from '@/core/components'
import {DwIcon} from '@/core/icons'
import type {SessionKillMode} from '@/features/workspace/services/session-kill.service'

const props = defineProps<{
  open: boolean
  mode: SessionKillMode
  loading?: boolean
}>()

const emit = defineEmits<{
  confirm: []
  cancel: []
}>()

const {t} = useI18n()

const isConnectionKill = computed(() => props.mode === 'connection')

const title = computed(() =>
    isConnectionKill.value
        ? t('console.cancelExecution.dialogTitleConnection')
        : t('console.cancelExecution.dialogTitleQuery'),
)

const message = computed(() =>
    isConnectionKill.value
        ? t('console.cancelExecution.dialogBodyConnection')
        : t('console.cancelExecution.dialogBodyQuery'),
)
</script>

<template>
  <AppModal
      :open="open"
      :title="title"
      width="480px"
      @close="emit('cancel')"
  >
    <div class="modal-alert-banner" :class="{ 'modal-alert-banner--danger': isConnectionKill }">
      <div class="modal-alert-banner__icon" aria-hidden="true">
        <DwIcon name="alert-triangle" :size="20" danger :stroke-width="1.6"/>
      </div>
      <div>
        <p class="modal-message">{{ message }}</p>
        <p v-if="isConnectionKill" class="modal-body-hint">
          {{ t('console.cancelExecution.dialogHintConnection') }}
        </p>
      </div>
    </div>

    <template #footer>
      <ModalActions
          :confirm-label="loading ? t('console.cancelExecution.cancelling') : t('console.cancelExecution.confirmAction')"
          confirm-variant="danger"
          :confirm-disabled="loading"
          @cancel="emit('cancel')"
          @confirm="emit('confirm')"
      />
    </template>
  </AppModal>
</template>
