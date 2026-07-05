<script setup lang="ts">
import {computed, ref} from 'vue'
import {useI18n} from 'vue-i18n'
import {usePopoverEscape} from '@/core/composables/usePopoverEscape'
import {DwIcon} from '@/core/icons'
import {useConsoleTransaction} from '@/features/workspace/composables/useConsoleTransaction'
import {isManualTransactionMode} from '@/features/workspace/services/transaction-mode.service'

const props = defineProps<{
  tabId: string
  connectionId?: string
  database?: string
  canManage?: boolean
}>()

const {t} = useI18n()
const rootRef = ref<HTMLElement>()
const open = ref(false)

const transaction = useConsoleTransaction({
  sessionKey: () => props.tabId,
  connectionId: () => props.connectionId,
  database: () => props.database,
})

const isManual = computed(() => isManualTransactionMode(transaction.status.value))
const isPending = computed(() => isManual.value && transaction.status.value.pending)

const statusLabel = computed(() => {
  if (!props.connectionId) return t('console.transaction.noConnection')
  if (isPending.value) return t('console.transaction.manualPending')
  if (isManual.value) return t('console.transaction.manualIdle')
  return t('console.transaction.autocommitOnLabel')
})

const compactStatusLabel = computed(() => {
  if (!props.connectionId) return '—'
  if (isPending.value) return t('console.transaction.compactPending')
  if (isManual.value) return t('console.transaction.compactManual')
  return t('console.transaction.compactAutocommit')
})

const statusTone = computed<'idle' | 'manual' | 'pending' | 'disabled'>(() => {
  if (!props.connectionId) return 'disabled'
  if (isPending.value) return 'pending'
  if (isManual.value) return 'manual'
  return 'idle'
})

function closeMenu() {
  open.value = false
}

function toggleMenu() {
  if (!props.connectionId || props.canManage === false) return
  open.value = !open.value
}

async function runAction(action: () => void | Promise<void>) {
  await action()
  closeMenu()
}

defineExpose({
  refreshStatus: transaction.refreshStatus,
})

usePopoverEscape(open, closeMenu)
</script>

<template>
  <div
      ref="rootRef"
      class="txn-bar"
      :class="[`is-${statusTone}`, { open, 'is-loading': transaction.loading.value }]"
  >
    <button
        class="txn-trigger"
        type="button"
        :disabled="!connectionId || transaction.loading.value || canManage === false"
        :title="`${t('console.transaction.menuTitle')} · ${statusLabel}`"
        @click="toggleMenu"
    >
      <span class="txn-dot" aria-hidden="true"/>
      <span class="txn-value">{{ compactStatusLabel }}</span>
      <DwIcon class="txn-caret" name="chevron-down" size="xs" :stroke-width="1.5"/>
    </button>

    <div v-if="isPending" class="txn-quick">
      <button
          class="txn-quick-btn txn-quick-btn--commit"
          type="button"
          :disabled="!transaction.canCommit() || transaction.loading.value"
          @click="transaction.commit()"
      >
        {{ t('console.transaction.commit') }}
      </button>
      <button
          class="txn-quick-btn txn-quick-btn--rollback"
          type="button"
          :disabled="!transaction.canRollback() || transaction.loading.value"
          @click="transaction.rollback()"
      >
        {{ t('console.transaction.rollback') }}
      </button>
    </div>

    <div v-if="open" class="txn-menu">
      <div class="txn-menu-head">
        <span class="txn-menu-dot" aria-hidden="true"/>
        <span>{{ statusLabel }}</span>
      </div>

      <button
          class="txn-item"
          type="button"
          :disabled="!transaction.canBegin() || transaction.loading.value"
          @click="runAction(transaction.begin)"
      >
        <span class="txn-item-label">{{ t('console.transaction.begin') }}</span>
        <span class="txn-item-hint">{{ t('console.transaction.beginHint') }}</span>
      </button>
      <button
          class="txn-item"
          type="button"
          :disabled="!transaction.canCommit() || transaction.loading.value"
          @click="runAction(transaction.commit)"
      >
        <span class="txn-item-label">{{ t('console.transaction.commit') }}</span>
        <span class="txn-item-hint">{{ t('console.transaction.commitHint') }}</span>
      </button>
      <button
          class="txn-item"
          type="button"
          :disabled="!transaction.canRollback() || transaction.loading.value"
          @click="runAction(transaction.rollback)"
      >
        <span class="txn-item-label">{{ t('console.transaction.rollback') }}</span>
        <span class="txn-item-hint">{{ t('console.transaction.rollbackHint') }}</span>
      </button>

      <div class="txn-menu-divider"/>

      <button
          class="txn-mode"
          type="button"
          :class="{ active: transaction.status.value.autocommit }"
          :disabled="transaction.loading.value"
          @click="runAction(() => {
            if (!transaction.status.value.autocommit) transaction.toggleAutocommit()
          })"
      >
        <span>{{ t('console.transaction.autocommitOnLabel') }}</span>
        <DwIcon
            v-if="transaction.status.value.autocommit"
            class="txn-check"
            name="submit"
            size="xs"
            :stroke-width="1.6"
        />
      </button>
      <button
          class="txn-mode"
          type="button"
          :class="{ active: !transaction.status.value.autocommit }"
          :disabled="transaction.loading.value"
          @click="runAction(() => {
            if (transaction.status.value.autocommit) transaction.toggleAutocommit()
          })"
      >
        <span>{{ t('console.transaction.manualMode') }}</span>
        <DwIcon
            v-if="!transaction.status.value.autocommit"
            class="txn-check"
            name="submit"
            size="xs"
            :stroke-width="1.6"
        />
      </button>
    </div>
  </div>
</template>

<style scoped>
.txn-bar {
  position: relative;
  display: inline-flex;
  align-items: center;
  gap: 4px;
  height: auto;
}

.txn-trigger {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  height: var(--dw-console-btn-size);
  min-width: 0;
  padding: 0 6px;
  border: 1px solid transparent;
  border-radius: 8px;
  background: transparent;
  color: var(--dw-text-secondary);
  transition: background 0.12s ease, border-color 0.12s ease, color 0.12s ease;
}

.txn-trigger:hover:not(:disabled) {
  color: var(--dw-text);
  background: color-mix(in srgb, var(--dw-text) 6%, transparent);
  border-color: color-mix(in srgb, var(--dw-border) 80%, transparent);
}

.txn-bar.open .txn-trigger {
  color: var(--dw-text);
  background: color-mix(in srgb, var(--dw-text) 6%, transparent);
  border-color: color-mix(in srgb, var(--dw-border) 80%, transparent);
}

.txn-trigger:disabled {
  opacity: 0.55;
  cursor: not-allowed;
}

.txn-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: #16a34a;
  box-shadow: 0 0 0 2px color-mix(in srgb, #16a34a 18%, transparent);
}

.txn-bar.is-manual .txn-dot {
  background: #d97706;
  box-shadow: 0 0 0 2px color-mix(in srgb, #d97706 18%, transparent);
}

.txn-bar.is-pending .txn-dot {
  background: #dc2626;
  box-shadow: 0 0 0 2px color-mix(in srgb, #dc2626 18%, transparent);
}

.txn-bar.is-disabled .txn-dot {
  background: var(--dw-text-muted);
  box-shadow: none;
}

.txn-value {
  max-width: 64px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 11px;
  line-height: 1;
  font-weight: 500;
  color: inherit;
}

.txn-caret {
  flex-shrink: 0;
  color: var(--dw-text-muted);
  transition: transform 0.15s ease;
}

.txn-bar.open .txn-caret {
  transform: rotate(180deg);
}

.txn-quick {
  display: inline-flex;
  align-items: center;
  gap: 2px;
}

.txn-quick-btn {
  padding: 2px 6px;
  border-radius: 4px;
  font-size: 10px;
  font-weight: 600;
  line-height: 14px;
  transition: background 0.12s ease, color 0.12s ease;
}

.txn-quick-btn:disabled {
  opacity: 0.45;
  cursor: not-allowed;
}

.txn-quick-btn--commit {
  color: #15803d;
}

.txn-quick-btn--commit:hover:not(:disabled) {
  background: color-mix(in srgb, #15803d 12%, transparent);
}

.txn-quick-btn--rollback {
  color: #b45309;
}

.txn-quick-btn--rollback:hover:not(:disabled) {
  background: color-mix(in srgb, #b45309 12%, transparent);
}

.txn-menu {
  position: absolute;
  top: calc(100% + 6px);
  right: 0;
  z-index: 60;
  width: 220px;
  padding: 4px;
  border: 1px solid var(--dw-border);
  border-radius: 10px;
  background: var(--dw-bg);
  box-shadow: 0 10px 28px rgba(15, 23, 42, 0.12);
}

.txn-menu-head {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 10px 10px;
  color: var(--dw-text-secondary);
  font-size: 12px;
  font-weight: 600;
  border-bottom: 1px solid var(--dw-border-light);
  margin-bottom: 2px;
}

.txn-menu-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: currentColor;
}

.txn-bar.is-idle .txn-menu-dot {
  color: #16a34a;
}

.txn-bar.is-manual .txn-menu-dot {
  color: #d97706;
}

.txn-bar.is-pending .txn-menu-dot {
  color: #dc2626;
}

.txn-item {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 1px;
  width: 100%;
  padding: 8px 10px;
  border-radius: 6px;
  text-align: left;
  transition: background 0.12s ease;
}

.txn-item:hover:not(:disabled) {
  background: var(--dw-bg-hover);
}

.txn-item:disabled {
  opacity: 0.45;
  cursor: not-allowed;
}

.txn-item-label {
  font-size: 12px;
  font-weight: 600;
  color: var(--dw-text);
}

.txn-item-hint {
  font-size: 10px;
  color: var(--dw-text-muted);
}

.txn-menu-divider {
  height: 1px;
  margin: 4px 6px;
  background: var(--dw-border-light);
}

.txn-mode {
  display: flex;
  align-items: center;
  justify-content: space-between;
  width: 100%;
  padding: 8px 10px;
  border-radius: 6px;
  font-size: 12px;
  color: var(--dw-text);
  transition: background 0.12s ease;
}

.txn-mode:hover:not(:disabled) {
  background: var(--dw-bg-hover);
}

.txn-mode.active {
  background: var(--dw-bg-hover);
  font-weight: 600;
}

.txn-check {
  flex-shrink: 0;
  color: var(--dw-text-secondary);
}
</style>
