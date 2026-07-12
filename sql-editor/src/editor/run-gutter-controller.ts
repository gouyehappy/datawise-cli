import * as monaco from 'monaco-editor'
import {resolveGutterStatement, isBlankOrCommentOnlyLine, type SqlStatementSpan} from '@sql-editor/utils/sql-statement-index'
import type {SqlGutterStatementPayload} from '@sql-editor/types'

export const SQL_RUN_GUTTER_GLYPH_CLASS = 'sql-editor-run-gutter-glyph'

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

/** 清理旧版 GlyphMarginWidget 遗留的 DOM，避免与 decoration 叠出多个 ▶ */
function purgeLegacyRunGutterNodes(
    container: HTMLElement,
    editor: monaco.editor.IStandaloneCodeEditor,
): void {
    container.querySelectorAll('.sql-editor-run-gutter-btn').forEach((node) => node.remove())
    editor.getDomNode()?.querySelectorAll('.sql-editor-run-gutter-btn').forEach((node) => node.remove())
}

/**
 * 行内执行按钮控制器：单 decoration、语句首行、全局仅一个 ▶。
 * 不使用 GlyphMarginWidget，避免 Monaco widget 残留导致多按钮/错位。
 */
export class SqlRunGutterController implements SqlRunGutterBinding {
    private active: SqlStatementSpan | null = null
    private gutterLine: number | null = null
    private decorations: monaco.editor.IEditorDecorationsCollection
    private disposables: monaco.IDisposable[] = []
    private renderRaf = 0

    constructor(
        private readonly editor: monaco.editor.IStandaloneCodeEditor,
        private readonly container: HTMLElement,
        private readonly options: SqlRunGutterOptions,
    ) {
        container.classList.add('sql-monaco-host--run-gutter')
        purgeLegacyRunGutterNodes(container, editor)
        editor.updateOptions({glyphMargin: true})
        this.decorations = editor.createDecorationsCollection([])
        this.bindEvents()
        this.sync()
    }

    sync = (): void => {
        if (this.renderRaf) cancelAnimationFrame(this.renderRaf)
        this.renderRaf = requestAnimationFrame(() => {
            this.renderRaf = 0
            this.render()
        })
    }

    private render(): void {
        if (!this.options.isEnabled()) {
            this.active = null
            this.decorations.clear()
            setRunGutterState(this.container, 'disabled', 'setting-off')
            return
        }
        if (this.options.isReadonly()) {
            this.active = null
            this.decorations.clear()
            setRunGutterState(this.container, 'readonly', 'readonly')
            return
        }

        const model = this.editor.getModel()
        if (!model) {
            this.active = null
            this.decorations.clear()
            setRunGutterState(this.container, 'idle')
            return
        }

        const cursorLine = this.editor.getPosition()?.lineNumber ?? null
        const statement = resolveGutterStatement(model.getValue(), cursorLine, this.gutterLine)
        if (!statement || isBlankOrCommentOnlyLine(model.getValue(), statement.anchorLine)) {
            this.active = null
            this.decorations.clear()
            setRunGutterState(this.container, 'idle')
            return
        }

        this.active = statement
        this.decorations.set([
            {
                range: new monaco.Range(statement.anchorLine, 1, statement.anchorLine, 1),
                options: {
                    glyphMarginClassName: SQL_RUN_GUTTER_GLYPH_CLASS,
                    glyphMarginHoverMessage: {value: this.options.hoverMessage()},
                },
            },
        ])
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
            this.editor.onMouseDown((event) => {
                if (!isGutterTarget(event.target)) return
                const line = event.target.position?.lineNumber
                if (!this.active || line !== this.active.anchorLine) return
                this.options.onRun({
                    sql: this.active.sql,
                    anchorLine: this.active.anchorLine,
                })
                event.event.preventDefault()
                event.event.stopPropagation()
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
        this.decorations.clear()
        delete this.container.dataset.runGutter
        delete this.container.dataset.runGutterReason
        this.container.classList.remove('sql-monaco-host--run-gutter')
        for (const disposable of this.disposables) disposable.dispose()
        this.disposables = []
    }
}

export function bindSqlRunGutter(
    editor: monaco.editor.IStandaloneCodeEditor,
    container: HTMLElement,
    options: SqlRunGutterOptions,
): SqlRunGutterBinding {
    return new SqlRunGutterController(editor, container, options)
}
