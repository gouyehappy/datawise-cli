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
  z-index: var(--dw-z-modal);
  transform: translateX(-50%);
  display: inline-flex;
  align-items: flex-start;
  gap: var(--dw-gap-md);
  max-width: min(92vw, 480px);
  padding: var(--dw-space-5) var(--dw-space-8);
  border-radius: var(--dw-radius-lg);
  background: color-mix(in srgb, var(--dw-bg) 92%, var(--dw-on-accent));
  color: var(--dw-text-secondary);
  font-size: var(--dw-text-md);
  line-height: var(--dw-leading-relaxed);
  box-shadow: var(--dw-menu-shadow);
  border: 1px solid var(--dw-border-light);
  pointer-events: none;
}

.app-toast--error {
  color: var(--dw-danger-fg);
  background: color-mix(in srgb, color-mix(in srgb, var(--dw-danger) 8%, var(--dw-bg)) 88%, var(--dw-bg));
  border-color: color-mix(in srgb, color-mix(in srgb, var(--dw-danger) 35%, var(--dw-bg)) 55%, var(--dw-border-light));
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
  transition: opacity var(--dw-duration-slow) var(--dw-ease), transform var(--dw-duration-slow) var(--dw-ease);
}

.app-toast-enter-from,
.app-toast-leave-to {
  opacity: 0;
  transform: translateX(-50%) translateY(8px);
}
</style>
