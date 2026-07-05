import type * as monaco from 'monaco-editor'

/** Monaco 编辑器滚动条：细窄、无箭头、无阴影 */
export const SQL_EDITOR_SCROLLBAR_OPTIONS: monaco.editor.IEditorScrollbarOptions = {
    vertical: 'auto',
    horizontal: 'auto',
    verticalScrollbarSize: 8,
    horizontalScrollbarSize: 8,
    useShadows: false,
    verticalHasArrows: false,
    horizontalHasArrows: false,
    arrowSize: 0,
    scrollByPage: false,
}
