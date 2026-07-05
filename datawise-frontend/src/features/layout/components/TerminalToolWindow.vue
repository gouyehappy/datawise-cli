<script setup lang="ts">
import {computed, nextTick, ref, watch} from 'vue'
import {useI18n} from 'vue-i18n'
import {IconButton} from '@/core/components'
import {DwIcon} from '@/core/icons'
import ToolWindowShell from '@/features/layout/components/ToolWindowShell.vue'
import {formatShortcutLabel} from '@/features/layout/composables/useAppShortcutListener'
import TerminalView from '@/features/terminal/components/TerminalView.vue'
import {
    defaultNativeShellLabel,
    getTerminalRuntimeMode,
} from '@/features/terminal/services/terminal-runtime'
import {useLayoutStore} from '@/features/layout/stores/layout'
import {useWorkspaceStore} from '@/features/workspace/stores/workspace'

const {t} = useI18n()
const layout = useLayoutStore()
const workspace = useWorkspaceStore()
const terminalRef = ref<InstanceType<typeof TerminalView>>()

const runtimeMode = computed(() => getTerminalRuntimeMode())
const panelSubtitle = computed(() => {
    if (runtimeMode.value === 'native') {
        return t('terminal.nativeMode', {shell: defaultNativeShellLabel()})
    }
    return t('terminal.demoMode')
})

const toggleShortcut = computed(() => formatShortcutLabel('app.toggleTerminal'))

watch(
    () => layout.showTerminalPanel,
    async (open) => {
      if (!open) return
      await nextTick()
      terminalRef.value?.focus()
    },
)

function openInTab() {
  workspace.openTerminal()
  layout.closeTerminalPanel()
}

function clearTerminal() {
  terminalRef.value?.clear()
}
</script>

<template>
  <section
      class="terminal-window dw-panel-hover-chrome"
      :style="{ height: `${layout.terminalHeight}px` }"
      :aria-label="t('terminal.title')"
  >
    <ToolWindowShell
        class="terminal-window__shell"
        :title="t('terminal.title')"
        :subtitle="panelSubtitle"
        @collapse="layout.closeTerminalPanel()"
    >
      <template #head-actions>
        <kbd v-if="toggleShortcut" class="terminal-window__shortcut">{{ toggleShortcut }}</kbd>
        <button class="terminal-window__link" type="button" @click="openInTab">
          {{ t('terminal.openInTab') }}
        </button>
        <IconButton size="sm" :title="t('terminal.clear')" @click="clearTerminal">
          <DwIcon name="delete" size="sm" :stroke-width="1.5"/>
        </IconButton>
      </template>

      <div class="terminal-window__body">
        <TerminalView ref="terminalRef" compact/>
      </div>
    </ToolWindowShell>
  </section>
</template>

<style scoped>
.terminal-window {
  display: flex;
  flex-direction: column;
  flex-shrink: 0;
  min-height: 0;
  border: 1px solid var(--dw-panel-border);
  border-radius: var(--dw-panel-radius);
  background: var(--dw-bg-panel);
  box-shadow: var(--dw-panel-shadow);
  overflow: hidden;
}

.terminal-window__shell {
  flex: 1;
  min-height: 0;
}

.terminal-window__shell :deep(.tool-window) {
  height: 100%;
  min-height: 0;
}

.terminal-window__shortcut {
  padding: 2px 6px;
  border: 1px solid var(--dw-border-light);
  border-radius: 4px;
  background: var(--dw-bg-muted);
  font-family: var(--dw-mono);
  font-size: 10px;
  color: var(--dw-text-muted);
}

.terminal-window__link {
  padding: 4px 10px;
  border: none;
  border-radius: 7px;
  background: transparent;
  color: var(--dw-primary);
  font-size: 11px;
  font-weight: 500;
  white-space: nowrap;
  cursor: pointer;
}

.terminal-window__link:hover {
  background: var(--dw-primary-soft);
}

.terminal-window__body {
  height: 100%;
  min-height: 0;
  padding: 8px var(--dw-console-chrome-inset) 10px;
  box-sizing: border-box;
}
</style>
