<script setup lang="ts">
import {useI18n} from 'vue-i18n'
import type {SessionKillMode} from '@/features/workspace/services/session-kill.service'

defineProps<{
  sessionId: string
  canKill: boolean
  killing?: boolean
}>()

const emit = defineEmits<{
  kill: [mode: SessionKillMode]
}>()

const {t} = useI18n()
</script>

<template>
  <div v-if="canKill" class="session-kill-actions" @click.stop>
    <button
        class="btn-secondary btn-sm"
        type="button"
        :disabled="killing"
        @click="emit('kill', 'query')"
    >
      {{ killing ? t('shortcut.sessionKill.killing') : t('shortcut.sessionKill.killQuery') }}
    </button>
    <button
        class="btn-primary btn-danger btn-sm"
        type="button"
        :disabled="killing"
        @click="emit('kill', 'connection')"
    >
      {{ t('shortcut.sessionKill.killConnection') }}
    </button>
  </div>
</template>

<style scoped>
.session-kill-actions {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: var(--dw-gap-sm);
  padding-top: var(--dw-space-1);
  border-top: 1px solid var(--dw-border-light);
}

</style>
