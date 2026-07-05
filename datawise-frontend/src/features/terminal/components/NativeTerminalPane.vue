<script setup lang="ts">
import {FitAddon} from '@xterm/addon-fit'
import {Terminal} from '@xterm/xterm'
import '@xterm/xterm/css/xterm.css'
import {nextTick, onMounted, onUnmounted, ref, shallowRef} from 'vue'
import {useI18n} from 'vue-i18n'
import {getNativeTerminalBridge, getTerminalBridge} from '@/features/terminal/services/native-terminal'

const containerRef = ref<HTMLElement>()
const term = shallowRef<Terminal | null>(null)
const sessionId = crypto.randomUUID()
const {t} = useI18n()

let fitAddon: FitAddon | null = null
let resizeObserver: ResizeObserver | null = null
let offOutput: (() => void) | null = null
let offExit: (() => void) | null = null
let activeBridge: Awaited<ReturnType<typeof getTerminalBridge>> | null = null

function fitTerminal() {
  if (!fitAddon || !term.value || !containerRef.value) return
  fitAddon.fit()
  if (activeBridge && term.value.cols > 0 && term.value.rows > 0) {
    void activeBridge.resize(sessionId, term.value.cols, term.value.rows)
  }
}

function clearTerminal() {
  const isWin = window.datawise?.platform === 'win32'
  if (activeBridge) void activeBridge.write(sessionId, isWin ? 'cls\r' : 'clear\r')
  term.value?.clear()
}

function focusTerminal() {
  term.value?.focus()
}

onMounted(async () => {
  activeBridge = getNativeTerminalBridge() ?? await getTerminalBridge()
  const bridge = activeBridge
  if (!bridge || !containerRef.value) return

  fitAddon = new FitAddon()
  const terminal = new Terminal({
    cursorBlink: true,
    fontFamily: 'Consolas, "Cascadia Mono", "Courier New", monospace',
    fontSize: 13,
    lineHeight: 1.25,
    scrollback: 5000,
    theme: {
      background: '#1a1d24',
      foreground: '#e5e7eb',
      cursor: '#22c55e',
      selectionBackground: '#264f78',
    },
  })

  terminal.loadAddon(fitAddon)
  terminal.open(containerRef.value)
  await nextTick()
  fitTerminal()

  const created = await bridge.create(sessionId, {
    cols: terminal.cols,
    rows: terminal.rows,
  })

  if (!created.ok) {
    terminal.writeln(`\x1b[31m${t('terminal.nativeFailed')}\x1b[0m`)
    term.value = terminal
    return
  }

  offOutput = bridge.onOutput(sessionId, (data) => terminal.write(data))
  offExit = bridge.onExit(sessionId, (code) => {
    terminal.writeln(`\r\n\x1b[90m[${t('terminal.processExit', {code})}]\x1b[0m`)
  })

  terminal.onData((data) => {
    void bridge.write(sessionId, data)
  })

  resizeObserver = new ResizeObserver(() => fitTerminal())
  resizeObserver.observe(containerRef.value)

  term.value = terminal
  terminal.focus()
})

onUnmounted(() => {
  resizeObserver?.disconnect()
  offOutput?.()
  offExit?.()
  if (activeBridge) void activeBridge.destroy(sessionId)
  activeBridge = null
  term.value?.dispose()
  term.value = null
})

defineExpose({focus: focusTerminal, clear: clearTerminal})
</script>

<template>
  <div ref="containerRef" class="native-terminal"/>
</template>

<style scoped>
.native-terminal {
  width: 100%;
  height: 100%;
  min-height: 0;
  padding: 4px 2px 2px;
  background: #1a1d24;
}

.native-terminal :deep(.xterm) {
  height: 100%;
}

.native-terminal :deep(.xterm-viewport) {
  scrollbar-width: thin;
  scrollbar-color: var(--dw-scrollbar-thumb) var(--dw-scrollbar-track);
}
</style>
