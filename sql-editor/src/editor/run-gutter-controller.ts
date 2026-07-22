import * as monaco from 'monaco-editor'
import {resolveGutterStatement, type SqlStatementSpan} from '@sql-editor/utils/sql-statement-index'
import type {SqlGutterStatementPayload} from '@sql-editor/types'

export const SQL_RUN_GUTTER_GLYPH_CLASS = 'sql-editor-run-gutter-glyph'
export const SQL_RUN_GUTTER_BTN_CLASS = 'sql-editor-run-gutter-btn'

export interface SqlRunGutterOptions {
    isEnabled: () => boolean
    isReadonly: () => boolean
    hoverMessage: () => string
    onRun: (payload: SqlGutterStatementPayload) => void
}

export interface SqlRunGutterBinding extends monaco.IDisposable {
    sync: () => void
}

function isGutterTarget(target: monaco.editor.IMouseTarget): boolean {
    const type = target.type
    return type === monaco.editor.MouseTargetType.GUTTER_GLYPH_MARGIN
        || type === monaco.editor.MouseTargetType.GUTTER_LINE_NUMBERS
}

function setRunGutterState(
    container: HTMLElement,
    state: 'disabled' | 'readonly' | 'idle' | 'on',
    reason?: string,
) {
    container.dataset.runGutter = state
    if (reason) container.dataset.runGutterReason = reason
    else delete container.dataset.runGutterReason
}

function createRunButton(): HTMLButtonElement {
    const button = document.createElement('button')
    button.type = 'button'
    button.className = SQL_RUN_GUTTER_BTN_CLASS
    button.setAttribute('aria-label', 'Run statement')
    button.innerHTML =
        '<svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true" focusable="false">' +
        '<path fill="currentColor" d="M4.2 2.8v10.4c0 .55.6.88 1.08.6l7.8-4.55c.48-.28.48-.97 0-1.25L5.28 3.2c-.48-.27-1.08.06-1.08.6z"/>' +
        '</svg>'
    return button
}

/**
 * 行内执行按钮：真实 DOM GlyphMarginWidget。
 * - 光标在空行（不属于任何语句）→ 不显示
 * - 光标在某条 SQL 内 → 仅在该语句第一行显示一个 ▶
 * - 切换到另一条 SQL → 按钮跟随切换
 */
export class SqlRunGutterController implements SqlRunGutterBinding {
    private active: SqlStatementSpan | null = null
    private gutterLine: number | null = null
    private widgetMounted = false
    private renderRaf = 0
    private readonly button = createRunButton()
    private readonly disposables: monaco.IDisposable[] = []
    private readonly glyphWidget: monaco.editor.IGlyphMarginWidget

    constructor(
        private readonly editor: monaco.editor.IStandaloneCodeEditor,
        private readonly container: HTMLElement,
        private readonly options: SqlRunGutterOptions,
    ) {
        container.classList.add('sql-monaco-host--run-gutter')
        editor.updateOptions({glyphMargin: true})

        this.glyphWidget = {
            getId: () => 'sql-editor-run-gutter',
            getDomNode: () => this.button,
            getPosition: () => ({
                lane: monaco.editor.GlyphMarginLane.Right,
                zIndex: 10000,
                range: new monaco.Range(this.active?.anchorLine ?? 1, 1, this.active?.anchorLine ?? 1, 1),
            }),
        }

        this.button.addEventListener('mousedown', (event) => {
            event.preventDefault()
            event.stopPropagation()
        })
        this.button.addEventListener('click', (event) => {
            event.preventDefault()
            event.stopPropagation()
            if (!this.active) return
            this.options.onRun({
                sql: this.active.sql,
                anchorLine: this.active.anchorLine,
            })
        })

        this.bindEvents()
        this.sync()
        // Monaco 布局完成后补几次 sync，避免首屏 glyph margin 尚未就绪时按钮不挂
        requestAnimationFrame(() => this.sync())
        window.setTimeout(() => this.sync(), 0)
        window.setTimeout(() => this.sync(), 120)
    }

    sync = (): void => {
        if (this.renderRaf) cancelAnimationFrame(this.renderRaf)
        this.renderRaf = requestAnimationFrame(() => {
            this.renderRaf = 0
            this.render()
        })
    }

    private mountWidget(): void {
        if (this.widgetMounted) return
        this.editor.addGlyphMarginWidget(this.glyphWidget)
        this.widgetMounted = true
    }

    private unmountWidget(): void {
        if (!this.widgetMounted) return
        this.editor.removeGlyphMarginWidget(this.glyphWidget)
        this.widgetMounted = false
    }

    private render(): void {
        if (!this.options.isEnabled()) {
            this.active = null
            this.unmountWidget()
            setRunGutterState(this.container, 'disabled', 'setting-off')
            return
        }
        if (this.options.isReadonly()) {
            this.active = null
            this.unmountWidget()
            setRunGutterState(this.container, 'readonly', 'readonly')
            return
        }

        const model = this.editor.getModel()
        if (!model) {
            this.active = null
            this.unmountWidget()
            setRunGutterState(this.container, 'idle')
            return
        }

        const cursorLine = this.editor.getPosition()?.lineNumber ?? null
        const statement = resolveGutterStatement(model.getValue(), cursorLine, this.gutterLine)
        if (!statement) {
            this.active = null
            this.unmountWidget()
            setRunGutterState(this.container, 'idle')
            return
        }

        this.active = statement
        this.button.title = this.options.hoverMessage()
        this.mountWidget()
        this.editor.layoutGlyphMarginWidget(this.glyphWidget)
        setRunGutterState(this.container, 'on')
    }

    private bindEvents(): void {
        this.disposables.push(
            this.editor.onMouseMove((event) => {
                if (isGutterTarget(event.target) && event.target.position) {
                    this.gutterLine = event.target.position.lineNumber
                } else {
                    this.gutterLine = null
                }
                this.sync()
            }),
            this.editor.onMouseLeave(() => {
                this.gutterLine = null
                this.sync()
            }),
            this.editor.onDidChangeCursorPosition(() => {
                this.gutterLine = null
                this.sync()
            }),
            this.editor.onDidChangeCursorSelection(() => this.sync()),
            this.editor.onDidScrollChange(() => this.sync()),
            this.editor.onDidLayoutChange(() => this.sync()),
            this.editor.onDidChangeModelContent(() => this.sync()),
            this.editor.onDidChangeModel(() => this.sync()),
            this.editor.onDidFocusEditorText(() => this.sync()),
            this.editor.onDidBlurEditorText(() => this.sync()),
        )
    }

    dispose(): void {
        if (this.renderRaf) cancelAnimationFrame(this.renderRaf)
        this.active = null
        this.gutterLine = null
        this.unmountWidget()
        this.button.remove()
        delete this.container.dataset.runGutter
        delete this.container.dataset.runGutterReason
        this.container.classList.remove('sql-monaco-host--run-gutter')
        for (const disposable of this.disposables) disposable.dispose()
        this.disposables.length = 0
    }
}

export function bindSqlRunGutter(
    editor: monaco.editor.IStandaloneCodeEditor,
    container: HTMLElement,
    options: SqlRunGutterOptions,
): SqlRunGutterBinding {
    return new SqlRunGutterController(editor, container, options)
}
