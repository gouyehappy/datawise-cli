<script setup lang="ts">
import {inject, computed, onBeforeUnmount, onMounted, ref, unref, watch} from 'vue'
import * as monaco from 'monaco-editor'
import {SQL_EDITOR_CONFIG_KEY} from '@sql-editor/config/injection'
import {DEFAULT_SQL_EDITOR_THEME} from '@sql-editor/config/defaults'
import {SQL_EDITOR_MONACO_OPTIONS, resolveSqlEditorMonacoOptions} from '@sql-editor/constants/editor-options'
import {formatSql} from '@sql-editor/utils/format'
import {isCursorInStringOrCommentCached} from '@sql-editor/completion/incremental-scan'
import {registerSqlEditorLineShortcuts} from '@sql-editor/editor/line-shortcuts'
import {bindSuggestAcceptSuppress} from '@sql-editor/completion/monaco/suggest-accept'
import {
  bindSqlSuggestDetailsAutoShow,
  applySqlSuggestDetailsSetting,
} from '@sql-editor/completion/monaco/suggest-details'
import {extractExecutableLineSql} from '@sql-editor/utils/current-line-sql'
import {resolveStatementAtCursor} from '@sql-editor/utils/statement-at-cursor'
import {bindSqlRunGutter} from '@sql-editor/editor/run-gutter'
import {isSqlRunGutterEnabled} from '@sql-editor/editor/run-gutter-enabled'
import {
  getSqlEditorShowSuggestDetails,
  getSqlEditorFolding,
  getSqlEditorFontSize,
  getSqlEditorTheme,
  sqlEditorSettingsVersion,
} from '@sql-editor/config/snippets/cache'
import {applySqlEditorMonacoTheme, ensureSqlEditorMonacoThemes} from '@sql-editor/monaco/themes'
import {
  planAiBlockInsert,
  planAiSqlInsert,
  buildAiExplanationBlock,
  buildAiSqlBlock
} from '@sql-editor/ai/format-ai-insert'
import type {SqlEditorAiAction, SqlGutterStatementPayload, SqlKeybindingConfig} from '@sql-editor/types'
import {getActiveSqlEditorRuntime} from '@sql-editor/runtime/sql-editor-runtime'
import {suppressAutocomplete, isAutocompleteSuppressed} from '@sql-editor/completion/suppress-autocomplete'
import {
  bypassesAutocompleteSuppress,
  lineBeforeIsColumnRef,
  shouldScheduleEditorAutoSuggest,
} from '@sql-editor/completion/trigger-policy'
import {resolveEditorUiTone} from '@sql-editor/utils/editor-ui-tone'
import {
    isSqlEditorThemeHostManaged,
    resolveSqlEditorTheme,
} from '@sql-editor/utils/resolve-editor-theme'

const props = withDefaults(
    defineProps<{
      modelValue: string
      readonly?: boolean
      preview?: boolean
      theme?: string
      monacoOptions?: monaco.editor.IStandaloneEditorConstructionOptions
      keybindings?: SqlKeybindingConfig[]
      customHandlers?: Record<string, () => boolean | void>
      runGutterHint?: string
    }>(),
    {
      theme: DEFAULT_SQL_EDITOR_THEME,
    },
)

const emit = defineEmits<{
  'update:modelValue': [value: string]
  contextmenu: [payload: { x: number; y: number; selectedText: string }]
  'cursor-change': [payload: { lineNumber: number; column: number; offset: number }]
  focus: []
  'run-statement': [payload: SqlGutterStatementPayload]
}>()

const globalConfig = inject(SQL_EDITOR_CONFIG_KEY, null)
const containerRef = ref<HTMLElement>()
const uiTone = computed(() => resolveEditorUiTone(resolveTheme()))
let editor: monaco.editor.IStandaloneCodeEditor | null = null
let errorDecorations: string[] = []
let lineShortcutDisposable: monaco.IDisposable | null = null
let suggestDetailsDisposable: monaco.IDisposable | null = null
let suggestAcceptDisposable: monaco.IDisposable | null = null
let selectionSyncDisposable: monaco.IDisposable | null = null
let runGutterDisposable: monaco.IDisposable | null = null

function resolveTheme(): string {
  void sqlEditorSettingsVersion.value
  return resolveSqlEditorTheme({
    personalTheme: getSqlEditorTheme(),
    hostTheme: globalConfig?.theme !== undefined ? unref(globalConfig.theme) : undefined,
    propTheme: props.theme,
    hostManaged: isSqlEditorThemeHostManaged(globalConfig),
  })
}

function resolveMonacoOptions(): monaco.editor.IStandaloneEditorConstructionOptions {
  const fromInject = globalConfig?.monacoOptions?.() ?? SQL_EDITOR_MONACO_OPTIONS
  const fromProps = props.monacoOptions ?? {}
  const merged = resolveSqlEditorMonacoOptions({...fromInject, ...fromProps})
  const personalFontSize = getSqlEditorFontSize()
  if (personalFontSize !== undefined) {
    merged.fontSize = personalFontSize
  }
  void sqlEditorSettingsVersion.value
  const folding = getSqlEditorFolding()
  merged.folding = folding
  merged.foldingHighlight = folding
  merged.showFoldingControls = folding ? 'mouseover' : 'never'
  merged.glyphMargin = true
  return merged
}

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

function formatDocument() {
  if (!editor || props.readonly) return
  const formatted = formatSql(editor.getValue())
  editor.setValue(formatted)
  emit('update:modelValue', formatted)
}

function formatSelection(): boolean {
  if (!editor || props.readonly) return false
  const selection = editor.getSelection()
  const model = editor.getModel()
  if (!selection || !model || selection.isEmpty()) return false
  const selected = model.getValueInRange(selection)
  const formatted = formatSql(selected)
  editor.executeEdits('sql-editor-format-selection', [
    {range: selection, text: formatted, forceMoveMarkers: true},
  ])
  emit('update:modelValue', editor.getValue())
  return true
}

function getCursorLineNumber(): number | null {
  if (!editor) return null
  return editor.getPosition()?.lineNumber ?? null
}

function resolveStatementAtEditorCursor() {
  if (!editor) return null
  const model = editor.getModel()
  const position = editor.getPosition()
  if (!model || !position) return null
  return resolveStatementAtCursor(model.getValue(), model.getOffsetAt(position))
}

function getCurrentLineSql(): string {
  if (!editor) return ''
  const statement = resolveStatementAtEditorCursor()
  if (statement?.sql.trim()) return statement.sql
  const model = editor.getModel()
  const lineNumber = getCursorLineNumber()
  if (!model || !lineNumber) return ''
  return extractExecutableLineSql(model.getLineContent(lineNumber))
}

function getCurrentLineNumber(): number | null {
  const statement = resolveStatementAtEditorCursor()
  if (statement?.sql.trim()) return statement.anchorLine
  const sql = getCurrentLineSql()
  if (!sql) return null
  return getCursorLineNumber()
}

function getSelectionStartLine(): number | null {
  if (!editor) return null
  const selection = editor.getSelection()
  const selected = getSelectedText().trim()
  if (!selected || !selection) return null
  return selection.startLineNumber
}

function clearErrorLine() {
  if (!editor) return
  errorDecorations = editor.deltaDecorations(errorDecorations, [])
}

function setErrorLine(lineNumber: number | null) {
  if (!editor) return
  const model = editor.getModel()
  if (!model) return
  if (lineNumber === null || lineNumber < 1 || lineNumber > model.getLineCount()) {
    clearErrorLine()
    return
  }
  errorDecorations = editor.deltaDecorations(errorDecorations, [
    {
      range: new monaco.Range(lineNumber, 1, lineNumber, model.getLineMaxColumn(lineNumber)),
      options: {
        isWholeLine: true,
        className: 'sql-editor-error-line',
        glyphMarginClassName: 'sql-editor-error-glyph',
      },
    },
  ])
}

function goToLine(lineNumber: number, highlight = true) {
  if (!editor) return
  const model = editor.getModel()
  if (!model) return
  const line = Math.min(Math.max(1, lineNumber), model.getLineCount())
  editor.setSelection(new monaco.Selection(line, 1, line, 1))
  editor.revealLineInCenter(line)
  editor.focus()
  if (highlight) setErrorLine(line)
}

function layout() {
  editor?.layout()
}

function insertTextAtCursor(text: string) {
  if (!editor || props.readonly) return
  const selection = editor.getSelection()
  if (!selection) return
  editor.executeEdits('sql-editor', [{range: selection, text, forceMoveMarkers: true}])
  editor.focus()
  emit('update:modelValue', editor.getValue())
  if (text.endsWith('.')) {
    editor.trigger('sql-editor', 'editor.action.triggerSuggest', {auto: true})
  }
}

function insertSnippetAtCursor(snippet: string) {
  if (!editor || props.readonly) return
  type SnippetCtrl = { insert: (template: string) => void }
  const ctrl = editor.getContribution('snippetController2') as SnippetCtrl | null
  if (ctrl?.insert) {
    ctrl.insert(snippet)
    emit('update:modelValue', editor.getValue())
    editor.focus()
    return
  }
  insertTextAtCursor(snippet)
}

function triggerSuggest() {
  if (!editor || props.readonly) return
  editor.trigger('sql-editor', 'editor.action.triggerSuggest', {})
  editor.focus()
}

function dismissSuggestWidget() {
  if (!editor) return
  const controller = editor.getContribution('editor.contrib.suggestController') as {
    cancelSuggestWidget?: () => void
  } | null
  controller?.cancelSuggestWidget?.()
}

let suggestRaf = 0
let suggestTimer: ReturnType<typeof setTimeout> | null = null

function cancelScheduledAutoSuggest() {
  if (suggestRaf) cancelAnimationFrame(suggestRaf)
  suggestRaf = 0
  if (suggestTimer) clearTimeout(suggestTimer)
  suggestTimer = null
}

function insertAiGeneratedSql(prompt: string, generatedSql: string) {
  applyAiActionResult('generate', prompt, generatedSql)
}

function applyAiInsertPlan(plan: ReturnType<typeof planAiSqlInsert>) {
  if (!editor) return
  const model = editor.getModel()
  if (!model) return

  if (plan.append) {
    const lastLine = model.getLineCount()
    const lastCol = model.getLineMaxColumn(lastLine)
    const gap = plan.appendGapLines > 0 ? '\n'.repeat(plan.appendGapLines) : ''
    editor.executeEdits('sql-editor-ai', [{
      range: new monaco.Range(lastLine, lastCol, lastLine, lastCol),
      text: `${gap}${plan.insertLines.join('\n')}`,
      forceMoveMarkers: true,
    }])
  } else {
    const line = plan.startLine + 1
    editor.executeEdits('sql-editor-ai', [{
      range: new monaco.Range(line, 1, line, model.getLineMaxColumn(line)),
      text: plan.insertLines.join('\n'),
      forceMoveMarkers: true,
    }])
  }
}

function finishAiEdit(focusLine: number) {
  if (!editor) return
  dismissSuggestWidget()
  goToLine(focusLine, false)
  editor.focus()
  emit('update:modelValue', editor.getValue())
  requestAnimationFrame(() => dismissSuggestWidget())
  window.setTimeout(() => dismissSuggestWidget(), 120)
}

function applyAiActionResult(action: SqlEditorAiAction, prompt: string, content: string) {
  if (!editor || props.readonly) return
  const model = editor.getModel()
  const position = editor.getPosition()
  if (!model || !position) return

  suppressAutocomplete(400)
  cancelScheduledAutoSuggest()
  dismissSuggestWidget()

  const selection = editor.getSelection()
  const hasSelection = Boolean(selection && !selection.isEmpty())

  if (action === 'explain') {
    const block = buildAiExplanationBlock(prompt, content)
    if (hasSelection && selection) {
      const endLine = selection.endLineNumber
      const endCol = model.getLineMaxColumn(endLine)
      editor.executeEdits('sql-editor-ai', [{
        range: new monaco.Range(endLine, endCol, endLine, endCol),
        text: `\n${block}`,
        forceMoveMarkers: true,
      }])
      finishAiEdit(endLine + 1)
      return
    }
    const plan = planAiBlockInsert(model.getValue(), position.lineNumber, block)
    applyAiInsertPlan(plan)
    finishAiEdit(plan.focusLine)
    return
  }

  const sqlBlock = buildAiSqlBlock(prompt, content)

  if ((action === 'optimize' || action === 'fix') && hasSelection && selection) {
    editor.executeEdits('sql-editor-ai', [{
      range: selection,
      text: sqlBlock,
      forceMoveMarkers: true,
    }])
    finishAiEdit(selection.startLineNumber)
    return
  }

  const plan = planAiSqlInsert(model.getValue(), position.lineNumber, prompt, content)
  applyAiInsertPlan(plan)
  finishAiEdit(plan.focusLine)
}

function applyEditorOptions() {
  if (!editor) return
  const options = resolveMonacoOptions()
  editor.updateOptions({
    ...options,
    readOnly: props.readonly ?? false,
  })
  applyTheme()
}

function applyTheme() {
  ensureSqlEditorMonacoThemes()
  applySqlEditorMonacoTheme(resolveTheme())
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

function syncSelectionToRuntime() {
  if (!editor || props.preview) return
  const selection = editor.getSelection()
  const model = editor.getModel()
  if (!selection || !model || selection.isEmpty()) {
    getActiveSqlEditorRuntime().setSelectedText('')
    return
  }
  getActiveSqlEditorRuntime().setSelectedText(model.getValueInRange(selection))
}

function bindSelectionSync() {
  selectionSyncDisposable?.dispose()
  if (!editor || props.preview) return
  selectionSyncDisposable = editor.onDidChangeCursorSelection(() => syncSelectionToRuntime())
  syncSelectionToRuntime()
}

function bindLineShortcuts() {
  lineShortcutDisposable?.dispose()
  if (!editor || props.preview) return
  lineShortcutDisposable = registerSqlEditorLineShortcuts(editor, {
    readonly: props.readonly,
    keybindings: props.keybindings,
    customHandlers: {
      'sqlEditor.formatSelection': formatSelection,
      ...props.customHandlers,
    },
    onEdit: () => emit('update:modelValue', editor?.getValue() ?? ''),
  })
}

function syncSuggestDetailsHostAttr() {
  if (!containerRef.value) return
  containerRef.value.dataset.suggestDetails = getSqlEditorShowSuggestDetails() ? 'on' : 'off'
}

function bindRunGutter() {
  runGutterDisposable?.dispose()
  if (!editor || props.preview || !containerRef.value) return
  runGutterDisposable = bindSqlRunGutter(editor, containerRef.value, {
    isEnabled: () => isSqlRunGutterEnabled(),
    isReadonly: () => props.readonly === true,
    hoverMessage: () => props.runGutterHint?.trim() || 'Run this statement',
    onRun: (payload) => emit('run-statement', payload),
  })
}

function bindSuggestDetails() {
  if (!editor || props.preview) return
  suggestDetailsDisposable?.dispose()
  syncSuggestDetailsHostAttr()
  suggestDetailsDisposable = bindSqlSuggestDetailsAutoShow(editor, {
    isEnabled: getSqlEditorShowSuggestDetails,
  })
}

onMounted(() => {
  if (!containerRef.value) return
  const options = resolveMonacoOptions()
  editor = monaco.editor.create(containerRef.value, {
    value: props.modelValue,
    language: 'sql',
    automaticLayout: true,
    scrollBeyondLastLine: false,
    padding: {top: 8, bottom: 8},
    contextmenu: false,
    readOnly: props.readonly ?? false,
    theme: resolveTheme(),
    ...options,
  })
  if (!props.preview) {
    bindSuggestDetails()
    bindRunGutter()
    bindSelectionSync()
    suggestAcceptDisposable = bindSuggestAcceptSuppress(editor, () => {
      suppressAutocomplete(480)
      cancelScheduledAutoSuggest()
      dismissSuggestWidget()
    })

    const scheduleAutoSuggest = (force = false) => {
      if (!force && isAutocompleteSuppressed()) return
      if (suggestRaf) cancelAnimationFrame(suggestRaf)
      suggestRaf = requestAnimationFrame(() => {
        suggestRaf = 0
        if (suggestTimer) clearTimeout(suggestTimer)
        suggestTimer = setTimeout(() => {
          if (!editor || props.readonly) return
          if (!force && isAutocompleteSuppressed()) return
          const model = editor.getModel()
          const position = editor.getPosition()
          if (!model || !position) return
          const prefix = model.getValueInRange(
              new monaco.Range(1, 1, position.lineNumber, position.column),
          )
          if (isCursorInStringOrCommentCached(prefix, prefix.length)) return
          editor.trigger('sql-editor', 'editor.action.triggerSuggest', {auto: true})
        }, 80)
      })
    }

    editor.onDidChangeModelContent((event) => {
      emit('update:modelValue', editor?.getValue() ?? '')
      const forceColumnRef = event.changes.some((change) => {
        if (!bypassesAutocompleteSuppress(change.text)) return false
        const model = editor?.getModel()
        const position = editor?.getPosition()
        if (!model || !position) return false
        const lineBefore = model.getLineContent(position.lineNumber).slice(0, position.column - 1)
        return lineBeforeIsColumnRef(lineBefore)
      })
      if (event.isFlush || (isAutocompleteSuppressed() && !forceColumnRef)) {
        cancelScheduledAutoSuggest()
        if (isAutocompleteSuppressed() && !forceColumnRef) dismissSuggestWidget()
        return
      }
      const shouldSchedule = event.changes.some((change) => shouldScheduleEditorAutoSuggest(change.text))
      if (!shouldSchedule) return
      scheduleAutoSuggest(forceColumnRef)
    })
    editor.onDidChangeCursorPosition(() => emitCursorChange())
    editor.onDidFocusEditorText(() => emit('focus'))
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
  bindLineShortcuts()
  emitCursorChange()
})

watch(
    () => props.modelValue,
    (value) => {
      if (editor && editor.getValue() !== value) {
        suppressAutocomplete(200)
        cancelScheduledAutoSuggest()
        editor.setValue(value)
        dismissSuggestWidget()
      }
    },
)

watch(
    () => sqlEditorSettingsVersion.value,
    () => {
      syncSuggestDetailsHostAttr()
      applyEditorOptions()
      bindRunGutter()
      if (editor && !props.preview && !getSqlEditorShowSuggestDetails()) {
        applySqlSuggestDetailsSetting(editor, false)
      }
    },
)

watch(
    () => [
      resolveTheme(),
      props.monacoOptions,
      globalConfig?.monacoOptions?.(),
      sqlEditorSettingsVersion.value,
      globalConfig?.theme !== undefined ? unref(globalConfig.theme) : undefined,
    ],
    () => applyEditorOptions(),
    {deep: true},
)

watch(
    () => [props.readonly, props.keybindings, props.customHandlers, sqlEditorSettingsVersion.value] as const,
    () => {
      editor?.updateOptions({readOnly: props.readonly ?? false})
      bindLineShortcuts()
      bindRunGutter()
    },
    {deep: true},
)

onBeforeUnmount(() => {
  suggestDetailsDisposable?.dispose()
  suggestAcceptDisposable?.dispose()
  lineShortcutDisposable?.dispose()
  selectionSyncDisposable?.dispose()
  runGutterDisposable?.dispose()
  editor?.dispose()
})

defineExpose({
  getSelectedText,
  getExecutableSql,
  getCurrentLineSql,
  getCurrentLineNumber,
  getSelectionStartLine,
  formatDocument,
  formatSelection,
  layout,
  insertTextAtCursor,
  insertSnippetAtCursor,
  insertAiGeneratedSql,
  applyAiActionResult,
  triggerSuggest,
  goToLine,
  clearErrorLine,
  setErrorLine,
})
</script>

<template>
  <div ref="containerRef" class="sql-monaco-host" :data-tone="uiTone"/>
</template>

<style scoped>
.sql-monaco-host {
  position: relative;
  width: 100%;
  height: 100%;
  min-height: 120px;
  --sql-scrollbar-thumb: var(--dw-scrollbar-thumb, color-mix(in srgb, #64748b 38%, transparent));
  --sql-scrollbar-thumb-hover: var(--dw-scrollbar-thumb-hover, color-mix(in srgb, #475569 58%, transparent));
  --sql-scrollbar-track: var(--dw-scrollbar-track, transparent);
}

.sql-monaco-host[data-tone='dark'] {
  --sql-scrollbar-thumb: var(--dw-scrollbar-thumb, color-mix(in srgb, #868a91 72%, #000));
  --sql-scrollbar-thumb-hover: var(--dw-scrollbar-thumb-hover, color-mix(in srgb, #a0a3a8 88%, #000));
}

.sql-monaco-host[data-tone='light'] {
  --sql-scrollbar-thumb: var(--dw-scrollbar-thumb, color-mix(in srgb, #9ca3af 36%, transparent));
  --sql-scrollbar-thumb-hover: var(--dw-scrollbar-thumb-hover, color-mix(in srgb, #6b7280 52%, transparent));
}
</style>

<style>
.monaco-editor .sql-editor-error-line {
  background: color-mix(in srgb, #ef4444 12%, transparent);
}

.monaco-editor .sql-editor-error-glyph {
  background: #ef4444;
  border-radius: 50%;
  margin-left: 4px;
  width: 8px !important;
  height: 8px !important;
}

.monaco-editor .sql-editor-run-gutter-btn,
.sql-monaco-host--run-gutter .sql-editor-run-gutter-btn {
  box-sizing: border-box;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 100%;
  height: 100%;
  margin: 0;
  padding: 0;
  border: none;
  border-radius: 4px;
  background: transparent;
  color: #22c55e;
  cursor: pointer;
  opacity: 0.95;
  line-height: 0;
  pointer-events: auto;
  -webkit-app-region: no-drag;
  filter: drop-shadow(0 0 0.5px rgba(34, 197, 94, 0.35));
}

.monaco-editor .sql-editor-run-gutter-btn:hover,
.sql-monaco-host--run-gutter .sql-editor-run-gutter-btn:hover {
  opacity: 1;
  color: #16a34a;
  background: color-mix(in srgb, #22c55e 14%, transparent);
}

/* 补全二级预览面板：隐藏关闭钮、与一级列表留缝、归属箭头 */
.sql-monaco-host[data-suggest-details='on'] .monaco-editor .suggest-details > .monaco-scrollable-element > .body > .header > .codicon-close {
  display: none !important;
}

.sql-monaco-host[data-suggest-details='on'] .monaco-editor .suggest-details-container {
  --dw-suggest-details-gap: 12px;
  margin-left: var(--dw-suggest-details-gap);
  position: relative;
}

/* 箭头底边与二级框左边框对齐，外圈描边 + 内芯填色 */
.sql-monaco-host[data-suggest-details='on'] .monaco-editor .suggest-details-container::before {
  content: '';
  position: absolute;
  left: 0;
  top: var(--dw-suggest-arrow-top, 24px);
  transform: translate(calc(-100% - 1px), -50%);
  border-style: solid;
  border-width: 7px 8px 7px 0;
  border-color: transparent;
  border-right-color: color-mix(in srgb, var(--vscode-editorSuggestWidget-border, #454545) 72%, transparent);
  pointer-events: none;
  z-index: 1;
}

.sql-monaco-host[data-suggest-details='on'] .monaco-editor .suggest-details-container::after {
  content: '';
  position: absolute;
  left: 0;
  top: var(--dw-suggest-arrow-top, 24px);
  transform: translate(-100%, -50%);
  border-style: solid;
  border-width: 6px 7px 6px 0;
  border-color: transparent;
  border-right-color: var(--vscode-editorSuggestWidget-background, #252526);
  pointer-events: none;
  z-index: 2;
}

/* 二级面板：说明标题（简洁单行） */
.sql-monaco-host[data-suggest-details='on'] .monaco-editor .suggest-details > .monaco-scrollable-element > .body > .header > .type {
  opacity: 0.62;
  margin: 0 !important;
  padding: 6px 10px 4px !important;
  font-size: 10px;
  font-weight: normal;
  line-height: 1.35;
  white-space: normal;
  word-break: break-word;
  color: var(--vscode-editorSuggestWidget-foreground, #cccccc);
  border-bottom: 1px solid color-mix(in srgb, var(--vscode-editorSuggestWidget-border, #454545) 38%, transparent);
}

.sql-monaco-host[data-suggest-details='on'] .monaco-editor .suggest-details.detail-and-doc > .monaco-scrollable-element > .body > .header > .type {
  padding-bottom: 4px !important;
}

/* 二级面板：SQL 预览（单色等宽，无语法高亮） */
.sql-monaco-host[data-suggest-details='on'] .monaco-editor .suggest-details > .monaco-scrollable-element > .body > .docs {
  margin: 0 !important;
  padding: 6px 10px 8px !important;
  font-family: var(--monaco-monospace-font, ui-monospace, monospace);
  font-size: 11px;
  line-height: 1.45;
  opacity: 0.68;
  color: var(--vscode-editorSuggestWidget-foreground, #cccccc);
  white-space: pre-wrap;
}

.sql-monaco-host[data-suggest-details='on'] .monaco-editor .suggest-details > .monaco-scrollable-element > .body > .docs.markdown-docs {
  padding: 6px 10px 8px !important;
  white-space: pre-wrap;
}

.sql-monaco-host[data-suggest-details='on'] .monaco-editor .suggest-details > .monaco-scrollable-element > .body > .docs.markdown-docs > div,
.sql-monaco-host[data-suggest-details='on'] .monaco-editor .suggest-details > .monaco-scrollable-element > .body > .docs.markdown-docs > span:not(:empty) {
  padding: 0 !important;
  font-family: inherit;
  font-size: inherit;
  line-height: inherit;
  color: inherit;
}

.sql-monaco-host[data-suggest-details='on'] .monaco-editor .suggest-details .monaco-tokenized-source,
.sql-monaco-host[data-suggest-details='on'] .monaco-editor .suggest-details .monaco-tokenized-source span {
  color: inherit !important;
  font-family: inherit !important;
  font-size: inherit !important;
  background: transparent !important;
}

/* 编辑器主滚动条：细圆角、悬停渐显（不影响补全面板等其它 scrollable） */
.sql-monaco-host .monaco-editor .editor-scrollable > .scrollbar {
  background: var(--sql-scrollbar-track) !important;
}

.sql-monaco-host .monaco-editor .editor-scrollable > .scrollbar.vertical {
  width: 8px !important;
}

.sql-monaco-host .monaco-editor .editor-scrollable > .scrollbar.horizontal {
  height: 8px !important;
}

.sql-monaco-host .monaco-editor .editor-scrollable > .scrollbar > .slider {
  border-radius: 999px;
  background: var(--sql-scrollbar-thumb) !important;
  transition: background 0.18s ease;
}

.sql-monaco-host .monaco-editor .editor-scrollable > .scrollbar:hover > .slider,
.sql-monaco-host .monaco-editor .editor-scrollable > .scrollbar.active > .slider {
  background: var(--sql-scrollbar-thumb-hover) !important;
}

.sql-monaco-host .monaco-editor .editor-scrollable > .scrollbar.vertical > .slider {
  margin: 2px 1px;
  width: auto !important;
  left: 1px !important;
  right: 1px !important;
}

.sql-monaco-host .monaco-editor .editor-scrollable > .scrollbar.horizontal > .slider {
  margin: 1px 2px;
  height: auto !important;
  top: 1px !important;
  bottom: 1px !important;
}

/* 建议框：更接近 Chat2DB 的两栏信息布局 */
.sql-monaco-host .monaco-editor .suggest-widget {
  border-radius: 6px;
  overflow: hidden;
  font-size: 12px;
}

.sql-monaco-host .monaco-editor .suggest-widget .monaco-list-row {
  border-radius: 0;
  height: 26px !important;
}

.sql-monaco-host .monaco-editor .suggest-widget .monaco-list-row > .contents {
  display: flex;
  align-items: center;
  gap: 10px;
  padding-right: 8px;
}

.sql-monaco-host .monaco-editor .suggest-widget .monaco-list-row > .contents > .icon {
  margin-left: 6px;
}

.sql-monaco-host .monaco-editor .suggest-widget .monaco-list-row .main {
  min-width: 0;
  flex: 1 1 auto;
}

.sql-monaco-host .monaco-editor .suggest-widget .monaco-list-row .monaco-icon-label {
  width: 100%;
}

.sql-monaco-host .monaco-editor .suggest-widget .monaco-list-row .monaco-icon-label .label-name {
  font-weight: 500;
  letter-spacing: 0;
}

.sql-monaco-host .monaco-editor .suggest-widget .monaco-list-row .monaco-icon-label .label-name .label-detail {
  margin-left: 6px;
  opacity: 0.72;
  font-weight: 400;
}

.sql-monaco-host .monaco-editor .suggest-widget .monaco-list-row .monaco-icon-label .label-description {
  margin-left: 8px;
  opacity: 0.58;
  font-size: 11px;
}

.sql-monaco-host .monaco-editor .suggest-widget .monaco-list-row .details-label {
  flex: 0 0 108px;
  width: 108px;
  text-align: right;
  justify-content: flex-end;
  opacity: 0.72;
  font-size: 11px;
  white-space: nowrap;
}

.sql-monaco-host .monaco-editor .suggest-widget .monaco-list-row .details-label:empty {
  display: none;
}

.sql-monaco-host .monaco-editor .suggest-widget .monaco-list-row.focused .details-label,
.sql-monaco-host .monaco-editor .suggest-widget .monaco-list-row.focused .monaco-icon-label .label-description,
.sql-monaco-host .monaco-editor .suggest-widget .monaco-list-row.focused .monaco-icon-label .label-name .label-detail {
  opacity: 0.92;
}

/* 语义图标色：更快区分类型（尽量走 VSCode 主题变量，缺失则回退固定色） */
.sql-monaco-host .monaco-editor .suggest-widget .codicon {
  color: var(--vscode-symbolIcon-textForeground, var(--vscode-editorSuggestWidget-foreground, #cccccc));
}

.sql-monaco-host .monaco-editor .suggest-widget .codicon-symbol-function,
.sql-monaco-host .monaco-editor .suggest-widget .codicon-symbol-method {
  color: var(--vscode-symbolIcon-functionForeground, #a78bfa);
}

.sql-monaco-host .monaco-editor .suggest-widget .codicon-symbol-field {
  color: var(--vscode-symbolIcon-fieldForeground, #60a5fa);
}

.sql-monaco-host .monaco-editor .suggest-widget .codicon-symbol-class {
  color: var(--vscode-symbolIcon-classForeground, #34d399);
}

.sql-monaco-host .monaco-editor .suggest-widget .codicon-symbol-keyword {
  color: var(--vscode-symbolIcon-keywordForeground, #fbbf24);
}

.sql-monaco-host .monaco-editor .suggest-widget .codicon-symbol-snippet {
  color: var(--vscode-symbolIcon-snippetForeground, #fb7185);
}

.sql-monaco-host .monaco-editor .suggest-widget .codicon-symbol-variable {
  color: var(--vscode-symbolIcon-variableForeground, #93c5fd);
}

.sql-monaco-host .monaco-editor .suggest-widget .codicon-symbol-reference {
  color: var(--vscode-symbolIcon-referenceForeground, #f472b6);
}
</style>
