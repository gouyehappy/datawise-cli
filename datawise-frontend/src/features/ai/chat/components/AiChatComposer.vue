<script setup lang="ts">
/**
 * AI 聊天输入区（豆包式一体化卡片：输�?+ 底部工具栏）
 */
import {nextTick, ref, watch} from 'vue'
import {useI18n} from 'vue-i18n'
import DbTypeIcon from '@/core/components/DbTypeIcon.vue'
import {DB_TYPE_ICON_SIZE} from '@/features/connection/constants/db-type-icon-sizes'
import {TagChip} from '@/core/components'
import {DwIcon} from '@/core/icons'
import {createId} from '@/core/utils/id'
import AiModelSelect from '@/features/ai/shared/components/AiModelSelect.vue'
import {useToastStore} from '@/features/layout/stores/toast-store'
import {currentLocale} from '@/i18n'
import type {AiDatabaseTarget} from '@/features/ai/shared/utils/database-targets'

import {buildPromptWithAttachments, type ChatAttachment} from '@/features/ai/chat/services/chat-attachment.service'

interface BrowserSpeechRecognition {
  lang: string
  interimResults: boolean
  maxAlternatives: number
  onresult: ((event: { results: { [index: number]: { [index: number]: { transcript?: string } } } }) => void) | null
  onerror: (() => void) | null
  onend: (() => void) | null
  start: () => void
}

const props = defineProps<{
  modelValue: string
  sending: boolean
  selectedTargets: AiDatabaseTarget[]
  formatTargetLabel: (target: AiDatabaseTarget) => string
}>()

const emit = defineEmits<{
  'update:modelValue': [value: string]
  send: [prompt: string]
  removeTarget: [id: string]
  keydown: [event: KeyboardEvent]
}>()

const {t} = useI18n()
const toast = useToastStore()
const textareaRef = ref<HTMLTextAreaElement>()
const fileInputRef = ref<HTMLInputElement>()
const attachments = ref<ChatAttachment[]>([])
const listening = ref(false)

function resizeTextarea() {
  const el = textareaRef.value
  if (!el) return
  el.style.height = 'auto'
  el.style.height = `${Math.min(el.scrollHeight, 128)}px`
}

function onInput(event: Event) {
  emit('update:modelValue', (event.target as HTMLTextAreaElement).value)
  resizeTextarea()
}

function notifySkippedAttachments(skipped: string[]) {
  if (!skipped.length) return
  toast.show(t('ai.composer.attachmentSkipped', {names: skipped.join(', ')}))
}

async function buildSendPayload(prompt: string) {
  const {prompt: combined, skipped} = await buildPromptWithAttachments(prompt, attachments.value)
  notifySkippedAttachments(skipped)
  clearAttachments()
  return combined
}

function onKeydown(event: KeyboardEvent) {
  emit('keydown', event)
}

function focus() {
  textareaRef.value?.focus()
}

function pickFiles() {
  fileInputRef.value?.click()
}

function onFilesSelected(event: Event) {
  const input = event.target as HTMLInputElement
  const files = input.files
  if (!files?.length) return
  for (const file of files) {
    attachments.value.push({id: createId('file'), name: file.name, file})
  }
  input.value = ''
}

function removeAttachment(id: string) {
  attachments.value = attachments.value.filter((item) => item.id !== id)
}

function clearAttachments() {
  attachments.value = []
}

function startVoiceInput() {
  if (listening.value) return
  const win = window as Window & {
    SpeechRecognition?: new () => BrowserSpeechRecognition
    webkitSpeechRecognition?: new () => BrowserSpeechRecognition
  }
  const SpeechRecognitionCtor = win.SpeechRecognition ?? win.webkitSpeechRecognition

  if (!SpeechRecognitionCtor) {
    toast.show(t('ai.composer.voiceUnsupported'))
    return
  }

  const recognition = new SpeechRecognitionCtor()
  recognition.lang = currentLocale.value === 'zh-CN' ? 'zh-CN' : 'en-US'
  recognition.interimResults = false
  recognition.maxAlternatives = 1
  listening.value = true

  recognition.onresult = (event: { results: { [index: number]: { [index: number]: { transcript?: string } } } }) => {
    const transcript = event.results[0]?.[0]?.transcript?.trim()
    if (transcript) {
      const next = props.modelValue.trim()
          ? `${props.modelValue.trimEnd()} ${transcript}`
          : transcript
      emit('update:modelValue', next)
      nextTick(resizeTextarea)
    }
  }

  recognition.onerror = () => {
    toast.show(t('ai.composer.voiceFailed'))
  }

  recognition.onend = () => {
    listening.value = false
  }

  recognition.start()
}

watch(
    () => props.modelValue,
    async () => {
      await nextTick()
      resizeTextarea()
    },
)

function handleSend() {
  void buildSendPayload(props.modelValue.trim()).then((prompt) => {
    if (!prompt) return
    emit('send', prompt)
  })
}

function getAttachments(): ChatAttachment[] {
  return [...attachments.value]
}

defineExpose({
  focus,
  textareaRef,
  clearAttachments,
  getAttachments,
  buildSendPayload,
})
</script>

<template>
  <footer class="composer-wrap">
    <div v-if="selectedTargets.length" class="composer-targets">
      <TagChip
          v-for="target in selectedTargets"
          :key="target.id"
          removable
          :remove-label="t('common.close')"
          @remove="emit('removeTarget', target.id)"
      >
        <template #icon>
          <DbTypeIcon :db-type="target.dbType" :size="DB_TYPE_ICON_SIZE.compact"/>
        </template>
        {{ formatTargetLabel(target) }}
      </TagChip>
    </div>

    <div class="composer-card" :class="{ 'is-sending': sending, 'is-listening': listening }">
      <div v-if="attachments.length" class="composer-attachments">
        <TagChip
            v-for="item in attachments"
            :key="item.id"
            removable
            :remove-label="t('common.close')"
            @remove="removeAttachment(item.id)"
        >
          <template #icon>
            <DwIcon name="file" size="sm" :stroke-width="1.4"/>
          </template>
          {{ item.name }}
        </TagChip>
      </div>

      <textarea
          ref="textareaRef"
          class="composer-input"
          :value="modelValue"
          :placeholder="t('ai.composer.placeholder')"
          :disabled="sending"
          rows="1"
          @input="onInput"
          @keydown="onKeydown"
      />

      <div class="composer-toolbar">
        <input
            ref="fileInputRef"
            class="composer-file-input"
            type="file"
            multiple
            tabindex="-1"
            aria-hidden="true"
            @change="onFilesSelected"
        />

        <button
            class="tool-btn"
            type="button"
            :title="t('ai.composer.attach')"
            :aria-label="t('ai.composer.attach')"
            :disabled="sending"
            @click="pickFiles"
        >
          <DwIcon name="plus" size="md" :stroke-width="1.6"/>
        </button>

        <AiModelSelect variant="composer"/>

        <div class="composer-toolbar__spacer"/>

        <div class="composer-toolbar__end">
          <button
              class="tool-btn"
              :class="{ 'tool-btn--active': listening }"
              type="button"
              :title="t('ai.composer.voice')"
              :aria-label="t('ai.composer.voice')"
              :disabled="sending"
              @click="startVoiceInput"
          >
            <DwIcon name="mic" size="md" :stroke-width="1.5"/>
          </button>

          <button
              class="send-btn"
              type="button"
              :disabled="sending || !modelValue.trim()"
              :title="t('common.send')"
              :aria-label="t('common.send')"
              @click="handleSend"
          >
            <span v-if="sending" class="send-btn__spin" aria-hidden="true"/>
            <DwIcon v-else name="send" size="sm" filled/>
          </button>
        </div>
      </div>
    </div>
  </footer>
</template>

<style scoped>
.composer-wrap {
  flex-shrink: 0;
  padding: 12px 24px 16px;
}

.composer-targets {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-bottom: 10px;
}

.composer-card {
  border: 1px solid var(--dw-border-light);
  border-radius: 18px;
  background: var(--dw-bg);
  box-shadow: 0 1px 2px rgba(15, 23, 42, 0.04),
  0 8px 24px rgba(15, 23, 42, 0.05);
  padding: 14px 14px 10px;
  transition: border-color 0.18s ease,
  box-shadow 0.18s ease;
}

.composer-card:focus-within {
  border-color: color-mix(in srgb, var(--dw-border) 70%, var(--dw-text-muted));
  box-shadow: 0 1px 2px rgba(15, 23, 42, 0.04),
  0 10px 28px rgba(15, 23, 42, 0.07);
}

.composer-card.is-listening {
  border-color: color-mix(in srgb, var(--dw-primary) 35%, var(--dw-border));
}

.composer-attachments {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin-bottom: 8px;
}

.composer-input {
  display: block;
  width: 100%;
  min-height: 48px;
  max-height: 128px;
  padding: 0;
  margin: 0;
  border: none;
  outline: none;
  resize: none;
  background: transparent;
  color: var(--dw-text);
  font-size: 14px;
  line-height: 1.55;
  font-family: inherit;
}

.composer-input::placeholder {
  color: var(--dw-text-muted);
}

.composer-input:disabled {
  opacity: 0.65;
  cursor: not-allowed;
}

.composer-toolbar {
  display: flex;
  align-items: center;
  gap: 4px;
  margin-top: 6px;
  padding-top: 8px;
  border-top: 1px solid var(--dw-border-light);
  min-width: 0;
  min-height: 34px;
}

.composer-file-input {
  position: absolute;
  width: 0;
  height: 0;
  opacity: 0;
  pointer-events: none;
}

.composer-toolbar__spacer {
  flex: 1;
  min-width: 8px;
}

.composer-toolbar__end {
  display: flex;
  align-items: center;
  gap: 6px;
  flex-shrink: 0;
}

.tool-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  padding: 0;
  border: none;
  border-radius: 999px;
  background: var(--dw-bg-muted);
  color: var(--dw-text-secondary);
  cursor: pointer;
  transition: background 0.15s ease, color 0.15s ease;
}

.tool-btn:hover:not(:disabled) {
  background: var(--dw-bg-hover);
  color: var(--dw-text);
}

.tool-btn:disabled {
  opacity: 0.45;
  cursor: not-allowed;
}

.tool-btn--active {
  background: color-mix(in srgb, var(--dw-primary) 12%, var(--dw-bg-muted));
  color: var(--dw-primary);
}

.send-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  padding: 0;
  border: none;
  border-radius: 999px;
  background: var(--dw-text);
  color: var(--dw-bg);
  cursor: pointer;
  transition: opacity 0.15s ease, transform 0.15s ease;
}

.send-btn:hover:not(:disabled) {
  opacity: 0.9;
  transform: scale(1.04);
}

.send-btn:disabled {
  opacity: 0.35;
  cursor: not-allowed;
}

.send-btn__spin {
  width: 14px;
  height: 14px;
  border: 2px solid color-mix(in srgb, var(--dw-bg) 35%, transparent);
  border-top-color: var(--dw-bg);
  border-radius: 50%;
  animation: composer-spin 0.7s linear infinite;
}

@keyframes composer-spin {
  to {
    transform: rotate(360deg);
  }
}
</style>
