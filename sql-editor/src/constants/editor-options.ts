import type * as monaco from 'monaco-editor'
import {SQL_EDITOR_SCROLLBAR_OPTIONS} from './scrollbar-options'

/** SQL 工程师向 Monaco 编辑体验 */
export const SQL_EDITOR_MONACO_OPTIONS: monaco.editor.IStandaloneEditorConstructionOptions = {
    scrollbar: SQL_EDITOR_SCROLLBAR_OPTIONS,
    wordWrap: 'on',
    wrappingIndent: 'same',
    autoClosingBrackets: 'always',
    autoClosingQuotes: 'always',
    autoSurround: 'languageDefined',
    bracketPairColorization: {enabled: true},
    matchBrackets: 'always',
    autoIndent: 'full',
    renderLineHighlight: 'line',
    cursorBlinking: 'smooth',
    smoothScrolling: true,
    folding: true,
    foldingHighlight: true,
    showFoldingControls: 'mouseover',
    glyphMargin: true,
    fixedOverflowWidgets: true,
    // 关闭 inline 幽灵补全，使用下拉列表（inline 模式小写输入几乎不出提示）
    inlineSuggest: {enabled: false},
    suggest: {
        showIcons: true,
        // 自定义 SQL 关键字补全使用 CompletionItemKind.Keyword，必须为 true
        showKeywords: true,
        showSnippets: true,
        showFields: true,
        showClasses: true,
        showWords: false,
        snippetsPreventQuickSuggestions: false,
        localityBonus: true,
        shareSuggestSelections: true,
        filterGraceful: true,
        matchOnWordStartOnly: false,
        // 主列表右侧展示类型/返回类型（label.description）；片段长说明仍在二级 documentation 面板
        showInlineDetails: true,
        preview: false,
        showStatusBar: true,
    },
    // 必须是字符串 'on'，boolean true 或 'inline' 都不会弹出补全列表
    quickSuggestions: {
        other: 'on',
        comments: 'off',
        strings: 'off',
    },
    wordBasedSuggestions: 'off',
    tabCompletion: 'on',
    acceptSuggestionOnEnter: 'on',
    snippetSuggestions: 'inline',
    quickSuggestionsDelay: 50,
    suggestOnTriggerCharacters: true,
}

/** 合并宿主/实例覆盖，并锁定关闭文档单词补全（避免 partial suggest 把 showWords 重置为 true） */
export function resolveSqlEditorMonacoOptions(
    overrides: monaco.editor.IStandaloneEditorConstructionOptions = {},
): monaco.editor.IStandaloneEditorConstructionOptions {
    const {suggest: overrideSuggest, ...rest} = overrides
    return {
        ...SQL_EDITOR_MONACO_OPTIONS,
        ...rest,
        wordBasedSuggestions: 'off',
        suggest: {
            ...(SQL_EDITOR_MONACO_OPTIONS.suggest ?? {}),
            ...(overrideSuggest ?? {}),
            showWords: false,
        },
    }
}
