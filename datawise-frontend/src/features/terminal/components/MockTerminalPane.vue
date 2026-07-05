<script setup lang="ts">
import {nextTick, onMounted, ref, watch} from 'vue'
import {useI18n} from 'vue-i18n'
import {useTerminalStore} from '@/features/terminal/stores/terminal'

const {t} = useI18n()
const terminal = useTerminalStore()
const outputRef = ref<HTMLElement>()
const inputRef = ref<HTMLInputElement>()
const draft = ref('')

function scrollToBottom() {
  nextTick(() => {
    const el = outputRef.value
    if (el) el.scrollTop = el.scrollHeight
  })
}

function submit() {
  void terminal.run(draft.value)
  draft.value = ''
  scrollToBottom()
}

function insertAtCursor(text: string) {
  const el = inputRef.value
  if (!el) {
    draft.value += text
    return
  }
  const start = el.selectionStart ?? draft.value.length
  const end = el.selectionEnd ?? start
  draft.value = `${draft.value.slice(0, start)}${text}${draft.value.slice(end)}`
  const caret = start + text.length
  nextTick(() => el.setSelectionRange(caret, caret))
}

function onKeydown(e: KeyboardEvent) {
  if (e.key === 'Enter') {
    e.preventDefault()
    submit()
    return
  }

  if (e.key === 'Tab') {
    e.preventDefault()
    insertAtCursor('\t')
    return
  }

  if (e.ctrlKey && e.key.toLowerCase() === 'c') {
    e.preventDefault()
    draft.value = ''
    terminal.lines.push({type: 'sys', text: '^C'})
    return
  }

  if (e.ctrlKey && e.key.toLowerCase() === 'l') {
    e.preventDefault()
    terminal.clear()
    return
  }

  if (e.key === 'ArrowUp') {
    e.preventDefault()
    const prev = terminal.historyUp()
    if (prev !== null) draft.value = prev
    return
  }

  if (e.key === 'ArrowDown') {
    e.preventDefault()
    const next = terminal.historyDown()
    if (next !== null) draft.value = next
  }
}

watch(
    () => terminal.lines.length,
    () => scrollToBottom(),
)

onMounted(() => {
  void terminal.ensureBoot()
  scrollToBottom()
  inputRef.value?.focus()
})

function clearTerminal() {
  terminal.clear()
}

defineExpose({
  focus: () => inputRef.value?.focus(),
  clear: clearTerminal,
})
</script>

<template>
    <div class="mock-terminal">
    <p class="mock-terminal__banner">{{ t('terminal.mockHint') }}</p>
    <div ref="outputRef" class="mock-terminal__output">
      <div
          v-for="(line, index) in terminal.lines"
          :key="index"
          class="mock-terminal__line"
          :class="line.type"
      >
        {{ line.text }}
      </div>
    </div>
    <form class="mock-terminal__input-row" @submit.prevent="submit">
      <span class="mock-terminal__prompt">{{ terminal.promptPrefix() }}</span>
      <input
          ref="inputRef"
          v-model="draft"
          class="mock-terminal__input"
          type="text"
          spellcheck="false"
          autocomplete="off"
          autocapitalize="off"
          @keydown="onKeydown"
      />
    </form>
  </div>
</template>

<style scoped>
.mock-terminal {
  display: flex;
  flex-direction: column;
  height: 100%;
  min-height: 200px;
  border: 1px solid var(--terminal-border, #2d3340);
  border-radius: 10px;
  background: var(--terminal-bg, #1a1d24);
  color: var(--terminal-text, #e5e7eb);
  font-family: var(--dw-mono);
  font-size: 12px;
  line-height: 1.5;
  overflow: hidden;
}

.mock-terminal__banner {
  margin: 0;
  padding: 6px 12px;
  border-bottom: 1px solid var(--terminal-border, #2d3340);
  background: color-mix(in srgb, #f59e0b 12%, var(--terminal-input-bg, #151820));
  color: #fbbf24;
  font-size: 11px;
  line-height: 1.45;
}

.mock-terminal__output {
  flex: 1;
  overflow-y: auto;
  padding: 10px 12px 6px;
}

.mock-terminal__line {
  white-space: pre-wrap;
  word-break: break-word;
}

.mock-terminal__line.in {
  color: #f3f4f6;
}

.mock-terminal__line.out {
  color: #d1d5db;
}

.mock-terminal__line.err {
  color: #f87171;
}

.mock-terminal__line.sys {
  color: #9ca3af;
}

.mock-terminal__input-row {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 8px 12px 10px;
  border-top: 1px solid var(--terminal-border, #2d3340);
  background: var(--terminal-input-bg, #151820);
}

.mock-terminal__prompt {
  flex-shrink: 0;
  color: #22c55e;
  font-weight: 600;
}

.mock-terminal__input {
  flex: 1;
  min-width: 0;
  border: none;
  outline: none;
  background: transparent;
  color: #f9fafb;
  font: inherit;
}
</style>
