/**
 * 主题运行时服务。
 * 首屏同步逻辑需与 public/theme-boot.js 保持一致。
 */
import {
    BACKGROUND_PRESETS_DARK,
    BACKGROUND_PRESETS_LIGHT,
    DEFAULT_THEME_PREFERENCES,
    PRIMARY_PRESETS,
    THEME_STORAGE_KEY,
    resolveThemeMode,
    type BackgroundTone,
    type PrimaryTone,
    type ThemeAppearance,
    type ThemeMode,
    type ThemePreferences,
    type UiSkin,
} from '@/features/settings/constants/theme-presets'
import {isRegisteredUiSkin, resolveUiSkinDefinition} from '@/core/ui-skin'
import {APP_CONFIG_KEY, resolveAppConfigStorageKey} from '@/shared/config/app-config-storage-scope'
import {UserResource} from '@/features/auth/types/user-resource.types'
import {
    canPersistLocalResource,
    canReadResource,
    resolveResourceStorageKey,
} from '@/features/auth/services/user-resource-policy'

const BACKGROUND_TONES: BackgroundTone[] = ['default', 'warm', 'cool', 'slate']
const PRIMARY_TONES: PrimaryTone[] = ['violet', 'blue', 'cyan', 'green', 'orange', 'rose']
const APPEARANCES: ThemeAppearance[] = ['light', 'dark', 'system']

/** 由 JS 统一写入的 CSS 变量，切换明暗时需先清除避免残留 */
const MANAGED_THEME_VARS = [
    '--dw-primary',
    '--dw-primary-hover',
    '--dw-primary-softer',
    '--dw-primary-mild',
    '--dw-primary-soft',
    '--dw-primary-tint',
    '--dw-primary-border',
    '--dw-primary-ring',
    '--dw-bg',
    '--dw-bg-muted',
    '--dw-bg-panel',
    '--dw-bg-hover',
    '--dw-bg-rail',
    '--dw-bg-editor',
    '--dw-bg-chrome',
    '--dw-border',
    '--dw-border-light',
    '--dw-panel-border',
    '--dw-panel-shadow',
    '--dw-text',
    '--dw-text-secondary',
    '--dw-text-muted',
    '--dw-text-dim',
    '--dw-tool-hover',
    '--dw-tool-active',
    '--dw-tool-pill-active',
    '--dw-tab-bar-bg',
    '--dw-tab-bar-border',
    '--dw-tab-active-bg',
    '--dw-tab-active-border',
    '--dw-tab-active-text',
    '--dw-tab-inactive-text',
    '--dw-tab-hover-bg',
    '--dw-tab-close-hover',
    '--dw-shadow',
    '--dw-menu-shadow',
] as const

const DARK_UI = {
    border: '#2e2e32',
    borderLight: '#232326',
    panelBorder: 'rgba(255, 255, 255, 0.06)',
    panelShadow: '0 1px 3px rgba(0, 0, 0, 0.28)',
    text: '#bcbec4',
    textSecondary: '#a0a3a8',
    textMuted: '#868a91',
    textDim: '#6f737a',
    tabBarBg: '#3c3f41',
    tabBarBorder: '#323437',
    tabActiveBg: '#4e5254',
    tabActiveBorder: '#3574f0',
    tabActiveText: '#dfe1e5',
    tabInactiveText: '#a0a3a8',
    tabHoverBg: 'rgba(255, 255, 255, 0.08)',
    tabCloseHover: 'rgba(255, 255, 255, 0.1)',
    toolPillActive: '#4a4d50',
    shadow: '0 8px 24px rgba(0, 0, 0, 0.35)',
    menuShadow:
        '0 1px 2px rgba(0, 0, 0, 0.2), 0 4px 12px rgba(0, 0, 0, 0.24), 0 16px 40px rgba(0, 0, 0, 0.32)',
} as const

const LIGHT_UI = {
    border: '#e2e8f0',
    borderLight: '#eef2f7',
    panelBorder: 'rgba(15, 23, 42, 0.08)',
    panelShadow: '0 1px 2px rgba(15, 23, 42, 0.04)',
    text: '#111827',
    textSecondary: '#6b7280',
    textMuted: '#9ca3af',
    textDim: '#808080',
    chrome: '#dce4ee',
    tabBarBg: '#dce3ea',
    tabBarBorder: '#c5cdd8',
    tabActiveBg: '#ffffff',
    tabActiveBorder: '#2563eb',
    tabActiveText: '#1f2937',
    tabInactiveText: '#6b7280',
    tabHoverBg: 'rgba(0, 0, 0, 0.08)',
    tabCloseHover: 'rgba(0, 0, 0, 0.08)',
    shadow: '0 8px 24px rgba(15, 23, 42, 0.1)',
    menuShadow:
        '0 1px 2px rgba(15, 23, 42, 0.04), 0 4px 12px rgba(15, 23, 42, 0.06), 0 16px 40px rgba(15, 23, 42, 0.1)',
} as const

function isBackgroundTone(value: unknown): value is BackgroundTone {
    return typeof value === 'string' && BACKGROUND_TONES.includes(value as BackgroundTone)
}

function isPrimaryTone(value: unknown): value is PrimaryTone {
    return typeof value === 'string' && PRIMARY_TONES.includes(value as PrimaryTone)
}

function isThemeAppearance(value: unknown): value is ThemeAppearance {
    return typeof value === 'string' && APPEARANCES.includes(value as ThemeAppearance)
}

function isUiSkin(value: unknown): value is UiSkin {
    return isRegisteredUiSkin(value)
}

function withAlpha(hex: string, alpha: number): string {
    const normalized = hex.replace('#', '')
    const value = normalized.length === 3
        ? normalized.split('').map((c) => c + c).join('')
        : normalized
    const r = Number.parseInt(value.slice(0, 2), 16)
    const g = Number.parseInt(value.slice(2, 4), 16)
    const b = Number.parseInt(value.slice(4, 6), 16)
    return `rgba(${r}, ${g}, ${b}, ${alpha})`
}

function readAppearance(parsed: Partial<ThemePreferences> & { mode?: ThemeMode }): ThemeAppearance {
    if (isThemeAppearance(parsed.appearance)) return parsed.appearance
    if (parsed.mode === 'dark') return 'dark'
    return 'light'
}

export function normalizeThemePreferences(
    parsed: Partial<ThemePreferences> & { mode?: ThemeMode } = {},
): ThemePreferences {
    return {
        appearance: readAppearance(parsed),
        background: isBackgroundTone(parsed.background)
            ? parsed.background
            : DEFAULT_THEME_PREFERENCES.background,
        primary: isPrimaryTone(parsed.primary) ? parsed.primary : DEFAULT_THEME_PREFERENCES.primary,
        uiSkin: isUiSkin(parsed.uiSkin) ? parsed.uiSkin : DEFAULT_THEME_PREFERENCES.uiSkin,
    }
}

function clearManagedThemeVars(root: HTMLElement) {
    for (const name of MANAGED_THEME_VARS) {
        root.style.removeProperty(name)
    }
}

function buildThemeVars(
    mode: ThemeMode,
    background: BackgroundTone,
    primaryTone: PrimaryTone,
    uiSkin: UiSkin = 'classic',
): Record<string, string> {
    const primary = PRIMARY_PRESETS[primaryTone] ?? PRIMARY_PRESETS.blue
    const surfaces = mode === 'dark'
        ? BACKGROUND_PRESETS_DARK[background] ?? BACKGROUND_PRESETS_DARK.cool
        : BACKGROUND_PRESETS_LIGHT[background] ?? BACKGROUND_PRESETS_LIGHT.cool
    const ui = mode === 'dark' ? DARK_UI : LIGHT_UI
    const skinDef = resolveUiSkinDefinition(uiSkin)
    const panelShadow = skinDef.panelShadow === 'none' ? 'none' : ui.panelShadow

    const chrome = mode === 'dark' ? surfaces.rail : LIGHT_UI.chrome
    const isIde = uiSkin === 'ide'

    const vars: Record<string, string> = {
        '--dw-primary': primary.primary,
        '--dw-primary-hover': primary.hover,
        '--dw-primary-softer': withAlpha(primary.primary, mode === 'dark' ? 0.08 : 0.06),
        '--dw-primary-mild': withAlpha(primary.primary, mode === 'dark' ? 0.16 : 0.1),
        '--dw-primary-soft': withAlpha(primary.primary, mode === 'dark' ? 0.14 : 0.12),
        '--dw-primary-tint': mode === 'dark'
            ? `color-mix(in srgb, ${primary.primary} 18%, var(--dw-bg-panel))`
            : `color-mix(in srgb, ${primary.primary} 11%, var(--dw-bg))`,
        '--dw-primary-border': withAlpha(primary.primary, 0.45),
        '--dw-primary-ring': withAlpha(primary.primary, mode === 'dark' ? 0.34 : 0.22),
        '--dw-bg': surfaces.bg,
        '--dw-bg-muted': surfaces.muted,
        '--dw-bg-panel': surfaces.panel,
        '--dw-bg-hover': surfaces.hover,
        '--dw-bg-rail': surfaces.rail,
        '--dw-bg-editor': surfaces.bg,
        '--dw-bg-chrome': chrome,
        '--dw-border': ui.border,
        '--dw-border-light': ui.borderLight,
        '--dw-panel-border': ui.panelBorder,
        '--dw-panel-shadow': panelShadow,
        '--dw-text': ui.text,
        '--dw-text-secondary': ui.textSecondary,
        '--dw-text-muted': ui.textMuted,
        '--dw-text-dim': ui.textDim,
        '--dw-tool-hover': mode === 'dark'
            ? 'color-mix(in srgb, #fff 7%, transparent)'
            : 'color-mix(in srgb, var(--dw-text) 6%, transparent)',
        '--dw-tool-active': `color-mix(in srgb, ${primary.primary} 10%, var(--dw-bg-rail))`,
        '--dw-tool-pill-active': mode === 'dark'
            ? DARK_UI.toolPillActive
            : 'color-mix(in srgb, var(--dw-text) 9%, var(--dw-bg-hover))',
        // IDE：激活 Tab 贴合编辑器底；classic 保留描边胶囊色
        '--dw-tab-bar-bg': isIde ? chrome : ui.tabBarBg,
        '--dw-tab-bar-border': isIde ? ui.panelBorder : ui.tabBarBorder,
        '--dw-tab-active-bg': isIde ? surfaces.bg : ui.tabActiveBg,
        '--dw-tab-active-border': isIde ? 'transparent' : ui.tabActiveBorder,
        '--dw-tab-active-text': isIde ? ui.text : ui.tabActiveText,
        '--dw-tab-inactive-text': ui.tabInactiveText,
        '--dw-tab-hover-bg': isIde
            ? (mode === 'dark'
                ? 'color-mix(in srgb, #fff 5%, transparent)'
                : 'color-mix(in srgb, var(--dw-text) 6%, transparent)')
            : ui.tabHoverBg,
        '--dw-tab-close-hover': isIde
            ? (mode === 'dark'
                ? 'color-mix(in srgb, #fff 10%, transparent)'
                : 'color-mix(in srgb, var(--dw-text) 10%, transparent)')
            : ui.tabCloseHover,
        '--dw-shadow': ui.shadow,
        '--dw-menu-shadow': ui.menuShadow,
    }

    return vars
}

export function readStoredThemePreferences(): ThemePreferences {
    if (!canReadResource(UserResource.ThemePreferences)) return {...DEFAULT_THEME_PREFERENCES}
    if (!canPersistLocalResource(UserResource.ThemePreferences)) return {...DEFAULT_THEME_PREFERENCES}
    try {
        const key = resolveResourceStorageKey(UserResource.ThemePreferences, THEME_STORAGE_KEY)
            ?? THEME_STORAGE_KEY
        const raw = localStorage.getItem(key)
        if (!raw) return {...DEFAULT_THEME_PREFERENCES}
        const parsed = JSON.parse(raw) as Partial<ThemePreferences> & { mode?: ThemeMode }
        return normalizeThemePreferences(parsed)
    } catch {
        return {...DEFAULT_THEME_PREFERENCES}
    }
}

/** 启动时读取主题：优先 dw-cli-theme-prefs，否则回退 app-config 中的 theme */
export function readThemePreferencesOnBoot(): ThemePreferences {
    if (!canReadResource(UserResource.ThemePreferences)) return {...DEFAULT_THEME_PREFERENCES}
    if (!canPersistLocalResource(UserResource.ThemePreferences)) return {...DEFAULT_THEME_PREFERENCES}
    try {
        const themeKey = resolveResourceStorageKey(UserResource.ThemePreferences, THEME_STORAGE_KEY)
            ?? THEME_STORAGE_KEY
        if (localStorage.getItem(themeKey)) {
            return readStoredThemePreferences()
        }
        const raw = localStorage.getItem(resolveAppConfigStorageKey())
        if (raw) {
            const parsed = JSON.parse(raw) as { theme?: Partial<ThemePreferences> & { mode?: ThemeMode } }
            if (parsed.theme) {
                return normalizeThemePreferences(parsed.theme)
            }
        }
    } catch {
        /* fall through */
    }
    return readStoredThemePreferences()
}

/** 在 Vue 挂载前同步主题，避免刷新时闪烁或配色错乱 */
export function bootstrapTheme(): void {
    if (typeof document === 'undefined') return
    applyThemePreferences(readThemePreferencesOnBoot())
}

export function persistThemePreferences(prefs: ThemePreferences) {
    if (!canPersistLocalResource(UserResource.ThemePreferences)) return
    const key = resolveResourceStorageKey(UserResource.ThemePreferences, THEME_STORAGE_KEY)
        ?? THEME_STORAGE_KEY
    localStorage.setItem(key, JSON.stringify(prefs))
}

export function getSystemPrefersDark(): boolean {
    if (typeof window === 'undefined') return false
    return window.matchMedia('(prefers-color-scheme: dark)').matches
}

export function applyThemePreferences(prefs: ThemePreferences, resolvedMode?: ThemeMode) {
    const root = document.documentElement
    const mode = resolvedMode ?? resolveThemeMode(prefs.appearance, getSystemPrefersDark())

    const skin = prefs.uiSkin ?? DEFAULT_THEME_PREFERENCES.uiSkin
    clearManagedThemeVars(root)
    root.setAttribute('data-theme', mode)
    root.setAttribute('data-bg-tone', prefs.background)
    root.setAttribute('data-ui-skin', skin)
    root.style.colorScheme = mode

    const vars = buildThemeVars(mode, prefs.background, prefs.primary, skin)
    for (const [name, value] of Object.entries(vars)) {
        root.style.setProperty(name, value)
    }
}

export function watchSystemTheme(onChange: () => void): () => void {
    if (typeof window === 'undefined') return () => {
    }
    const mq = window.matchMedia('(prefers-color-scheme: dark)')
    const handler = () => onChange()
    mq.addEventListener('change', handler)
    return () => mq.removeEventListener('change', handler)
}
