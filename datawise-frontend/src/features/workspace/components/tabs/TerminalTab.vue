<script setup lang="ts">
import {computed, onMounted, ref} from 'vue'
import {useI18n} from 'vue-i18n'
import {formatShortcutLabel} from '@/features/layout/composables/useAppShortcutListener'
import TerminalView from '@/features/terminal/components/TerminalView.vue'
import {
    defaultNativeShellLabel,
    getTerminalRuntimeMode,
} from '@/features/terminal/services/terminal-runtime'
import IconButton from '@/core/components/IconButton.vue'
import {DwIcon} from '@/core/icons'
import type {WorkspaceTab} from '@/core/types'

defineProps<{ tab: WorkspaceTab }>()
const {t} = useI18n()
const terminalRef = ref<InstanceType<typeof TerminalView>>()

const toggleShortcut = computed(() => formatShortcutLabel('app.toggleTerminal'))
const tabSubtitle = computed(() => {
    if (getTerminalRuntimeMode() === 'native') {
        return t('terminal.nativeMode', {shell: defaultNativeShellLabel()})
    }
    return t('terminal.subtitle')
})

function clearTerminal() {
  terminalRef.value?.clear()
}

onMounted(() => {
  terminalRef.value?.focus()
})
</script>

<template>
  <div class="terminal-tab">
    <header class="terminal-tab__head">
      <div class="terminal-tab__title">
        <span class="terminal-tab__icon" aria-hidden="true">
          <DwIcon name="terminal" :size="18" :stroke-width="1.7"/>
        </span>
        <div>
          <h1>{{ t('terminal.title') }}</h1>
          <p>{{ tabSubtitle }}</p>
        </div>
      </div>
      <div class="terminal-tab__actions">
        <kbd v-if="toggleShortcut" class="terminal-tab__shortcut">{{ toggleShortcut }}</kbd>
        <IconButton size="sm" :title="t('terminal.clear')" @click="clearTerminal">
          <DwIcon name="delete" size="sm" :stroke-width="1.5"/>
        </IconButton>
      </div>
    </header>
    <TerminalView ref="terminalRef" class="terminal-tab__body"/>
  </div>
</template>

<style scoped>
.terminal-tab {
  display: flex;
  flex-direction: column;
  height: 100%;
  padding: 16px 20px 20px;
  background: var(--dw-bg-editor);
}

.terminal-tab__head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;
  flex-shrink: 0;
  margin-bottom: 14px;
}

.terminal-tab__title {
  display: flex;
  align-items: flex-start;
  gap: 12px;
  min-width: 0;
}

.terminal-tab__icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  width: 36px;
  height: 36px;
  border-radius: 10px;
  background: color-mix(in srgb, #16a34a 12%, var(--dw-bg));
  color: #15803d;
}

.terminal-tab__head h1 {
  margin: 0;
  font-size: 16px;
  font-weight: 600;
}

.terminal-tab__head p {
  margin: 4px 0 0;
  color: var(--dw-text-muted);
  font-size: 12px;
  line-height: 1.45;
}

.terminal-tab__actions {
  display: flex;
  align-items: center;
  gap: 6px;
  flex-shrink: 0;
}

.terminal-tab__shortcut {
  padding: 3px 7px;
  border: 1px solid var(--dw-border-light);
  border-radius: 6px;
  background: var(--dw-bg-muted);
  font-family: var(--dw-mono);
  font-size: 10px;
  color: var(--dw-text-muted);
}

.terminal-tab__body {
  flex: 1;
  min-height: 0;
  border-radius: 12px;
  box-shadow: 0 4px 20px color-mix(in srgb, var(--dw-text) 8%, transparent);
}
</style>
