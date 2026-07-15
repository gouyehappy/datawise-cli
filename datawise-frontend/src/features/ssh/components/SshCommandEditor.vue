<script setup lang="ts">
import {computed} from 'vue'
import {useI18n} from 'vue-i18n'
import type * as monaco from 'monaco-editor'
import MonacoEditor from '@/core/components/MonacoEditor.vue'
import {parseCommandEntries} from '@/features/ssh/services/ssh-my-commands.service'
import {SSH_COMMAND_TEMPLATE} from '@/features/ssh/services/ssh-script-record-content.service'
import {
    ensureSshCommandMonacoLanguage,
    SSH_COMMAND_MONACO_LANGUAGE,
} from '@/features/ssh/services/ssh-command-monaco.language'

ensureSshCommandMonacoLanguage()

const model = defineModel<string>({default: ''})

const props = defineProps<{
  placeholder?: string
  readonly?: boolean
}>()

const {t} = useI18n()

const previewEntries = computed(() => parseCommandEntries(model.value ?? '').commands)

const editorOptions: monaco.editor.IStandaloneEditorConstructionOptions = {
  minimap: {enabled: false},
  wordWrap: 'on',
  lineNumbers: 'on',
  glyphMargin: false,
  folding: false,
  renderLineHighlight: 'line',
  scrollbar: {
    verticalScrollbarSize: 10,
    horizontalScrollbarSize: 10,
  },
  suggestOnTriggerCharacters: true,
  quickSuggestions: {other: true, comments: false, strings: true},
  ariaLabel: props.placeholder || 'SSH quick commands',
}

function insertTemplate() {
  const current = model.value ?? ''
  model.value = current.trim()
      ? `${current.replace(/\s+$/, '')}\n\n${SSH_COMMAND_TEMPLATE}`
      : SSH_COMMAND_TEMPLATE
}

function modeLabel(mode: 'run' | 'paste'): string {
  return mode === 'run' ? t('ssh.scriptRecord.previewModeRun') : t('ssh.scriptRecord.previewModePaste')
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
          <span
              class="ssh-command-editor__preview-mode"
              :class="entry.mode === 'run' ? 'is-run' : 'is-paste'"
          >{{ modeLabel(entry.mode) }}</span>
          <span
              v-if="entry.title.trim()"
              class="ssh-command-editor__preview-name"
          >{{ entry.title.trim() }}</span>
          <span
              v-if="entry.description.trim()"
              class="ssh-command-editor__preview-desc"
              :title="entry.description.trim()"
          >{{ entry.description.trim() }}</span>
          <code class="ssh-command-editor__preview-cmd">{{ entry.command }}</code>
        </div>
      </div>
    </div>

    <div class="ssh-command-editor__monaco" :class="{'is-readonly': props.readonly}">
      <MonacoEditor
          v-model="model"
          :language="SSH_COMMAND_MONACO_LANGUAGE"
          :readonly="props.readonly"
          :extra-options="editorOptions"
      />
    </div>
  </div>
</template>

<style scoped>
.ssh-command-editor {
  display: flex;
  flex-direction: column;
  gap: var(--dw-gap-md);
  height: 100%;
  min-height: 0;
}

.ssh-command-editor__guide {
  flex-shrink: 0;
  padding: var(--dw-pad-control-lg);
  border: 1px solid color-mix(in srgb, var(--dw-border) 80%, transparent);
  border-radius: var(--dw-control-radius);
  background: color-mix(in srgb, var(--dw-bg-panel) 90%, transparent);
}

.ssh-command-editor__guide-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--dw-gap);
  margin-bottom: var(--dw-space-2);
  font-size: var(--dw-text-sm);
  font-weight: 600;
  color: var(--dw-text);
}

.ssh-command-editor__guide p {
  margin: 0;
  color: var(--dw-text-muted);
  font-size: var(--dw-text-sm);
  line-height: var(--dw-leading-relaxed);
  white-space: pre-line;
}

.ssh-command-editor__insert {
  border: 1px solid var(--dw-border);
  border-radius: var(--dw-control-radius-sm);
  padding: var(--dw-pad-chip);
  background: var(--dw-bg);
  color: var(--dw-primary);
  font-size: var(--dw-text-xs);
  cursor: pointer;
}

.ssh-command-editor__insert:hover {
  border-color: color-mix(in srgb, var(--dw-primary) 40%, var(--dw-border));
}

.ssh-command-editor__preview {
  display: flex;
  align-items: flex-start;
  gap: var(--dw-gap-md);
  flex-shrink: 0;
  padding: var(--dw-pad-control);
  border: 1px dashed color-mix(in srgb, var(--dw-info) 30%, var(--dw-border));
  border-radius: var(--dw-control-radius);
  background: color-mix(in srgb, var(--dw-info) 5%, var(--dw-bg));
  max-height: 8rem;
  overflow-y: auto;
}

.ssh-command-editor__preview-label {
  flex: 0 0 auto;
  padding-top: var(--dw-space-1);
  font-size: var(--dw-text-xs);
  font-weight: 600;
  color: var(--dw-text-muted);
}

.ssh-command-editor__preview-list {
  display: flex;
  flex-direction: column;
  gap: var(--dw-gap-sm);
  min-width: 0;
  flex: 1;
}

.ssh-command-editor__preview-item {
  display: flex;
  align-items: baseline;
  gap: var(--dw-gap);
  min-width: 0;
}

.ssh-command-editor__preview-mode {
  flex: 0 0 auto;
  padding: 1px var(--dw-space-3);
  border-radius: var(--dw-radius-sm);
  font-size: var(--dw-text-xs);
  font-weight: 600;
  letter-spacing: 0.02em;
  white-space: nowrap;
}

.ssh-command-editor__preview-mode.is-run {
  background: color-mix(in srgb, var(--dw-success) 16%, transparent);
  color: var(--dw-success-fg);
}

.ssh-command-editor__preview-mode.is-paste {
  background: color-mix(in srgb, var(--dw-info) 14%, transparent);
  color: var(--dw-info-fg);
}

.ssh-command-editor__preview-name {
  flex: 0 0 auto;
  padding: 1px var(--dw-space-4);
  border-radius: var(--dw-radius-pill);
  background: color-mix(in srgb, var(--dw-info) 14%, transparent);
  color: var(--dw-info-fg);
  font-size: var(--dw-text-xs);
  font-weight: 600;
  white-space: nowrap;
}

.ssh-command-editor__preview-desc {
  flex: 0 1 auto;
  max-width: 10rem;
  color: var(--dw-text-muted);
  font-size: var(--dw-text-xs);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.ssh-command-editor__preview-cmd {
  min-width: 0;
  color: var(--dw-text);
  font-family: Consolas, 'Cascadia Mono', 'Courier New', monospace;
  font-size: var(--dw-text-sm);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.ssh-command-editor__monaco {
  flex: 1;
  min-height: 280px;
  border: 1px solid var(--dw-border);
  border-radius: var(--dw-radius-lg);
  overflow: hidden;
  background: var(--dw-bg-editor);
}

.ssh-command-editor__monaco.is-readonly {
  opacity: 0.75;
}
</style>
