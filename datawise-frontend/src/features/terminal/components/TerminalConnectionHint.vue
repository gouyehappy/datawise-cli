<script setup lang="ts">
import {useI18n} from 'vue-i18n'
import {useTerminalConnectionHint} from '@/features/terminal/composables/useTerminalConnectionHint'

const {t} = useI18n()
const {snippet, connectionLabel, visible, copyCommand} = useTerminalConnectionHint()
</script>

<template>
  <button
      v-if="snippet"
      type="button"
      class="terminal-context-hint"
      :class="{ 'is-visible': visible }"
      :title="t('terminal.contextCopyTitle')"
      @click="copyCommand"
  >
    <span class="terminal-context-hint__label">
      {{ t('terminal.contextHint', { tool: snippet.tool, name: connectionLabel }) }}
    </span>
    <code class="terminal-context-hint__cmd">{{ snippet.command }}</code>
  </button>
</template>

<style scoped>
.terminal-context-hint {
  display: flex;
  align-items: center;
  gap: 8px;
  width: 100%;
  margin: 0;
  padding: 6px 10px;
  border: none;
  border-top: 1px solid var(--terminal-border, #2d3340);
  background: color-mix(in srgb, #22c55e 10%, #151820);
  color: #d1fae5;
  font-size: 11px;
  line-height: 1.35;
  text-align: left;
  cursor: pointer;
  opacity: 0;
  transition: opacity 0.35s ease;
}

.terminal-context-hint.is-visible {
  opacity: 1;
}

.terminal-context-hint:hover {
  background: color-mix(in srgb, #22c55e 16%, #151820);
}

.terminal-context-hint__label {
  flex-shrink: 0;
  color: #86efac;
  font-weight: 600;
  white-space: nowrap;
}

.terminal-context-hint__cmd {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  color: #ecfdf5;
  font-family: var(--dw-mono);
}
</style>
