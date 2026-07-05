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
        class="session-kill-actions__btn"
        type="button"
        :disabled="killing"
        @click="emit('kill', 'query')"
    >
      {{ killing ? t('shortcut.sessionKill.killing') : t('shortcut.sessionKill.killQuery') }}
    </button>
    <button
        class="session-kill-actions__btn session-kill-actions__btn--danger"
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
  gap: 6px;
  padding-top: 2px;
  border-top: 1px solid var(--dw-border-light);
}

.session-kill-actions__btn {
  padding: 6px 8px;
  border: 1px solid var(--dw-border-light);
  border-radius: 8px;
  background: var(--dw-bg-muted);
  color: var(--dw-text-secondary);
  font-size: 10px;
  font-weight: 600;
  line-height: 1.3;
  cursor: pointer;
}

.session-kill-actions__btn:disabled {
  opacity: 0.55;
  cursor: not-allowed;
}

.session-kill-actions__btn--danger {
  border-color: color-mix(in srgb, #dc2626 20%, var(--dw-border-light));
  background: color-mix(in srgb, #dc2626 6%, var(--dw-bg-muted));
  color: #b91c1c;
}
</style>
