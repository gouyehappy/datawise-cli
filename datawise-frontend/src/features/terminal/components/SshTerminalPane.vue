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
import {
    attachSshTerminalAddons,
    clearSearchAddon,
    exportTerminalPlainText,
    findWithSearchAddon,
    type SshTerminalAddonHandles,
} from '@/features/terminal/services/ssh-terminal-addons.service'
import {findInTerminal} from '@/features/terminal/services/ssh-terminal-search.service'

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
const {t} = useI18n()

let sessionId = crypto.randomUUID()
let fitAddon: FitAddon | null = null
let terminalAddons: SshTerminalAddonHandles | null = null
let resizeObserver: ResizeObserver | null = null
let offOutput: (() => void) | null = null
let offExit: (() => void) | null = null
let bridge: ReturnType<typeof createSshTerminalBridge> | null = null
let starting = false
let startGeneration = 0
let autoReconnectTimer: ReturnType<typeof setTimeout> | null = null
let fitDebounceTimer: ReturnType<typeof setTimeout> | null = null
let lastReportedSize = {cols: 0, rows: 0}

function setStatus(next: SshTerminalStatus, message = '') {
  status.value = next
  statusMessage.value = message
  emit('statusChange', next, message)
}

async function waitForMeasurableContainer(el: HTMLElement, timeoutMs = 1200) {
  const started = performance.now()
  while (performance.now() - started < timeoutMs) {
    // Prefer a real layout box so FitAddon can compute cols/rows; don't block connect forever.
    if (el.clientWidth >= 80 && el.clientHeight >= 80) return
    await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()))
  }
}

function reportPtySize(force = false) {
  if (!term.value || !bridge || status.value !== 'connected') return
  const cols = Math.max(term.value.cols, 20)
  const rows = Math.max(term.value.rows, 8)
  if (!force && cols === lastReportedSize.cols && rows === lastReportedSize.rows) return
  lastReportedSize = {cols, rows}
  void bridge.resize(sessionId, cols, rows)
}

function fitTerminal(forceReport = false) {
  if (!fitAddon || !term.value || !containerRef.value) return
  if (containerRef.value.clientWidth < 40 || containerRef.value.clientHeight < 40) return
  try {
    fitAddon.fit()
  } catch {
    return
  }
  // FitAddon can over-count by a row when cellHeight is fractional — drop one so the
  // prompt/cursor isn't clipped against the pane bottom edge.
  const host = containerRef.value
  const screen = term.value.element
  if (screen && term.value.rows > 8) {
    const hostBottom = host.getBoundingClientRect().bottom
    const screenBottom = screen.getBoundingClientRect().bottom
    if (screenBottom > hostBottom - 1) {
      term.value.resize(term.value.cols, term.value.rows - 1)
    }
  }
  reportPtySize(forceReport)
}

function scheduleFit(forceReport = false) {
  if (fitDebounceTimer) clearTimeout(fitDebounceTimer)
  fitDebounceTimer = setTimeout(() => {
    fitDebounceTimer = null
    fitTerminal(forceReport)
  }, 40)
}

function scheduleSettledFits() {
  // One rAF (DOM settle) + one short debounce covers layout that arrives after paint.
  requestAnimationFrame(() => fitTerminal(true))
  scheduleFit(true)
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

async function teardown(abortInFlight = false) {
  clearAutoReconnectTimer()
  if (fitDebounceTimer) {
    clearTimeout(fitDebounceTimer)
    fitDebounceTimer = null
  }
  resizeObserver?.disconnect()
  resizeObserver = null
  offOutput?.()
  offOutput = null
  // Detach exit first so intentional destroy does not look like a dropped shell.
  offExit?.()
  offExit = null
  if (abortInFlight) {
    startGeneration += 1
    starting = false
  }
  if (bridge) {
    await bridge.destroy(sessionId)
  }
  bridge = null
  terminalAddons?.dispose()
  terminalAddons = null
  term.value?.dispose()
  term.value = null
  fitAddon = null
  lastReportedSize = {cols: 0, rows: 0}
}

async function startSession() {
  if (!props.connectionId || !containerRef.value) return
  const generation = ++startGeneration
  starting = true
  setStatus('connecting')
  try {
    await teardown()
    if (generation !== startGeneration || !containerRef.value) return
    await waitForMeasurableContainer(containerRef.value)
    if (generation !== startGeneration || !containerRef.value) return
    sessionId = crypto.randomUUID()
    bridge = createSshTerminalBridge(props.connectionId)
    fitAddon = new FitAddon()
    const terminal = new Terminal({
      cursorBlink: true,
      fontFamily: 'Consolas, "Cascadia Mono", "Courier New", monospace',
      fontSize: fontSize.value,
      // Integer row math for FitAddon — lineHeight > 1 clipped the bottom prompt.
      lineHeight: 1,
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
    try {
      terminalAddons = attachSshTerminalAddons(terminal)
    } catch {
      terminalAddons = null
    }
    await nextTick()
    if (generation !== startGeneration) return
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

    term.value = terminal

    // Match the remote PTY to the visible pane — don't advertise a taller terminal
    // than FitAddon actually rendered, or menus scroll until only the bottom shows.
    const cols = Math.max(terminal.cols, 40)
    const rows = Math.max(terminal.rows, 12)
    const created = await bridge.create(sessionId, {cols, rows})
    if (generation !== startGeneration) return
    lastReportedSize = {cols, rows}

    if (!created.ok) {
      terminal.writeln(`\x1b[31m${created.error ?? t('terminal.sshFailed')}\x1b[0m`)
      setStatus('error', created.error ?? t('terminal.sshFailed'))
      scheduleAutoReconnect()
      return
    }

    // Observe resize only after create succeeds — early resize hit requireOwner and closed the WS.
    resizeObserver = new ResizeObserver(() => scheduleFit())
    resizeObserver.observe(containerRef.value)

    setStatus('connected')
    await nextTick()
    scheduleSettledFits()
    terminal.scrollToBottom()
    terminal.focus()
  } catch (error) {
    if (generation !== startGeneration) return
    const message = error instanceof Error && error.message
        ? error.message
        : t('terminal.sshFailed')
    term.value?.writeln(`\x1b[31m${message}\x1b[0m`)
    setStatus('error', message)
    scheduleAutoReconnect()
  } finally {
    if (generation === startGeneration) {
      starting = false
    }
  }
}

function clearTerminal() {
  term.value?.clear()
  clearSearchAddon(terminalAddons?.search ?? null)
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
  if (starting) return
  if (!term.value || status.value === 'connecting' || status.value === 'error') {
    await startSession()
    return
  }
  await nextTick()
  scheduleSettledFits()
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
  fitTerminal(true)
}

function findNext(query: string): boolean {
  const normalized = query.trim()
  if (!normalized) return false
  const withAddon = findWithSearchAddon(terminalAddons?.search ?? null, normalized, 'next')
  if (withAddon) return true
  // Fallback when SearchAddon is unavailable / incompatible.
  return !!findInTerminal(term.value, normalized, 'next', null)
}

function findPrevious(query: string): boolean {
  const normalized = query.trim()
  if (!normalized) return false
  const withAddon = findWithSearchAddon(terminalAddons?.search ?? null, normalized, 'prev')
  if (withAddon) return true
  return !!findInTerminal(term.value, normalized, 'prev', null)
}

function resetSearch() {
  clearSearchAddon(terminalAddons?.search ?? null)
}

function getBufferText(): string {
  return exportTerminalPlainText(term.value, terminalAddons?.serialize ?? null)
}

async function copyBuffer(): Promise<boolean> {
  const text = exportTerminalPlainText(term.value, terminalAddons?.serialize ?? null)
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
    dispose: () => teardown(true),
  })
  await startSession()
})

onActivated(() => {
  void refreshActiveSession()
})

onUnmounted(() => {
  unregisterSshTerminalHandle(props.tabId)
  void teardown(true)
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
  /* Extra bottom inset so the live prompt/cursor isn't flush against the pane edge. */
  padding: 10px 12px 18px;
  background: #1a1d24;
  outline: none;
  overflow: hidden;
  box-sizing: border-box;
  border-radius: inherit;
  position: relative;
}

.ssh-terminal::after {
  content: '';
  pointer-events: none;
  position: absolute;
  left: 0;
  right: 0;
  bottom: 0;
  height: 14px;
  background: linear-gradient(to top, rgba(26, 29, 36, 0.85), transparent);
}

/* Let FitAddon own sizing — forcing 100% height leaves blank CSS below few fitted rows. */
.ssh-terminal :deep(.xterm) {
  height: auto !important;
  width: 100%;
}

.ssh-terminal :deep(.xterm-viewport) {
  overflow-y: auto;
  scrollbar-width: thin;
  scrollbar-color: rgba(148, 163, 184, 0.45) transparent;
}

.ssh-terminal :deep(.xterm-screen) {
  /* Keep cursor/descenders inside the padded area. */
  margin-bottom: 2px;
}
</style>
