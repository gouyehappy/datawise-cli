import * as monaco from 'monaco-editor'

const SUGGEST_CONTROLLER_ID = 'editor.contrib.suggestController'

interface SuggestWidgetLike {
    onDidShow: monaco.IEvent<unknown>
    onDidFocus: monaco.IEvent<unknown>
}

interface SuggestControllerLike {
    widget: { value: SuggestWidgetLike | undefined }
    toggleSuggestionDetails: () => void
}

export interface SqlSuggestDetailsBindOptions {
    isEnabled: () => boolean
}

function getSuggestController(editor: monaco.editor.IStandaloneCodeEditor): SuggestControllerLike | null {
    return editor.getContribution(SUGGEST_CONTROLLER_ID) as SuggestControllerLike | null
}

function isSuggestDetailsVisible(doc: Document): boolean {
    return Boolean(doc.querySelector('.monaco-editor .suggest-widget.shows-details'))
}

function setSuggestDetailsVisible(editor: monaco.editor.IStandaloneCodeEditor, visible: boolean) {
    const doc = editor.getDomNode()?.ownerDocument
    if (!doc) return
    const currentlyVisible = isSuggestDetailsVisible(doc)
    if (currentlyVisible === visible) return
    getSuggestController(editor)?.toggleSuggestionDetails()
}

function querySuggestDetailsArrowNodes(editor: monaco.editor.IStandaloneCodeEditor) {
    const root = editor.getDomNode()
    if (!root) return null
    const details = root.querySelector('.suggest-details-container') as HTMLElement | null
    const focusedRow = root.querySelector(
        '.suggest-widget .monaco-list-row.focused',
    ) as HTMLElement | null
    if (!details || !focusedRow) return null
    return {details, focusedRow}
}

/** 将二级面板归属箭头对齐到当前选中补全项 */
export function alignSuggestDetailsArrow(editor: monaco.editor.IStandaloneCodeEditor) {
    const nodes = querySuggestDetailsArrowNodes(editor)
    if (!nodes) return

    const {details, focusedRow} = nodes
    const detailsRect = details.getBoundingClientRect()
    const rowRect = focusedRow.getBoundingClientRect()
    const centerY = rowRect.top + rowRect.height / 2 - detailsRect.top
    const arrowHalf = 9
    const clamped = Math.max(arrowHalf + 4, Math.min(centerY, detailsRect.height - arrowHalf - 4))
    details.style.setProperty('--dw-suggest-arrow-top', `${clamped}px`)
}

/** 详情面板布局/异步 markdown 渲染后再对齐箭头 */
export function scheduleAlignSuggestDetailsArrow(editor: monaco.editor.IStandaloneCodeEditor) {
    const run = () => alignSuggestDetailsArrow(editor)
    requestAnimationFrame(() => requestAnimationFrame(run))
    window.setTimeout(run, 48)
    window.setTimeout(run, 160)
}

function syncSuggestDetailsPanel(
    editor: monaco.editor.IStandaloneCodeEditor,
    isEnabled: () => boolean,
) {
    if (!isEnabled()) {
        setSuggestDetailsVisible(editor, false)
        return
    }
    const row = editor.getDomNode()?.querySelector('.suggest-widget .monaco-list-row.focused')
    const isSnippet = Boolean(row?.querySelector('.codicon-symbol-snippet'))
    if (!isSnippet) {
        setSuggestDetailsVisible(editor, false)
        return
    }
    setSuggestDetailsVisible(editor, true)
    scheduleAlignSuggestDetailsArrow(editor)
}

export function applySqlSuggestDetailsSetting(
    editor: monaco.editor.IStandaloneCodeEditor,
    enabled: boolean,
) {
    setSuggestDetailsVisible(editor, enabled)
}

/**
 * Monaco 补全详情面板默认折叠（expandSuggestionDocs=false）。
 * 绑定后：在配置开启时，补全列表打开或切换选中项时自动展开右侧二级面板。
 */
export function bindSqlSuggestDetailsAutoShow(
    editor: monaco.editor.IStandaloneCodeEditor,
    options: SqlSuggestDetailsBindOptions,
): monaco.IDisposable {
    const disposables: monaco.IDisposable[] = []
    let widgetBound = false

    let syncTimer: ReturnType<typeof setTimeout> | null = null
    const scheduleSync = () => {
        if (syncTimer) clearTimeout(syncTimer)
        syncTimer = setTimeout(() => {
            syncTimer = null
            syncSuggestDetailsPanel(editor, options.isEnabled)
        }, 0)
    }

    const bindWidget = (): boolean => {
        if (widgetBound) return true
        const widget = getSuggestController(editor)?.widget?.value
        if (!widget) return false
        widgetBound = true
        disposables.push(widget.onDidShow(scheduleSync))
        disposables.push(widget.onDidFocus(scheduleSync))
        return true
    }

    disposables.push(
        editor.onDidFocusEditorText(() => {
            bindWidget()
        }),
    )

    if (!bindWidget()) {
        const retryId = window.setInterval(() => {
            if (bindWidget()) window.clearInterval(retryId)
        }, 100)
        disposables.push({dispose: () => window.clearInterval(retryId)})
    }

    return {
        dispose: () => {
            if (syncTimer) clearTimeout(syncTimer)
            for (const d of disposables) d.dispose()
        },
    }
}
