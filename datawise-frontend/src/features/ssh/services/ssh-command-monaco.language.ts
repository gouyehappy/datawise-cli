import * as monaco from 'monaco-editor'
import {SSH_COMMAND_COMPLETIONS} from '@/features/ssh/services/ssh-script-record-content.service'

export const SSH_COMMAND_MONACO_LANGUAGE = 'dw-ssh-commands'

let registered = false

/** Register Monarch language + completions for SSH quick-command DSL (idempotent). */
export function ensureSshCommandMonacoLanguage(): void {
    if (registered) return
    registered = true

    monaco.languages.register({id: SSH_COMMAND_MONACO_LANGUAGE})

    monaco.languages.setMonarchTokensProvider(SSH_COMMAND_MONACO_LANGUAGE, {
        defaultToken: '',
        tokenizer: {
            root: [
                [/^@(?:run|paste)\b.*$/, 'keyword'],
                [/^#.*$/, 'comment'],
                [/\{\{[A-Za-z_][\w.-]*\}\}/, 'variable'],
                [/!(?:run|paste)\b/, 'keyword'],
                [/./, ''],
            ],
        },
    })

    monaco.languages.setLanguageConfiguration(SSH_COMMAND_MONACO_LANGUAGE, {
        comments: {lineComment: '#'},
        brackets: [
            ['{', '}'],
            ['(', ')'],
            ['[', ']'],
        ],
        autoClosingPairs: [
            {open: '{', close: '}'},
            {open: '(', close: ')'},
            {open: '[', close: ']'},
            {open: '"', close: '"'},
            {open: "'", close: "'"},
            {open: '`', close: '`'},
        ],
        surroundingPairs: [
            {open: '{', close: '}'},
            {open: '(', close: ')'},
            {open: '[', close: ']'},
            {open: '"', close: '"'},
            {open: "'", close: "'"},
            {open: '`', close: '`'},
        ],
    })

    monaco.languages.registerCompletionItemProvider(SSH_COMMAND_MONACO_LANGUAGE, {
        triggerCharacters: ['@', '{', '!', '#'],
        provideCompletionItems(model, position) {
            const word = model.getWordUntilPosition(position)
            const range = new monaco.Range(
                position.lineNumber,
                word.startColumn,
                position.lineNumber,
                word.endColumn,
            )
            const linePrefix = model.getLineContent(position.lineNumber).slice(0, position.column - 1)
            const suggestions: monaco.languages.CompletionItem[] = SSH_COMMAND_COMPLETIONS.map((item, index) => {
                const kind = item.label.startsWith('#')
                    ? monaco.languages.CompletionItemKind.Snippet
                    : item.label.startsWith('{')
                      ? monaco.languages.CompletionItemKind.Variable
                      : monaco.languages.CompletionItemKind.Keyword
                return {
                    label: item.label,
                    kind,
                    detail: item.detail,
                    insertText: item.insertText,
                    insertTextRules: item.insertText.includes('${')
                        ? monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet
                        : undefined,
                    range,
                    sortText: String(index).padStart(2, '0'),
                    // Prefer `@` / `#` completions when typing at line start.
                    filterText: `${linePrefix}${item.label}`,
                }
            })
            return {suggestions}
        },
    })
}
