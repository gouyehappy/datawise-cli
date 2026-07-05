<script setup lang="ts">
import {storeToRefs} from 'pinia'
import {DwIcon} from '@/core/icons'
import {useToastStore} from '@/features/layout/stores/toast-store'

const toast = useToastStore()
const {message, variant} = storeToRefs(toast)
</script>

<template>
  <Transition name="app-toast">
    <div
        v-if="message"
        class="app-toast"
        :class="{ 'app-toast--error': variant === 'error' }"
        :role="variant === 'error' ? 'alert' : 'status'"
        :aria-live="variant === 'error' ? 'assertive' : 'polite'"
    >
      <DwIcon
          v-if="variant === 'error'"
          class="app-toast__icon"
          name="alert-circle"
          size="md"
          :stroke-width="1.5"
      />
      <span class="app-toast__text">{{ message }}</span>
    </div>
  </Transition>
</template>

<style scoped>
.app-toast {
  position: fixed;
  left: 50%;
  bottom: calc(var(--dw-status-height) + 14px);
  z-index: 1100;
  transform: translateX(-50%);
  display: inline-flex;
  align-items: flex-start;
  gap: 10px;
  max-width: min(92vw, 480px);
  padding: 11px 16px;
  border-radius: 10px;
  background: color-mix(in srgb, var(--dw-bg) 92%, #fff);
  color: var(--dw-text-secondary);
  font-size: 13px;
  line-height: 1.5;
  box-shadow: var(--dw-menu-shadow);
  border: 1px solid var(--dw-border-light);
  pointer-events: none;
}

.app-toast--error {
  color: #b91c1c;
  background: color-mix(in srgb, #fef2f2 88%, var(--dw-bg));
  border-color: color-mix(in srgb, #fca5a5 55%, var(--dw-border-light));
}

.app-toast__icon {
  flex-shrink: 0;
  margin-top: 1px;
}

.app-toast__text {
  min-width: 0;
}

.app-toast-enter-active,
.app-toast-leave-active {
  transition: opacity 0.2s ease, transform 0.2s ease;
}

.app-toast-enter-from,
.app-toast-leave-to {
  opacity: 0;
  transform: translateX(-50%) translateY(8px);
}
</style>
