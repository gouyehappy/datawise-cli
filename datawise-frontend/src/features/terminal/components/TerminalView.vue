<script setup lang="ts">
import {onMounted, ref} from 'vue'
import MockTerminalPane from '@/features/terminal/components/MockTerminalPane.vue'
import NativeTerminalPane from '@/features/terminal/components/NativeTerminalPane.vue'
import TerminalConnectionHint from '@/features/terminal/components/TerminalConnectionHint.vue'
import {isNativeTerminalAvailable, isRealTerminalAvailable} from '@/features/terminal/services/native-terminal'

const props = withDefaults(
    defineProps<{ compact?: boolean }>(),
    {compact: false},
)

const useNative = ref(isNativeTerminalAvailable())
const paneRef = ref<InstanceType<typeof NativeTerminalPane> | InstanceType<typeof MockTerminalPane>>()

onMounted(async () => {
    if (!useNative.value) {
        useNative.value = await isRealTerminalAvailable()
    }
})

defineExpose({
  focus: () => paneRef.value?.focus(),
  clear: () => paneRef.value?.clear(),
})
</script>

<template>
  <div class="terminal" :class="{ 'terminal--compact': compact, 'terminal--native': useNative }">
    <div class="terminal__pane">
      <NativeTerminalPane v-if="useNative" ref="paneRef"/>
      <MockTerminalPane v-else ref="paneRef" class="terminal__mock" :class="{ 'terminal__mock--compact': compact }"/>
    </div>
    <TerminalConnectionHint v-if="useNative"/>
  </div>
</template>

<style scoped>
.terminal {
  display: flex;
  flex-direction: column;
  height: 100%;
  min-height: 200px;
  overflow: hidden;
}

.terminal--compact {
  min-height: 0;
}

.terminal--native {
  border: 1px solid var(--terminal-border, #2d3340);
  border-radius: var(--dw-radius-lg);
  background: var(--terminal-bg, #1a1d24);
}

.terminal__pane {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
}

.terminal--native .terminal__pane {
  min-height: 0;
}

.terminal--native.terminal--compact {
  border: none;
  border-radius: var(--dw-control-radius);
}

.terminal__mock {
  flex: 1;
  min-height: 0;
}

.terminal__mock--compact {
  border: none;
  border-radius: var(--dw-control-radius);
}
</style>
