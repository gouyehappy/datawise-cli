import * as monaco from 'monaco-editor'
import {resolveRunGutterStatement} from '@sql-editor/utils/statement-at-cursor'
import type {SqlGutterStatementPayload} from '@sql-editor/types'

export type SqlRunGutterPayload = SqlGutterStatementPayload

export interface SqlRunGutterOptions {
    isEnabled: () => boolean
    isReadonly: () => boolean
    hoverMessage: () => string
    onRun: (payload: SqlGutterStatementPayload) => void
}

type ActiveStatement = {
    statement: NonNullable<ReturnType<typeof resolveRunGutterStatement>>
    line: number
}

function isGutterMouseTarget(target: monaco.editor.IMouseTarget): boolean {
    const type = target.type
    return type === monaco.editor.MouseTargetType.GUTTER_GLYPH_MARGIN
        || type === monaco.editor.MouseTargetType.GUTTER_LINE_NUMBERS
}

function resolveActiveStatement(
    editor: monaco.editor.IStandaloneCodeEditor,
    hoveredLine: number | null,
): ActiveStatement | null {
    const model = editor.getModel()
    if (!model) return null

    const cursorLine = editor.getPosition()?.lineNumber ?? null
    const statement = resolveRunGutterStatement(model.getValue(), cursorLine, hoveredLine)
    if (!statement) return null

    return {
        statement,
        line: statement.anchorLine,
    }
}

function createRunButton(): HTMLButtonElement {
    const button = document.createElement('button')
    button.type = 'button'
    button.className = 'sql-editor-run-gutter-btn'
    button.setAttribute('aria-label', 'Run statement')
    button.innerHTML =
        '<svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true" focusable="false">' +
        '<path fill="currentColor" d="M4.2 2.8v10.4c0 .55.6.88 1.08.6l7.8-4.55c.48-.28.48-.97 0-1.25L5.28 3.2c-.48-.27-1.08.06-1.08.6z"/>' +
        '</svg>'
    return button
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

/** 行内执行按钮：仅 ▶，空行不显示，多行 SQL 仅在语句首行。 */
export function bindSqlRunGutter(
    editor: monaco.editor.IStandaloneCodeEditor,
    container: HTMLElement,
    options: SqlRunGutterOptions,
): monaco.IDisposable {
    container.classList.add('sql-monaco-host--run-gutter')

    const button = createRunButton()
    let active: ActiveStatement | null = null
    let hoveredLine: number | null = null
    let widgetMounted = false

    const glyphWidget: monaco.editor.IGlyphMarginWidget = {
        getId: () => 'sql-editor-run-gutter',
        getDomNode: () => button,
        getPosition: () => ({
            lane: monaco.editor.GlyphMarginLane.Right,
            zIndex: 10000,
            range: new monaco.Range(active?.line ?? 1, 1, active?.line ?? 1, 1),
        }),
    }

    const mountWidget = () => {
        if (widgetMounted) return
        editor.addGlyphMarginWidget(glyphWidget)
        widgetMounted = true
    }

    const unmountWidget = () => {
        if (!widgetMounted) return
        editor.removeGlyphMarginWidget(glyphWidget)
        widgetMounted = false
    }

    const sync = () => {
        if (!options.isEnabled()) {
            active = null
            unmountWidget()
            setRunGutterState(container, 'disabled', 'setting-off')
            return
        }
        if (options.isReadonly()) {
            active = null
            unmountWidget()
            setRunGutterState(container, 'readonly', 'readonly')
            return
        }

        active = resolveActiveStatement(editor, hoveredLine)
        if (!active) {
            unmountWidget()
            setRunGutterState(container, 'idle')
            return
        }

        mountWidget()
        button.title = options.hoverMessage()
        editor.layoutGlyphMarginWidget(glyphWidget)
        setRunGutterState(container, 'on')
    }

    button.addEventListener('mousedown', (event) => {
        event.preventDefault()
        event.stopPropagation()
    })
    button.addEventListener('click', (event) => {
        event.preventDefault()
        event.stopPropagation()
        if (!active) return
        options.onRun({
            sql: active.statement.sql,
            anchorLine: active.statement.anchorLine,
        })
    })

    editor.updateOptions({glyphMargin: true})

    const disposables: monaco.IDisposable[] = [
        editor.onMouseMove((event) => {
            if (isGutterMouseTarget(event.target) && event.target.position) {
                hoveredLine = event.target.position.lineNumber
            } else {
                hoveredLine = null
            }
            sync()
        }),
        editor.onMouseLeave(() => {
            hoveredLine = null
            sync()
        }),
        editor.onDidChangeCursorPosition(() => {
            hoveredLine = null
            sync()
        }),
        editor.onDidScrollChange(() => sync()),
        editor.onDidLayoutChange(() => sync()),
        editor.onDidChangeModelContent(() => sync()),
        editor.onDidChangeModel(() => sync()),
        editor.onDidFocusEditorText(() => sync()),
    ]

    sync()
    requestAnimationFrame(sync)
    window.setTimeout(sync, 0)
    window.setTimeout(sync, 120)
    window.setTimeout(sync, 400)

    const resizeObserver =
        typeof ResizeObserver !== 'undefined'
            ? new ResizeObserver(() => sync())
            : null
    resizeObserver?.observe(container)

    return {
        dispose: () => {
            active = null
            hoveredLine = null
            resizeObserver?.disconnect()
            unmountWidget()
            button.remove()
            delete container.dataset.runGutter
            delete container.dataset.runGutterReason
            container.classList.remove('sql-monaco-host--run-gutter')
            for (const disposable of disposables) disposable.dispose()
        },
    }
}
