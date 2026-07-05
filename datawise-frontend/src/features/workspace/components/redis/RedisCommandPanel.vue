<script setup lang="ts">
import {computed, ref, watch} from 'vue'
import {useI18n} from 'vue-i18n'
import {explorerApi} from '@/api'
import {
    buildRedisPlaceholderForKey,
    buildRedisQuickCommandsForKey,
    findRedisCommandHint,
    matchRedisCommandHints,
    REDIS_QUICK_COMMANDS,
    resolveRedisKeyIdleHintKey,
    type RedisCommandHint,
} from '@/features/explorer/services/redis-command-hints.service'
import type {RedisConsoleEntry} from '@/features/explorer/services/redis-console.service'
import {formatRedisConsoleEntry} from '@/features/explorer/services/redis-console.service'

const props = defineProps<{
    connectionId: string
    database?: number
    selectedKey?: string | null
    selectedKeyType?: string | null
    seedCommand?: string | null
}>()

const emit = defineEmits<{
    keyDeleted: [key: string]
}>()

const {t} = useI18n()

const commandInput = ref('')
const running = ref(false)
const entries = ref<RedisConsoleEntry[]>([])
const outputRef = ref<HTMLElement>()
const inputRef = ref<HTMLInputElement>()
const historyIndex = ref(-1)

const outputText = computed(() =>
    entries.value.map((entry) => formatRedisConsoleEntry(entry)).join('\n\n'),
)

const commandHints = computed(() => matchRedisCommandHints(commandInput.value, 5))

const activeHint = computed(() => findRedisCommandHint(commandInput.value))

const activeHintText = computed(() => {
    if (activeHint.value) {
        return t(`explorer.redisConsole.commands.${activeHint.value.summary}`, {
            example: activeHint.value.example,
        })
    }
    if (props.selectedKey) {
        const hintKey = resolveRedisKeyIdleHintKey(props.selectedKeyType)
        return t(`explorer.redisConsole.${hintKey}`, {
            key: props.selectedKey,
            example: buildRedisPlaceholderForKey(props.selectedKey, props.selectedKeyType),
        })
    }
    return t('explorer.redisConsole.hint')
})

const contextPlaceholder = computed(() =>
    props.selectedKey
        ? buildRedisPlaceholderForKey(props.selectedKey, props.selectedKeyType)
        : t('explorer.redisConsole.placeholder'),
)

const contextQuickCommands = computed(() => {
    if (!props.selectedKey) return REDIS_QUICK_COMMANDS
    return buildRedisQuickCommandsForKey(props.selectedKey, props.selectedKeyType)
})

function parseDelTarget(command: string): string | null {
    const match = command.trim().match(/^DEL\s+(.+)$/i)
    if (!match?.[1]) return null
    const raw = match[1].trim()
    if (raw.startsWith('"') && raw.endsWith('"')) {
        return raw.slice(1, -1).replace(/\\"/g, '"').replace(/\\\\/g, '\\')
    }
    return raw
}

async function runCommand(raw?: string) {
    const command = (raw ?? commandInput.value).trim()
    if (!command || !props.connectionId || running.value) return

    running.value = true
    commandInput.value = ''
    historyIndex.value = -1

    try {
        const result = await explorerApi.executeRedisCommand(props.connectionId, command, {
            database: props.database,
        })
        entries.value.push({
            command: result.command,
            output: result.success ? result.output : (result.error ?? result.output),
            success: result.success,
            durationMs: result.durationMs,
        })
        if (result.success && /^DEL\b/i.test(command)) {
            const deletedKey = parseDelTarget(command)
            if (deletedKey) emit('keyDeleted', deletedKey)
        }
    } catch (err) {
        entries.value.push({
            command,
            output: err instanceof Error ? err.message : String(err),
            success: false,
            durationMs: 0,
        })
    } finally {
        running.value = false
        const el = outputRef.value
        if (el) el.scrollTop = el.scrollHeight
        inputRef.value?.focus()
    }
}

function onInputKeydown(event: KeyboardEvent) {
    if (event.key === 'Enter') {
        event.preventDefault()
        void runCommand()
        return
    }
    if (event.key === 'ArrowUp') {
        event.preventDefault()
        const commands = entries.value.map((entry) => entry.command).reverse()
        if (!commands.length) return
        historyIndex.value = Math.min(historyIndex.value + 1, commands.length - 1)
        commandInput.value = commands[historyIndex.value] ?? ''
    }
    if (event.key === 'ArrowDown') {
        event.preventDefault()
        if (historyIndex.value <= 0) {
            historyIndex.value = -1
            commandInput.value = ''
            return
        }
        historyIndex.value -= 1
        const commands = entries.value.map((entry) => entry.command).reverse()
        commandInput.value = commands[historyIndex.value] ?? ''
    }
}

function applyHint(hint: RedisCommandHint) {
    commandInput.value = hint.example
    inputRef.value?.focus()
}

function clearOutput() {
    entries.value = []
}

watch(
    () => [props.connectionId, props.database] as const,
    () => {
        entries.value = []
        commandInput.value = ''
    },
)

watch(
    () => props.seedCommand,
    (command) => {
        if (!command) return
        commandInput.value = command
        void runCommand(command)
    },
)

defineExpose({runCommand})
</script>

<template>
  <div class="redis-command-panel">
    <div class="redis-command-panel__toolbar">
      <div class="redis-command-panel__quick">
        <button
            v-for="command in contextQuickCommands"
            :key="command"
            class="redis-command-panel__quick-btn"
            type="button"
            :disabled="!connectionId || running"
            @click="runCommand(command)"
        >
          {{ command }}
        </button>
      </div>
      <button class="redis-command-panel__clear" type="button" @click="clearOutput">
        {{ t('explorer.redisConsole.clear') }}
      </button>
    </div>

    <pre ref="outputRef" class="redis-command-panel__output">{{ outputText || t('explorer.redisConsole.outputEmpty') }}</pre>

    <ul v-if="commandHints.length && commandInput.trim()" class="redis-command-panel__hints">
      <li
          v-for="hint in commandHints"
          :key="hint.command"
          class="redis-command-panel__hint-item"
          @mousedown.prevent="applyHint(hint)"
      >
        <span class="redis-command-panel__hint-cmd">{{ hint.command }}</span>
        <span class="redis-command-panel__hint-example">{{ hint.example }}</span>
      </li>
    </ul>

    <form class="redis-command-panel__input-row" @submit.prevent="runCommand()">
      <span class="redis-command-panel__prompt">&gt;</span>
      <input
          ref="inputRef"
          v-model="commandInput"
          class="redis-command-panel__input"
          type="text"
          spellcheck="false"
          autocomplete="off"
          :placeholder="contextPlaceholder"
          :disabled="!connectionId || running"
          @keydown="onInputKeydown"
      />
      <button
          class="redis-command-panel__run"
          type="submit"
          :disabled="!connectionId || running || !commandInput.trim()"
      >
        {{ running ? t('explorer.redisConsole.running') : t('explorer.redisConsole.run') }}
      </button>
    </form>
    <p class="redis-command-panel__hint-text">{{ activeHintText }}</p>
  </div>
</template>

<style scoped>
.redis-command-panel {
  display: flex;
  flex-direction: column;
  gap: 8px;
  height: 100%;
  min-height: 0;
}

.redis-command-panel__toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}

.redis-command-panel__quick {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.redis-command-panel__quick-btn,
.redis-command-panel__clear {
  border: 1px solid var(--dw-border);
  border-radius: 999px;
  padding: 2px 10px;
  background: var(--dw-bg-editor);
  color: var(--dw-text);
  font-family: var(--dw-font-mono, ui-monospace, monospace);
  font-size: 11px;
  cursor: pointer;
}

.redis-command-panel__clear {
  flex-shrink: 0;
  font-family: inherit;
}

.redis-command-panel__output {
  flex: 1;
  min-height: 0;
  margin: 0;
  padding: 10px;
  overflow: auto;
  border: 1px solid var(--dw-border);
  border-radius: 8px;
  background: var(--dw-bg-editor);
  font-family: var(--dw-font-mono, ui-monospace, monospace);
  font-size: 12px;
  line-height: 1.5;
  white-space: pre-wrap;
  word-break: break-word;
}

.redis-command-panel__hints {
  margin: 0;
  padding: 0;
  list-style: none;
  border: 1px solid var(--dw-border);
  border-radius: 6px;
  background: var(--dw-bg-panel);
  max-height: 110px;
  overflow: auto;
}

.redis-command-panel__hint-item {
  display: flex;
  gap: 10px;
  padding: 6px 10px;
  cursor: pointer;
  font-size: 11px;
}

.redis-command-panel__hint-item:hover {
  background: color-mix(in srgb, var(--dw-primary) 10%, transparent);
}

.redis-command-panel__hint-cmd {
  font-family: var(--dw-font-mono, ui-monospace, monospace);
  font-weight: 600;
}

.redis-command-panel__hint-example {
  color: var(--dw-text-muted);
  font-family: var(--dw-font-mono, ui-monospace, monospace);
}

.redis-command-panel__input-row {
  display: flex;
  align-items: center;
  gap: 8px;
}

.redis-command-panel__prompt {
  color: var(--dw-primary);
  font-family: var(--dw-font-mono, ui-monospace, monospace);
  font-weight: 600;
}

.redis-command-panel__input {
  flex: 1;
  min-width: 0;
  border: 1px solid var(--dw-border);
  border-radius: 6px;
  padding: 8px 10px;
  background: var(--dw-bg-panel);
  color: var(--dw-text);
  font-family: var(--dw-font-mono, ui-monospace, monospace);
  font-size: 12px;
}

.redis-command-panel__run {
  border: 1px solid var(--dw-primary-ring);
  border-radius: 6px;
  padding: 8px 14px;
  background: var(--dw-primary-tint);
  color: var(--dw-primary);
  font-size: 12px;
  font-weight: 500;
  cursor: pointer;
}

.redis-command-panel__run:hover {
  background: var(--dw-primary-soft);
}

.redis-command-panel__hint-text {
  margin: 0;
  color: var(--dw-text-muted);
  font-size: 11px;
  line-height: 1.4;
}

.redis-command-panel__run:disabled,
.redis-command-panel__input:disabled,
.redis-command-panel__quick-btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}
</style>
