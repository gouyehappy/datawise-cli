import * as monaco from 'monaco-editor'
import {
    DEFAULT_EDITOR_SETTINGS,
    EDITOR_FONT_OPTIONS,
    EDITOR_FONT_SIZE_MAX,
    EDITOR_FONT_SIZE_MIN,
    EDITOR_LINE_HEIGHT_MAX,
    EDITOR_LINE_HEIGHT_MIN,
    EDITOR_STORAGE_KEY,
    EDITOR_THEME_OPTIONS,
    LEGACY_THEME_MAP,
    MAX_RESULT_ROWS_MIN,
    MAX_RESULT_ROWS_MAX,
    SLOW_QUERY_THRESHOLD_MAX,
    SLOW_QUERY_THRESHOLD_MIN,
    DEFAULT_SLOW_QUERY_THRESHOLD_MS,
    DEFAULT_GRID_PAGE_SIZE,
    GRID_PAGE_SIZE_OPTIONS,
    type EditorSettings,
    type EditorThemeId,
} from '@/features/settings/constants/editor-presets'
import {ensureMonacoThemes} from '@/features/settings/services/monaco-themes'
import {UserResource} from '@/features/auth/types/user-resource.types'
import {
    canPersistLocalResource,
    canReadResource,
    resolveResourceStorageKey,
} from '@/features/auth/services/user-resource-policy'

export {ensureMonacoThemes} from '@/features/settings/services/monaco-themes'

const FONT_SET = new Set<string>(EDITOR_FONT_OPTIONS)

function resolveStorageKey(): string {
    return resolveResourceStorageKey(UserResource.EditorPreferences, EDITOR_STORAGE_KEY)
        ?? EDITOR_STORAGE_KEY
}

function isEditorThemeId(value: unknown): value is EditorThemeId {
    if (typeof value !== 'string') return false
    if (EDITOR_THEME_OPTIONS.includes(value as EditorThemeId)) return true
    return value in LEGACY_THEME_MAP
}

function normalizeTheme(value: unknown): EditorThemeId {
    if (typeof value !== 'string') return DEFAULT_EDITOR_SETTINGS.theme
    if (EDITOR_THEME_OPTIONS.includes(value as EditorThemeId)) return value as EditorThemeId
    return LEGACY_THEME_MAP[value] ?? DEFAULT_EDITOR_SETTINGS.theme
}

function clampNumber(value: unknown, fallback: number, min: number, max: number): number {
    const num = typeof value === 'number' ? value : Number(value)
    if (!Number.isFinite(num)) return fallback
    return Math.min(max, Math.max(min, num))
}

function normalizeGridPageSize(value: unknown): number {
    const num = clampNumber(
        value,
        DEFAULT_EDITOR_SETTINGS.defaultGridPageSize,
        DEFAULT_GRID_PAGE_SIZE,
        GRID_PAGE_SIZE_OPTIONS[GRID_PAGE_SIZE_OPTIONS.length - 1],
    )
    if (num <= 0) return DEFAULT_GRID_PAGE_SIZE
    if (GRID_PAGE_SIZE_OPTIONS.includes(num as (typeof GRID_PAGE_SIZE_OPTIONS)[number])) return num
    return DEFAULT_GRID_PAGE_SIZE
}

export function readStoredEditorSettings(): EditorSettings {
    if (!canReadResource(UserResource.EditorPreferences)) return {...DEFAULT_EDITOR_SETTINGS}
    if (!canPersistLocalResource(UserResource.EditorPreferences)) return {...DEFAULT_EDITOR_SETTINGS}
    try {
        const raw = localStorage.getItem(resolveStorageKey())
        if (!raw) return {...DEFAULT_EDITOR_SETTINGS}
        const parsed = JSON.parse(raw) as Partial<EditorSettings>
        const fontFamily = typeof parsed.fontFamily === 'string' && parsed.fontFamily.trim()
            ? parsed.fontFamily.trim()
            : DEFAULT_EDITOR_SETTINGS.fontFamily
        return {
            theme: isEditorThemeId(parsed.theme) ? normalizeTheme(parsed.theme) : DEFAULT_EDITOR_SETTINGS.theme,
            fontFamily: FONT_SET.has(fontFamily) ? fontFamily : DEFAULT_EDITOR_SETTINGS.fontFamily,
            fontSize: clampNumber(parsed.fontSize, DEFAULT_EDITOR_SETTINGS.fontSize, EDITOR_FONT_SIZE_MIN, EDITOR_FONT_SIZE_MAX),
            lineHeight: clampNumber(parsed.lineHeight, DEFAULT_EDITOR_SETTINGS.lineHeight, EDITOR_LINE_HEIGHT_MIN, EDITOR_LINE_HEIGHT_MAX),
            lineNumbers: parsed.lineNumbers ?? DEFAULT_EDITOR_SETTINGS.lineNumbers,
            minimap: parsed.minimap ?? DEFAULT_EDITOR_SETTINGS.minimap,
            wordWrap: parsed.wordWrap ?? DEFAULT_EDITOR_SETTINGS.wordWrap,
            folding: parsed.folding ?? DEFAULT_EDITOR_SETTINGS.folding,
            maxResultRows: clampNumber(
                parsed.maxResultRows,
                DEFAULT_EDITOR_SETTINGS.maxResultRows,
                MAX_RESULT_ROWS_MIN,
                MAX_RESULT_ROWS_MAX,
            ),
            defaultGridPageSize: normalizeGridPageSize(parsed.defaultGridPageSize),
            slowQueryThresholdMs: clampNumber(
                parsed.slowQueryThresholdMs,
                DEFAULT_EDITOR_SETTINGS.slowQueryThresholdMs,
                SLOW_QUERY_THRESHOLD_MIN,
                SLOW_QUERY_THRESHOLD_MAX,
            ),
            productionPerfMode: typeof parsed.productionPerfMode === 'boolean'
                ? parsed.productionPerfMode
                : DEFAULT_EDITOR_SETTINGS.productionPerfMode,
        }
    } catch {
        return {...DEFAULT_EDITOR_SETTINGS}
    }
}

export function persistEditorSettings(settings: EditorSettings) {
    if (!canPersistLocalResource(UserResource.EditorPreferences)) return
    localStorage.setItem(resolveStorageKey(), JSON.stringify(settings))
}

export function applyEditorTheme(theme: EditorThemeId) {
    ensureMonacoThemes()
    monaco.editor.setTheme(theme)
}

export function buildMinimapOptions(enabled: boolean): monaco.editor.IEditorMinimapOptions {
    if (!enabled) return {enabled: false}
    return {
        enabled: true,
        side: 'right',
        size: 'proportional',
        scale: 1,
        maxColumn: 120,
        showSlider: 'always',
        renderCharacters: true,
        showRegionSectionHeaders: false,
    }
}

/** 仅外观：主题、字体、行号等；不含 suggest / wordBasedSuggestions（由 SQL 编辑器包统一） */
export function toMonacoAppearanceOptions(
    settings: EditorSettings,
): monaco.editor.IStandaloneEditorConstructionOptions {
    return {
        theme: settings.theme,
        fontFamily: settings.fontFamily,
        fontSize: settings.fontSize,
        lineHeight: settings.lineHeight,
        lineNumbers: settings.lineNumbers ? 'on' : 'off',
        minimap: buildMinimapOptions(settings.minimap),
        wordWrap: settings.wordWrap ? 'on' : 'off',
        folding: settings.folding,
        foldingHighlight: settings.folding,
        showFoldingControls: settings.folding ? 'always' : 'never',
    }
}
