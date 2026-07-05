<script setup lang="ts">
import {computed} from 'vue'
import {useI18n} from 'vue-i18n'
import {AppModal, ModalActions} from '@/core/components'
import {DwIcon} from '@/core/icons'
import type {SessionKillMode} from '@/features/workspace/services/session-kill.service'

const props = defineProps<{
  open: boolean
  sessionId: string
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
        ? t('shortcut.sessionKill.dialogTitleConnection')
        : t('shortcut.sessionKill.dialogTitleQuery'),
)

const message = computed(() =>
    isConnectionKill.value
        ? t('shortcut.sessionKill.dialogBodyConnection', {id: props.sessionId})
        : t('shortcut.sessionKill.dialogBodyQuery', {id: props.sessionId}),
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
          {{ t('shortcut.sessionKill.dialogHintConnection') }}
        </p>
      </div>
    </div>

    <template #footer>
      <ModalActions
          :confirm-label="loading ? t('shortcut.sessionKill.killing') : t('shortcut.sessionKill.confirmAction')"
          confirm-variant="danger"
          :confirm-disabled="loading"
          @cancel="emit('cancel')"
          @confirm="emit('confirm')"
      />
    </template>
  </AppModal>
</template>
