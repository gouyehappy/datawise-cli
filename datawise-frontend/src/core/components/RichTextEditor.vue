<script setup lang="ts">
import {nextTick, onMounted, ref, watch} from 'vue'
import IconButton from '@/core/components/IconButton.vue'
import {DwIcon} from '@/core/icons'
import {htmlToPlainText} from '@/features/ssh/services/ssh-html-text.service'

const model = defineModel<string>({default: ''})

const props = withDefaults(defineProps<{
  placeholder?: string
  readonly?: boolean
}>(), {
  placeholder: '',
  readonly: false,
})

const editorRef = ref<HTMLDivElement | null>(null)
const syncing = ref(false)

function readHtml(): string {
  return editorRef.value?.innerHTML ?? ''
}

function emitValue() {
  if (syncing.value || props.readonly) return
  model.value = readHtml()
}

function applyCommand(command: string, value?: string) {
  if (props.readonly) return
  editorRef.value?.focus()
  document.execCommand(command, false, value)
  emitValue()
}

function insertLink() {
  if (props.readonly) return
  const url = window.prompt('URL')
  if (!url?.trim()) return
  applyCommand('createLink', url.trim())
}

function wrapSelection(tag: string) {
  if (props.readonly) return
  const selection = window.getSelection()
  if (!selection || selection.rangeCount === 0) return
  const range = selection.getRangeAt(0)
  const selected = range.toString()
  if (!selected) return
  applyCommand('insertHTML', `<${tag}>${escapeHtml(selected)}</${tag}>`)
}

function escapeHtml(value: string): string {
  return value
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
}

function insertHorizontalRule() {
  applyCommand('insertHorizontalRule')
}

async function syncEditor(value: string) {
  const editor = editorRef.value
  if (!editor) return
  const normalized = value || ''
  if (editor.innerHTML === normalized) return
  syncing.value = true
  editor.innerHTML = normalized
  await nextTick()
  syncing.value = false
}

watch(model, (value) => {
  void syncEditor(value)
}, {immediate: true})

onMounted(() => {
  void syncEditor(model.value)
})

defineExpose({
  getHtml: readHtml,
  getPlainText: () => htmlToPlainText(readHtml()),
  focus: () => editorRef.value?.focus(),
})
</script>

<template>
  <div class="rich-text-editor" :class="{'is-readonly': readonly}">
    <div v-if="!readonly" class="rich-text-editor__toolbar" role="toolbar">
      <IconButton size="sm" title="Undo" @click="applyCommand('undo')">
        <span class="rich-text-editor__action-label">↶</span>
      </IconButton>
      <IconButton size="sm" title="Redo" @click="applyCommand('redo')">
        <span class="rich-text-editor__action-label">↷</span>
      </IconButton>
      <span class="rich-text-editor__divider"/>
      <IconButton size="sm" title="Bold" @click="applyCommand('bold')">
        <strong>B</strong>
      </IconButton>
      <IconButton size="sm" title="Italic" @click="applyCommand('italic')">
        <em>I</em>
      </IconButton>
      <IconButton size="sm" title="Underline" @click="applyCommand('underline')">
        <span class="rich-text-editor__underline">U</span>
      </IconButton>
      <IconButton size="sm" title="Strikethrough" @click="applyCommand('strikeThrough')">
        <span class="rich-text-editor__strike">S</span>
      </IconButton>
      <span class="rich-text-editor__divider"/>
      <IconButton size="sm" title="Heading 1" @click="applyCommand('formatBlock', 'h1')">H1</IconButton>
      <IconButton size="sm" title="Heading 2" @click="applyCommand('formatBlock', 'h2')">H2</IconButton>
      <IconButton size="sm" title="Heading 3" @click="applyCommand('formatBlock', 'h3')">H3</IconButton>
      <IconButton size="sm" title="Paragraph" @click="applyCommand('formatBlock', 'p')">P</IconButton>
      <span class="rich-text-editor__divider"/>
      <IconButton size="sm" title="Bullet list" @click="applyCommand('insertUnorderedList')">
        <DwIcon name="menu-group" size="sm"/>
      </IconButton>
      <IconButton size="sm" title="Numbered list" @click="applyCommand('insertOrderedList')">
        <DwIcon name="list-ordered" size="sm"/>
      </IconButton>
      <IconButton size="sm" title="Quote" @click="applyCommand('formatBlock', 'blockquote')">
        <DwIcon name="comment-all" size="sm"/>
      </IconButton>
      <IconButton size="sm" title="Code block" @click="applyCommand('formatBlock', 'pre')">
        <DwIcon name="command" size="sm"/>
      </IconButton>
      <IconButton size="sm" title="Inline code" @click="wrapSelection('code')">
        <span class="rich-text-editor__inline-code">&lt;/&gt;</span>
      </IconButton>
      <IconButton size="sm" title="Horizontal rule" @click="insertHorizontalRule">
        <span class="rich-text-editor__hr">—</span>
      </IconButton>
      <IconButton size="sm" title="Link" @click="insertLink">
        <DwIcon name="link" size="sm"/>
      </IconButton>
      <IconButton size="sm" title="Clear formatting" @click="applyCommand('removeFormat')">
        <DwIcon name="format" size="sm"/>
      </IconButton>
    </div>
    <div
        ref="editorRef"
        class="rich-text-editor__body"
        :contenteditable="!readonly"
        :data-placeholder="placeholder"
        @input="emitValue"
        @blur="emitValue"
        @keyup="emitValue"
        @paste="() => nextTick(emitValue)"
    />
  </div>
</template>

<style scoped>
.rich-text-editor {
  display: flex;
  flex-direction: column;
  min-height: 0;
  border: 1px solid var(--dw-border);
  border-radius: var(--dw-control-radius);
  background: var(--dw-bg-panel);
  overflow: hidden;
}

.rich-text-editor__toolbar {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: var(--dw-gap-xs);
  padding: var(--dw-pad-tight);
  border-bottom: 1px solid var(--dw-border);
  background: color-mix(in srgb, var(--dw-bg-panel) 92%, var(--dw-text) 8%);
}

.rich-text-editor__divider {
  width: 1px;
  height: var(--dw-icon-size-lg);
  margin: 0 var(--dw-space-2);
  background: var(--dw-border);
}

.rich-text-editor__action-label {
  font-size: var(--dw-text-xl);
  line-height: 1;
}

.rich-text-editor__underline {
  text-decoration: underline;
}

.rich-text-editor__strike {
  text-decoration: line-through;
}

.rich-text-editor__inline-code {
  font-family: var(--dw-font-mono);
  font-size: var(--dw-text-xs);
}

.rich-text-editor__hr {
  font-weight: 700;
}

.rich-text-editor__body {
  flex: 1;
  min-height: 280px;
  padding: var(--dw-space-7) var(--dw-space-8);
  overflow: auto;
  line-height: var(--dw-leading-loose);
  color: var(--dw-text);
  outline: none;
}

.rich-text-editor__body:empty::before {
  content: attr(data-placeholder);
  color: var(--dw-text-muted);
  pointer-events: none;
}

.rich-text-editor__body :deep(h1),
.rich-text-editor__body :deep(h2),
.rich-text-editor__body :deep(h3) {
  margin: 0.6em 0 0.35em;
  font-weight: 600;
}

.rich-text-editor__body :deep(p) {
  margin: 0.35em 0;
}

.rich-text-editor__body :deep(ul),
.rich-text-editor__body :deep(ol) {
  margin: 0.35em 0;
  padding-left: 1.4em;
}

.rich-text-editor__body :deep(blockquote) {
  margin: 0.5em 0;
  padding: 0.35em 0.8em;
  border-left: 3px solid var(--dw-primary);
  color: var(--dw-text-muted);
}

.rich-text-editor__body :deep(pre),
.rich-text-editor__body :deep(code) {
  font-family: var(--dw-font-mono);
}

.rich-text-editor__body :deep(pre) {
  margin: 0.5em 0;
  padding: var(--dw-pad-control-lg);
  border-radius: var(--dw-control-radius-sm);
  background: color-mix(in srgb, var(--dw-bg-panel) 80%, var(--dw-text) 20%);
  white-space: pre-wrap;
}

.rich-text-editor__body :deep(code) {
  padding: 0.1em 0.35em;
  border-radius: var(--dw-radius-sm);
  background: color-mix(in srgb, var(--dw-bg-panel) 84%, var(--dw-text) 16%);
}

.rich-text-editor__body :deep(a) {
  color: var(--dw-primary);
}

.rich-text-editor__body :deep(hr) {
  margin: 0.8em 0;
  border: none;
  border-top: 1px solid var(--dw-border);
}

.rich-text-editor.is-readonly .rich-text-editor__body {
  background: color-mix(in srgb, var(--dw-bg-panel) 96%, var(--dw-text) 4%);
}
</style>
