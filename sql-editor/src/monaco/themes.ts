import * as monaco from 'monaco-editor'

const DARK_MINIMAP: Record<string, string> = {
    'minimap.background': '#2a2c38',
    'minimapSlider.background': '#ffffff0a',
    'minimapSlider.hoverBackground': '#a78bfa18',
}

const LIGHT_MINIMAP: Record<string, string> = {
    'minimap.background': '#f3f4f6',
    'minimapSlider.background': '#0f172a08',
    'minimapSlider.hoverBackground': '#7c3aed12',
}

const THEMES: Record<string, monaco.editor.IStandaloneThemeData> = {
    'one-dark': {
        base: 'vs-dark',
        inherit: true,
        rules: [
            {token: 'comment', foreground: '5c6370', fontStyle: 'italic'},
            {token: 'keyword', foreground: 'c678dd', fontStyle: 'bold'},
            {token: 'string', foreground: '98c379'},
            {token: 'number', foreground: 'd19a66'},
            {token: 'type', foreground: 'e5c07b'},
            {token: 'function', foreground: '61afef'},
        ],
        colors: {
            'editor.background': '#282c34',
            'editor.foreground': '#abb2bf',
            'editorLineNumber.foreground': '#5c6370',
            'editor.lineHighlightBackground': '#2c313a',
            'editor.selectionBackground': '#3e445166',
            'editorGutter.background': '#282c34',
            ...DARK_MINIMAP,
        },
    },
    'github-light': {
        base: 'vs',
        inherit: true,
        rules: [
            {token: 'comment', foreground: '6e7781', fontStyle: 'italic'},
            {token: 'keyword', foreground: 'cf222e', fontStyle: 'bold'},
            {token: 'string', foreground: '0a3069'},
            {token: 'number', foreground: '0550ae'},
            {token: 'type', foreground: '953800'},
        ],
        colors: {
            'editor.background': '#ffffff',
            'editor.foreground': '#24292f',
            'editorLineNumber.foreground': '#8c959f',
            'editor.lineHighlightBackground': '#f6f8fa',
            'editor.selectionBackground': '#b6e3ff66',
            'editorGutter.background': '#ffffff',
            ...LIGHT_MINIMAP,
        },
    },
}

let registered = false

export function ensureSqlEditorMonacoThemes() {
    if (registered) return
    registered = true
    for (const [id, definition] of Object.entries(THEMES)) {
        monaco.editor.defineTheme(id, definition)
    }
}

export function applySqlEditorMonacoTheme(theme: string) {
    ensureSqlEditorMonacoThemes()
    monaco.editor.setTheme(theme)
}
