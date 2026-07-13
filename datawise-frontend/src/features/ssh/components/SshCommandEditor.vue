<script setup lang="ts">
import {computed} from 'vue'
import {useI18n} from 'vue-i18n'
import {parseCommandEntries} from '@/features/ssh/services/ssh-my-commands.service'
import {SSH_COMMAND_TEMPLATE} from '@/features/ssh/services/ssh-script-record-content.service'

const model = defineModel<string>({default: ''})

const props = defineProps<{
  placeholder?: string
}>()

const {t} = useI18n()

const previewEntries = computed(() => parseCommandEntries(model.value ?? '').entries)

function insertTemplate() {
  const current = model.value ?? ''
  model.value = current.trim() ? `${current.replace(/\s+$/, '')}\n\n${SSH_COMMAND_TEMPLATE}` : SSH_COMMAND_TEMPLATE
}

function onKeydown(event: KeyboardEvent) {
  if (event.key !== 'Tab') return
  event.preventDefault()
  const target = event.target
  if (!(target instanceof HTMLTextAreaElement)) return
  const start = target.selectionStart ?? 0
  const end = target.selectionEnd ?? start
  const value = model.value ?? ''
  model.value = `${value.slice(0, start)}  ${value.slice(end)}`
  requestAnimationFrame(() => {
    target.selectionStart = start + 2
    target.selectionEnd = start + 2
  })
}
</script>

<template>
  <div class="ssh-command-editor">
    <div class="ssh-command-editor__guide">
      <div class="ssh-command-editor__guide-head">
        <span>{{ t('ssh.scriptRecord.commandFormatTitle') }}</span>
        <button type="button" class="ssh-command-editor__insert" @click="insertTemplate">
          {{ t('ssh.scriptRecord.insertTemplate') }}
        </button>
      </div>
      <p>{{ t('ssh.scriptRecord.commandFormatHint') }}</p>
    </div>

    <div v-if="previewEntries.length" class="ssh-command-editor__preview">
      <span class="ssh-command-editor__preview-label">{{ t('ssh.scriptRecord.preview') }}</span>
      <div class="ssh-command-editor__preview-list">
        <div
            v-for="(entry, index) in previewEntries"
            :key="index"
            class="ssh-command-editor__preview-item"
        >
          <span class="ssh-command-editor__preview-name">{{ entry.label }}</span>
          <code class="ssh-command-editor__preview-cmd">{{ entry.command }}</code>
        </div>
      </div>
    </div>

    <textarea
        v-model="model"
        class="ssh-command-editor__textarea"
        spellcheck="false"
        :placeholder="props.placeholder"
        @keydown="onKeydown"
    />
  </div>
</template>

<style scoped>
.ssh-command-editor {
  display: flex;
  flex-direction: column;
  gap: 10px;
  height: 100%;
  min-height: 0;
}

.ssh-command-editor__guide {
  padding: 10px 12px;
  border: 1px solid color-mix(in srgb, var(--dw-border) 80%, transparent);
  border-radius: 8px;
  background: color-mix(in srgb, var(--dw-bg-panel) 90%, transparent);
}

.ssh-command-editor__guide-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  margin-bottom: 4px;
  font-size: 12px;
  font-weight: 600;
  color: var(--dw-text);
}

.ssh-command-editor__guide p {
  margin: 0;
  color: var(--dw-text-muted);
  font-size: 12px;
  line-height: 1.5;
  white-space: pre-line;
}

.ssh-command-editor__insert {
  border: 1px solid var(--dw-border);
  border-radius: 6px;
  padding: 2px 8px;
  background: var(--dw-bg);
  color: var(--dw-primary);
  font-size: 11px;
  cursor: pointer;
}

.ssh-command-editor__insert:hover {
  border-color: color-mix(in srgb, var(--dw-primary) 40%, var(--dw-border));
}

.ssh-command-editor__preview {
  display: flex;
  align-items: flex-start;
  gap: 10px;
  padding: 8px 10px;
  border: 1px dashed color-mix(in srgb, #0ea5e9 30%, var(--dw-border));
  border-radius: 8px;
  background: color-mix(in srgb, #0ea5e9 5%, var(--dw-bg));
  max-height: 8rem;
  overflow-y: auto;
}

.ssh-command-editor__preview-label {
  flex: 0 0 auto;
  padding-top: 2px;
  font-size: 11px;
  font-weight: 600;
  color: var(--dw-text-muted);
}

.ssh-command-editor__preview-list {
  display: flex;
  flex-direction: column;
  gap: 6px;
  min-width: 0;
  flex: 1;
}

.ssh-command-editor__preview-item {
  display: flex;
  align-items: baseline;
  gap: 8px;
  min-width: 0;
}

.ssh-command-editor__preview-name {
  flex: 0 0 auto;
  padding: 1px 8px;
  border-radius: 999px;
  background: color-mix(in srgb, #0ea5e9 14%, transparent);
  color: #0369a1;
  font-size: 11px;
  font-weight: 600;
  white-space: nowrap;
}

.ssh-command-editor__preview-cmd {
  min-width: 0;
  color: var(--dw-text);
  font-family: Consolas, 'Cascadia Mono', 'Courier New', monospace;
  font-size: 12px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.ssh-command-editor__textarea {
  flex: 1;
  min-height: 200px;
  width: 100%;
  padding: 14px 16px;
  border: 1px solid var(--dw-border);
  border-radius: 10px;
  background: #1a1d24;
  color: #e5e7eb;
  font-family: Consolas, 'Cascadia Mono', 'Courier New', monospace;
  font-size: 13px;
  line-height: 1.55;
  resize: none;
  tab-size: 2;
  outline: none;
}

.ssh-command-editor__textarea:focus {
  border-color: color-mix(in srgb, var(--dw-primary) 45%, var(--dw-border));
  box-shadow: 0 0 0 2px color-mix(in srgb, var(--dw-primary) 12%, transparent);
}

.ssh-command-editor__textarea::placeholder {
  color: #6b7280;
}
</style>
