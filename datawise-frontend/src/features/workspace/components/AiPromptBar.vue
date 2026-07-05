<script setup lang="ts">
import {ref} from 'vue'
import {useI18n} from 'vue-i18n'
import AiIcon from '@/core/components/AiIcon.vue'
import {DwIcon} from '@/core/icons'

const props = withDefaults(
    defineProps<{
      contextLabel?: string | null
      generating?: boolean
      quickActions?: { id: string; label: string }[]
    }>(),
    {generating: false, quickActions: () => []},
)

const prompt = defineModel<string>({required: true})

const emit = defineEmits<{
  submit: []
  close: []
  quickAction: [id: string]
}>()

const inputRef = ref<HTMLInputElement>()
const {t} = useI18n()

function onKeydown(e: KeyboardEvent) {
  if (e.key === 'Enter') {
    e.preventDefault()
    if (!props.generating) emit('submit')
  }
  if (e.key === 'Escape') {
    emit('close')
  }
}

function focus() {
  inputRef.value?.focus()
}

defineExpose({focus, inputRef})
</script>

<template>
  <div class="ai-prompt-wrap">
    <div
        class="ai-prompt-panel"
        :class="{ 'is-sending': props.generating, 'has-quick-actions': quickActions.length > 0 }"
    >
      <div v-if="quickActions.length" class="ai-quick-actions">
        <button
            v-for="action in quickActions"
            :key="action.id"
            class="ai-quick-action"
            type="button"
            :disabled="generating"
            @click="emit('quickAction', action.id)"
        >
          {{ action.label }}
        </button>
      </div>

      <div class="ai-prompt-bar">
        <AiIcon class="ai-prompt-icon" :size="14"/>

        <div class="ai-prompt-field">
          <input
              ref="inputRef"
              v-model="prompt"
              class="ai-prompt-input"
              :aria-label="t('console.aiPromptAria')"
              :disabled="props.generating"
              :aria-busy="props.generating"
              @keydown="onKeydown"
          >
          <span
              v-if="!prompt.trim() && !props.generating"
              class="ai-prompt-hint"
              aria-hidden="true"
          >
            <span class="ai-prompt-hint-lead">{{ t('console.aiPromptHintLead') }}</span>
            <span class="ai-prompt-hint-example">{{ t('console.aiPromptHintExample') }}</span>
          </span>
        </div>

        <template v-if="contextLabel">
          <span class="ai-prompt-divider" aria-hidden="true"/>
          <span
              class="ai-context-tag"
              :title="t('console.aiQueryScope', { name: contextLabel })"
          >
            <DwIcon name="database" size="xs"/>
            <span class="ai-context-text">{{ contextLabel }}</span>
          </span>
        </template>

        <button
            class="ai-prompt-send"
            type="button"
            :title="props.generating ? t('console.generating') : t('console.aiPromptSubmit')"
            :aria-label="props.generating ? t('console.generating') : t('console.aiPromptSubmit')"
            :disabled="props.generating || !prompt.trim()"
            @click="emit('submit')"
        >
          <span v-if="props.generating" class="ai-prompt-send-spinner" aria-hidden="true"/>
          <DwIcon v-else name="send" size="sm" :stroke-width="1.6"/>
        </button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.ai-prompt-wrap {
  flex-shrink: 0;
}

.ai-prompt-panel {
  border-top: 1px solid color-mix(in srgb, var(--dw-border-light) 55%, transparent);
  background: color-mix(in srgb, var(--dw-bg-panel) 94%, var(--dw-bg-editor));
}

.ai-prompt-panel:focus-within {
  border-top-color: color-mix(in srgb, var(--dw-primary) 35%, var(--dw-border-light));
}

.ai-prompt-panel.is-sending {
  opacity: 0.88;
}

.ai-quick-actions {
  display: flex;
  flex-wrap: nowrap;
  gap: 4px;
  overflow-x: auto;
  padding: 3px 8px;
  border-bottom: 1px solid color-mix(in srgb, var(--dw-border-light) 55%, transparent);
}

.ai-quick-action {
  flex-shrink: 0;
  padding: 1px 8px;
  border: none;
  border-radius: 4px;
  background: transparent;
  color: var(--dw-text-secondary);
  font-size: 11px;
  cursor: pointer;
}

.ai-quick-action:hover:not(:disabled) {
  color: var(--dw-text);
  background: color-mix(in srgb, var(--dw-bg-muted) 40%, transparent);
}

.ai-quick-action:disabled {
  opacity: 0.45;
  cursor: not-allowed;
}

.ai-prompt-bar {
  display: flex;
  align-items: center;
  gap: 0;
  height: 30px;
}

.ai-prompt-icon {
  flex-shrink: 0;
  margin-left: 8px;
  color: var(--dw-text-muted);
}

.ai-prompt-panel:focus-within .ai-prompt-icon {
  color: var(--dw-primary);
}

.ai-prompt-field {
  position: relative;
  flex: 1;
  min-width: 0;
  height: 100%;
  display: flex;
  align-items: center;
}

.ai-prompt-input {
  width: 100%;
  height: 100%;
  padding: 0 6px;
  margin: 0;
  border: none;
  outline: none;
  background: transparent;
  color: var(--dw-text-primary);
  font-size: 12px;
  font-family: inherit;
}

.ai-prompt-hint {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 0 6px;
  overflow: hidden;
  white-space: nowrap;
  text-overflow: ellipsis;
  pointer-events: none;
}

.ai-prompt-hint-lead {
  flex-shrink: 0;
  color: color-mix(in srgb, var(--dw-text-muted) 88%, transparent);
  font-size: 12px;
}

.ai-prompt-hint-example {
  flex-shrink: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  color: color-mix(in srgb, var(--dw-text-muted) 62%, transparent);
  font-size: 12px;
}

.ai-prompt-input:disabled {
  cursor: not-allowed;
  opacity: 0.72;
}

.ai-prompt-divider {
  flex-shrink: 0;
  width: 1px;
  height: 16px;
  margin: 0 6px;
  background: color-mix(in srgb, var(--dw-border-light) 70%, transparent);
}

.ai-context-tag {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  max-width: 140px;
  flex-shrink: 0;
  padding-right: 2px;
  color: var(--dw-text-secondary);
  font-size: 11px;
  font-family: var(--dw-mono);
}

.ai-context-tag svg {
  flex-shrink: 0;
  color: var(--dw-text-muted);
}

.ai-context-text {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.ai-prompt-send {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  width: 22px;
  height: 22px;
  margin-right: 4px;
  padding: 0;
  border: none;
  border-radius: 4px;
  background: transparent;
  color: var(--dw-text-muted);
  cursor: pointer;
}

.ai-prompt-send:not(:disabled):hover {
  color: var(--dw-primary);
  background: color-mix(in srgb, var(--dw-bg-muted) 40%, transparent);
}

.ai-prompt-send:disabled {
  opacity: 0.35;
  cursor: default;
}

.ai-prompt-send-spinner {
  width: 12px;
  height: 12px;
  border: 2px solid color-mix(in srgb, var(--dw-text-muted) 28%, transparent);
  border-top-color: var(--dw-primary);
  border-radius: 50%;
  animation: ai-prompt-spin 0.7s linear infinite;
}

@keyframes ai-prompt-spin {
  to {
    transform: rotate(360deg);
  }
}
</style>
