<script setup lang="ts">
import {FitAddon} from '@xterm/addon-fit'
import {Terminal} from '@xterm/xterm'
import '@xterm/xterm/css/xterm.css'
import {nextTick, onActivated, onMounted, onUnmounted, ref, shallowRef, watch} from 'vue'
import {useI18n} from 'vue-i18n'
import {createSshTerminalBridge} from '@/features/terminal/services/ssh-terminal.bridge'
import {
    registerSshTerminalHandle,
    unregisterSshTerminalHandle,
    type SshTerminalStatus,
} from '@/features/terminal/services/ssh-terminal-session.service'
import {
    adjustSshTerminalFontSize,
    applyTerminalFontSize,
    readSshTerminalFontSize,
} from '@/features/terminal/services/ssh-terminal-font.service'
import {copyTerminalBuffer, findInTerminal, type TerminalSearchState} from '@/features/terminal/services/ssh-terminal-search.service'

const props = defineProps<{
  connectionId: string
  tabId: string
  tabLabel: string
  autoReconnect?: boolean
}>()

const emit = defineEmits<{
  statusChange: [status: SshTerminalStatus, message?: string]
  saveSelection: []
  contextMenu: [event: MouseEvent]
  openSearch: []
}>()

const containerRef = ref<HTMLElement>()
const term = shallowRef<Terminal | null>(null)
const status = ref<SshTerminalStatus>('connecting')
const statusMessage = ref('')
const fontSize = ref(readSshTerminalFontSize())
const searchState = ref<TerminalSearchState | null>(null)
const {t} = useI18n()

let sessionId = crypto.randomUUID()
let fitAddon: FitAddon | null = null
let resizeObserver: ResizeObserver | null = null
let offOutput: (() => void) | null = null
let offExit: (() => void) | null = null
let bridge: ReturnType<typeof createSshTerminalBridge> | null = null
let starting = false
let autoReconnectTimer: ReturnType<typeof setTimeout> | null = null

function setStatus(next: SshTerminalStatus, message = '') {
  status.value = next
  statusMessage.value = message
  emit('statusChange', next, message)
}

function fitTerminal() {
  if (!fitAddon || !term.value || !containerRef.value) return
  fitAddon.fit()
  if (bridge && term.value.cols > 0 && term.value.rows > 0) {
    void bridge.resize(sessionId, term.value.cols, term.value.rows)
  }
}

function clearAutoReconnectTimer() {
  if (autoReconnectTimer) {
    clearTimeout(autoReconnectTimer)
    autoReconnectTimer = null
  }
}

function scheduleAutoReconnect() {
  clearAutoReconnectTimer()
  if (!props.autoReconnect || starting) return
  if (status.value !== 'disconnected' && status.value !== 'error') return
  autoReconnectTimer = setTimeout(() => {
    autoReconnectTimer = null
    void reconnect()
  }, 2500)
}

async function teardown() {
  clearAutoReconnectTimer()
  resizeObserver?.disconnect()
  resizeObserver = null
  offOutput?.()
  offOutput = null
  offExit?.()
  offExit = null
  if (bridge) {
    await bridge.destroy(sessionId)
  }
  bridge = null
  term.value?.dispose()
  term.value = null
  fitAddon = null
  searchState.value = null
}

async function startSession() {
  if (!props.connectionId || !containerRef.value || starting) return
  starting = true
  setStatus('connecting')
  try {
    await teardown()
    sessionId = crypto.randomUUID()
    bridge = createSshTerminalBridge(props.connectionId)
    fitAddon = new FitAddon()
    const terminal = new Terminal({
      cursorBlink: true,
      fontFamily: 'Consolas, "Cascadia Mono", "Courier New", monospace',
      fontSize: fontSize.value,
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

    // Register before create — shell prompt/MOTD can arrive immediately after PTY opens.
    offOutput = bridge.onOutput(sessionId, (data) => terminal.write(data))
    offExit = bridge.onExit(sessionId, (code) => {
      terminal.writeln(`\r\n\x1b[90m[${t('terminal.processExit', {code})}]\x1b[0m`)
      setStatus('disconnected', t('terminal.sshDisconnected'))
      scheduleAutoReconnect()
    })

    terminal.onData((data) => {
      void bridge?.write(sessionId, data)
    })

    terminal.attachCustomKeyEventHandler((event) => {
      if (event.type !== 'keydown') return true
      const mod = event.ctrlKey || event.metaKey
      if (mod && !event.shiftKey && !event.altKey && event.key.toLowerCase() === 'f') {
        event.preventDefault()
        emit('openSearch')
        return false
      }
      if (!mod || event.shiftKey || event.altKey) return true

      const key = event.key.toLowerCase()
      if (key === 'c') {
        if (!getSelection()) return true
        event.preventDefault()
        void copySelection()
        return false
      }
      if (key === 'v') {
        event.preventDefault()
        void pasteFromClipboard()
        return false
      }
      if (key === 's') {
        event.preventDefault()
        emit('saveSelection')
        return false
      }
      return true
    })

    resizeObserver = new ResizeObserver(() => fitTerminal())
    resizeObserver.observe(containerRef.value)

    term.value = terminal

    const created = await bridge.create(sessionId, {
      cols: Math.max(terminal.cols, 80),
      rows: Math.max(terminal.rows, 24),
    })

    if (!created.ok) {
      terminal.writeln(`\x1b[31m${created.error ?? t('terminal.sshFailed')}\x1b[0m`)
      setStatus('error', created.error ?? t('terminal.sshFailed'))
      scheduleAutoReconnect()
      return
    }

    setStatus('connected')
    await nextTick()
    fitTerminal()
    terminal.focus()
  } finally {
    starting = false
  }
}

function clearTerminal() {
  term.value?.clear()
  searchState.value = null
}

function focusTerminal() {
  term.value?.focus()
}

async function sendInput(text: string): Promise<boolean> {
  if (!bridge || status.value !== 'connected') return false
  if (!bridge.isOpen(sessionId)) {
    await reconnect()
    if (!bridge?.isOpen(sessionId) || status.value !== 'connected') return false
  }
  return bridge.write(sessionId, text)
}

async function reconnect() {
  term.value?.clear()
  await startSession()
}

async function refreshActiveSession() {
  if (starting || !term.value) return
  await nextTick()
  fitTerminal()
  if (bridge && !bridge.isOpen(sessionId) && status.value === 'connected') {
    setStatus('disconnected', t('terminal.sshDisconnected'))
    await reconnect()
    return
  }
  term.value.focus()
}

function getSelection(): string {
  return term.value?.getSelection() ?? ''
}

async function copySelection(): Promise<boolean> {
  const selection = getSelection()
  if (!selection) return false
  try {
    await navigator.clipboard.writeText(selection)
    return true
  } catch {
    return false
  }
}

async function pasteFromClipboard(): Promise<boolean> {
  try {
    const text = await navigator.clipboard.readText()
    if (!text) return false
    return sendInput(text)
  } catch {
    return false
  }
}

function changeFontSize(delta: number) {
  fontSize.value = adjustSshTerminalFontSize(fontSize.value, delta)
  applyTerminalFontSize(term.value, fontSize.value)
  fitTerminal()
}

function findNext(query: string): boolean {
  const next = findInTerminal(term.value, query, 'next', searchState.value)
  if (!next) return false
  searchState.value = next
  return true
}

function findPrevious(query: string): boolean {
  const next = findInTerminal(term.value, query, 'prev', searchState.value)
  if (!next) return false
  searchState.value = next
  return true
}

function resetSearch() {
  searchState.value = null
}

function getBufferText(): string {
  return copyTerminalBuffer(term.value)
}

async function copyBuffer(): Promise<boolean> {
  const text = copyTerminalBuffer(term.value)
  if (!text) return false
  try {
    await navigator.clipboard.writeText(text)
    return true
  } catch {
    return false
  }
}

function onContextMenu(event: MouseEvent) {
  event.preventDefault()
  emit('contextMenu', event)
}

watch(() => props.autoReconnect, (enabled) => {
  if (enabled) {
    scheduleAutoReconnect()
    return
  }
  clearAutoReconnectTimer()
})

onMounted(async () => {
  registerSshTerminalHandle({
    tabId: props.tabId,
    connectionId: props.connectionId,
    label: props.tabLabel,
    sendInput,
    focus: focusTerminal,
    getStatus: () => status.value,
    reconnect,
  })
  await startSession()
})

onActivated(() => {
  void refreshActiveSession()
})

onUnmounted(() => {
  unregisterSshTerminalHandle(props.tabId)
  void teardown()
})

defineExpose({
  focus: focusTerminal,
  clear: clearTerminal,
  reconnect,
  sendInput,
  getSelection,
  copySelection,
  pasteFromClipboard,
  copyBuffer,
  getBufferText,
  changeFontSize,
  findNext,
  findPrevious,
  resetSearch,
  getFontSize: () => fontSize.value,
  getStatus: () => status.value,
})
</script>

<template>
  <div
      ref="containerRef"
      class="ssh-terminal"
      tabindex="0"
      @click="focusTerminal"
      @contextmenu="onContextMenu"
  />
</template>

<style scoped>
.ssh-terminal {
  width: 100%;
  height: 100%;
  min-height: 0;
  padding: 4px 2px 2px;
  background: #1a1d24;
  outline: none;
}

.ssh-terminal :deep(.xterm) {
  height: 100%;
}

.ssh-terminal :deep(.xterm-viewport) {
  overflow-y: auto;
}
</style>
