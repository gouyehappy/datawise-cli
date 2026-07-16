<script setup lang="ts">
import {computed} from 'vue'
import {storeToRefs} from 'pinia'
import {useI18n} from 'vue-i18n'
import {DwIcon, type DwIconName} from '@/core/icons'
import {useToastStore, type ToastVariant} from '@/features/layout/stores/toast-store'

const {t} = useI18n()
const toast = useToastStore()
const {message, variant} = storeToRefs(toast)

const TOAST_ICON: Record<ToastVariant, DwIconName> = {
  info: 'info',
  success: 'check',
  warning: 'alert-triangle',
  error: 'alert-circle',
}

const TOAST_TITLE_KEY: Record<ToastVariant, string> = {
  info: 'toast.kinds.info',
  success: 'toast.kinds.success',
  warning: 'toast.kinds.warning',
  error: 'toast.kinds.error',
}

const iconName = computed(() => TOAST_ICON[variant.value])
const title = computed(() => t(TOAST_TITLE_KEY[variant.value]))
</script>

<template>
  <Transition name="app-toast">
    <div
        v-if="message"
        class="app-toast"
        :class="`app-toast--${variant}`"
        :role="variant === 'error' || variant === 'warning' ? 'alert' : 'status'"
        :aria-live="variant === 'error' ? 'assertive' : 'polite'"
    >
      <span class="app-toast__badge" aria-hidden="true">
        <DwIcon
            class="app-toast__icon"
            :name="iconName"
            size="md"
            :stroke-width="2"
        />
      </span>
      <div class="app-toast__body">
        <div class="app-toast__title">{{ title }}</div>
        <div class="app-toast__text">{{ message }}</div>
      </div>
    </div>
  </Transition>
</template>

<style scoped>
.app-toast {
  --toast-accent: var(--dw-info);
  --toast-badge-bg: var(--dw-info-soft);
  --toast-badge-fg: var(--dw-info);

  position: fixed;
  right: var(--dw-space-8);
  bottom: calc(var(--dw-status-height) + var(--dw-space-8));
  z-index: var(--dw-z-toast);
  display: grid;
  grid-template-columns: auto 1fr;
  gap: var(--dw-space-5);
  width: min(92vw, 420px);
  padding: var(--dw-space-6) var(--dw-space-7);
  border: 1px solid var(--dw-panel-border);
  border-radius: var(--dw-modal-radius);
  border-left: 4px solid var(--toast-accent);
  background: var(--dw-bg-panel);
  box-shadow: var(--dw-shadow);
  pointer-events: none;
}

.app-toast__badge {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  width: 32px;
  height: 32px;
  margin-top: 1px;
  border-radius: var(--dw-control-radius);
  background: var(--toast-badge-bg);
  color: var(--toast-badge-fg);
}

.app-toast__icon {
  flex-shrink: 0;
}

.app-toast__body {
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: var(--dw-space-2);
}

.app-toast__title {
  font-size: var(--dw-text-sm);
  font-weight: 600;
  line-height: var(--dw-leading-snug);
  color: var(--dw-text);
  letter-spacing: 0.01em;
}

.app-toast__text {
  font-size: var(--dw-text-sm);
  line-height: var(--dw-leading-relaxed);
  color: var(--dw-text-secondary);
  word-break: break-word;
}

.app-toast--info {
  --toast-accent: var(--dw-info);
  --toast-badge-bg: var(--dw-info-soft);
  --toast-badge-fg: var(--dw-info);
}

.app-toast--success {
  --toast-accent: var(--dw-success);
  --toast-badge-bg: var(--dw-success-soft);
  --toast-badge-fg: var(--dw-success);
}

.app-toast--warning {
  --toast-accent: var(--dw-warning);
  --toast-badge-bg: var(--dw-warning-soft);
  --toast-badge-fg: var(--dw-warning-fg);
  background: color-mix(in srgb, var(--dw-warning-soft) 18%, var(--dw-bg-panel));
}

.app-toast--error {
  --toast-accent: var(--dw-danger);
  --toast-badge-bg: var(--dw-danger-soft);
  --toast-badge-fg: var(--dw-danger);
  background: color-mix(in srgb, var(--dw-danger-soft) 22%, var(--dw-bg-panel));
}

.app-toast--error .app-toast__title {
  color: var(--dw-danger-fg);
}

.app-toast--error .app-toast__text {
  color: color-mix(in srgb, var(--dw-danger-fg) 82%, var(--dw-text-secondary));
}

.app-toast-enter-active,
.app-toast-leave-active {
  transition:
      opacity var(--dw-duration-slow) var(--dw-ease),
      transform var(--dw-duration-slow) var(--dw-ease);
}

.app-toast-enter-from,
.app-toast-leave-to {
  opacity: 0;
  transform: translateX(16px) translateY(6px);
}
</style>
