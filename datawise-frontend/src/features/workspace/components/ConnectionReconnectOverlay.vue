<script setup lang="ts">
import {ref} from 'vue'
import {useI18n} from 'vue-i18n'
import {useExplorerStore} from '@/features/explorer/stores/explorer'
import {useLayoutStore} from '@/features/layout/stores/layout'

const props = defineProps<{
  connectionId: string
  connectionName?: string
}>()

const {t} = useI18n()
const explorer = useExplorerStore()
const layout = useLayoutStore()
const reconnecting = ref(false)

async function onReconnect() {
  if (reconnecting.value) return
  reconnecting.value = true
  try {
    const ok = await explorer.connectConnection(props.connectionId, {notify: true})
    if (ok) {
      layout.showToast(
          t('explorer.connectionReconnected', {
            name: props.connectionName || props.connectionId,
          }),
      )
    }
  } finally {
    reconnecting.value = false
  }
}
</script>

<template>
  <div class="connection-reconnect-overlay" role="dialog" aria-modal="true">
    <div class="connection-reconnect-overlay__panel">
      <div class="connection-reconnect-overlay__copy">
        <p class="connection-reconnect-overlay__title">
          {{ t('explorer.connectionNeedsReconnectTitle') }}
        </p>
        <p class="connection-reconnect-overlay__hint">
          {{ t('explorer.connectionNeedsReconnectHint', {
            name: connectionName || connectionId,
          }) }}
        </p>
      </div>
      <button
          type="button"
          class="connection-reconnect-overlay__btn"
          :disabled="reconnecting"
          @click="onReconnect"
      >
        {{ reconnecting
          ? t('explorer.connectionNeedsReconnectLoading')
          : t('explorer.connectionNeedsReconnectAction') }}
      </button>
    </div>
  </div>
</template>

<style scoped>
.connection-reconnect-overlay {
  position: absolute;
  inset: 0;
  z-index: 20;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 28px;
  box-sizing: border-box;
  /* Full-tab wash: light & translucent so underlying content stays faintly visible */
  background: color-mix(in srgb, #ffffff 72%, transparent);
  backdrop-filter: blur(1.5px);
  pointer-events: auto;
}

.connection-reconnect-overlay__panel {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 14px;
  max-width: 420px;
  width: min(100%, 420px);
  text-align: center;
}

.connection-reconnect-overlay__copy {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.connection-reconnect-overlay__title {
  margin: 0;
  font-size: 15px;
  font-weight: 600;
  letter-spacing: 0.01em;
  color: color-mix(in srgb, var(--dw-text) 88%, transparent);
}

.connection-reconnect-overlay__hint {
  margin: 0;
  font-size: 12px;
  line-height: 1.55;
  color: color-mix(in srgb, var(--dw-text-muted) 92%, transparent);
}

.connection-reconnect-overlay__btn {
  border: 1px solid color-mix(in srgb, var(--dw-primary) 28%, var(--dw-border));
  border-radius: 8px;
  padding: 7px 18px;
  background: color-mix(in srgb, #ffffff 85%, var(--dw-primary) 8%);
  color: var(--dw-primary);
  font-size: 12px;
  font-weight: 600;
  cursor: pointer;
  box-shadow: 0 1px 2px color-mix(in srgb, #000 4%, transparent);
}

.connection-reconnect-overlay__btn:hover:not(:disabled) {
  background: color-mix(in srgb, #ffffff 70%, var(--dw-primary) 12%);
  border-color: color-mix(in srgb, var(--dw-primary) 42%, var(--dw-border));
}

.connection-reconnect-overlay__btn:disabled {
  opacity: 0.7;
  cursor: wait;
}
</style>
