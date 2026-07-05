<script setup lang="ts">
import TerminalToolWindow from '@/features/layout/components/TerminalToolWindow.vue'
import ResizeHandle from '@/core/components/ResizeHandle.vue'
import {useLayoutStore} from '@/features/layout/stores/layout'

const layout = useLayoutStore()
</script>

<template>
  <div v-if="layout.showTerminalPanel" class="terminal-pane">
    <ResizeHandle
        :model-value="layout.terminalHeight"
        axis="vertical"
        :min="160"
        :max="520"
        class="terminal-pane__resize"
        @update:model-value="layout.setTerminalHeight"
    />
    <TerminalToolWindow/>
  </div>
</template>

<style scoped>
.terminal-pane {
  position: relative;
  flex-shrink: 0;
  min-height: 0;
}

.terminal-pane :deep(.terminal-pane__resize) {
  position: absolute;
  top: calc(var(--dw-panel-gap) * -0.5);
  left: 0;
  right: 0;
  z-index: 2;
  width: auto;
  height: var(--dw-panel-gap);
  transform: translateY(-50%);
}
</style>
