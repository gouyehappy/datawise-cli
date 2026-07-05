import * as monaco from 'monaco-editor'
import type {SuggestItem, SuggestTextRange} from '../suggest-types'
import {SUGGEST_INSERT_AS_SNIPPET} from '../suggest-types'

export function toMonacoRange(range: SuggestTextRange): monaco.IRange {
    return {...range}
}

export function toMonacoSuggestItem(item: SuggestItem): monaco.languages.CompletionItem {
    return {
        label: item.label,
        kind: item.kind,
        insertText: item.insertText,
        insertTextRules:
            item.insertTextRules === SUGGEST_INSERT_AS_SNIPPET
                ? monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet
                : undefined,
        detail: item.detail,
        documentation: item.documentation,
        filterText: item.filterText,
        range: toMonacoRange(item.range),
        sortText: item.sortText,
        preselect: item.preselect,
        command: item.command,
    }
}
