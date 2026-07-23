<script setup lang="ts">
import {computed, onBeforeUnmount, onMounted, ref, watch} from 'vue'
import * as monaco from 'monaco-editor'
import {formatSql} from '@datawise/sql-editor/utils/format'
import type {EditorThemeId} from '@/features/settings/constants/editor-presets'
import {useEditorSettingsStore} from '@/features/settings/stores/editor-settings'
import {ensureMonacoThemes} from '@/features/settings/services/monaco-themes'
import {
  buildMinimapOptions,
  toMonacoAppearanceOptions,
} from '@/features/settings/services/editor-settings.service'
import '@/styles/editor-minimap.css'

const LIGHT_EDITOR_THEMES = new Set<EditorThemeId>(['github-light'])

const props = defineProps<{
  modelValue: string
  language?: string
  readonly?: boolean
  /** 设置页预览：不响应右键菜单 */
  preview?: boolean
  /** 覆盖/追加 Monaco 选项（如 SQL 工程师模式） */
  extraOptions?: monaco.editor.IStandaloneEditorConstructionOptions
}>()

const emit = defineEmits<{
  'update:modelValue': [value: string]
  contextmenu: [payload: { x: number; y: number; selectedText: string }]
  'cursor-change': [payload: { lineNumber: number; column: number; offset: number }]
}>()

const editorSettings = useEditorSettingsStore()
const containerRef = ref<HTMLElement>()
let editor: monaco.editor.IStandaloneCodeEditor | null = null

const minimapTone = computed(() =>
    LIGHT_EDITOR_THEMES.has(editorSettings.settings.theme) ? 'light' : 'dark',
)

function getSelectedText(): string {
  if (!editor) return ''
  const selection = editor.getSelection()
  const model = editor.getModel()
  if (!selection || !model) return ''
  return model.getValueInRange(selection)
}

function getExecutableSql(): string {
  const selected = getSelectedText().trim()
  return selected || (editor?.getValue() ?? '')
}

function formatSelection(): boolean {
  if (!editor || props.readonly) return false
  const selection = editor.getSelection()
  const model = editor.getModel()
  if (!selection || !model || selection.isEmpty()) return false
  const selected = model.getValueInRange(selection)
  if (!selected.trim()) return false
  const formatted = formatSql(selected)
  editor.executeEdits('sql-editor-format-selection', [
    {range: selection, text: formatted, forceMoveMarkers: true},
  ])
  emit('update:modelValue', editor.getValue())
  return true
}

/** 有选区只格式化选区；无选区才格式化全文（兼容非 SQL 控制台场景） */
function formatDocument(): boolean {
  if (!editor || props.readonly) return false
  if (formatSelection()) return true
  const formatted = formatSql(editor.getValue())
  editor.setValue(formatted)
  emit('update:modelValue', formatted)
  return Boolean(formatted)
}

function layout() {
  editor?.layout()
}

function applySettings() {
  if (!editor) return
  const options = toMonacoAppearanceOptions(editorSettings.settings)
  editor.updateOptions({
    fontFamily: options.fontFamily,
    fontSize: options.fontSize,
    lineHeight: options.lineHeight,
    lineNumbers: options.lineNumbers,
    minimap: buildMinimapOptions(editorSettings.settings.minimap),
    wordWrap: options.wordWrap,
    folding: options.folding,
    foldingHighlight: options.foldingHighlight,
    showFoldingControls: options.showFoldingControls,
    readOnly: props.readonly ?? false,
  })
  ensureMonacoThemes()
  monaco.editor.setTheme(editorSettings.settings.theme)
}

function emitCursorChange() {
  if (!editor) return
  const position = editor.getPosition()
  const model = editor.getModel()
  if (!position || !model) return
  emit('cursor-change', {
    lineNumber: position.lineNumber,
    column: position.column,
    offset: model.getOffsetAt(position),
  })
}

onMounted(() => {
  if (!containerRef.value) return
  ensureMonacoThemes()
  const settingsOptions = toMonacoAppearanceOptions(editorSettings.settings)
  editor = monaco.editor.create(containerRef.value, {
    value: props.modelValue,
    language: props.language ?? 'sql',
    automaticLayout: true,
    scrollBeyondLastLine: false,
    padding: {top: 8, bottom: 8},
    contextmenu: false,
    readOnly: props.readonly ?? false,
    ...settingsOptions,
    ...props.extraOptions,
  })
  if (!props.preview) {
    editor.onDidChangeModelContent(() => emit('update:modelValue', editor?.getValue() ?? ''))
    editor.onDidChangeCursorPosition(() => emitCursorChange())
    editor.onContextMenu((event) => {
      event.event.preventDefault()
      const mouseEvent = event.event.browserEvent as MouseEvent
      emit('contextmenu', {
        x: mouseEvent.clientX,
        y: mouseEvent.clientY,
        selectedText: getSelectedText(),
      })
    })
  }
  emitCursorChange()
})

watch(
    () => props.modelValue,
    (value) => {
      if (editor && editor.getValue() !== value) editor.setValue(value)
    },
)

watch(
    () => editorSettings.settings,
    () => applySettings(),
    {deep: true},
)

watch(
    () => props.readonly,
    (value) => editor?.updateOptions({readOnly: value ?? false}),
)

onBeforeUnmount(() => editor?.dispose())

defineExpose({
  getSelectedText,
  getExecutableSql,
  formatDocument,
  formatSelection,
  layout,
})
</script>

<template>
  <div ref="containerRef" class="monaco-host" :data-minimap-tone="minimapTone"/>
</template>

<style scoped>
.monaco-host {
  width: 100%;
  height: 100%;
  min-height: 120px;
}
</style>
