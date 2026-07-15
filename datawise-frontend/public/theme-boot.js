/**
 * 首屏同步主题（在 Vite 模块加载前执行）。
 * 逻辑与 theme.service.ts 保持同步。
 */
;(function () {
    var THEME_KEY = 'dw-cli-theme-prefs'
    var CONFIG_KEY = 'dw-app-config'

    var PRIMARY = {
        violet: {primary: '#7c3aed', hover: '#6d28d9'},
        blue: {primary: '#2563eb', hover: '#1d4ed8'},
        cyan: {primary: '#0891b2', hover: '#0e7490'},
        green: {primary: '#16a34a', hover: '#15803d'},
        orange: {primary: '#ea580c', hover: '#c2410c'},
        rose: {primary: '#e11d48', hover: '#be123c'},
    }

    var BG_LIGHT = {
        default: {bg: '#ffffff', muted: '#f8f9fb', panel: '#fafbfc', hover: '#f3f4f6', rail: '#f5f6f8'},
        warm: {bg: '#faf9f7', muted: '#f5f3ef', panel: '#f7f5f1', hover: '#ede9e3', rail: '#f0ece6'},
        cool: {bg: '#f8fafc', muted: '#f1f5f9', panel: '#f4f7fb', hover: '#e8eef5', rail: '#eef2f7'},
        slate: {bg: '#f4f6f8', muted: '#eceff3', panel: '#f0f2f5', hover: '#e2e6eb', rail: '#e8ebef'},
    }

    var BG_DARK = {
        default: {bg: '#111113', muted: '#18181b', panel: '#1c1c1f', hover: '#27272a', rail: '#141416'},
        warm: {bg: '#141210', muted: '#1b1916', panel: '#201e1a', hover: '#2b2823', rail: '#12100e'},
        cool: {bg: '#0f1419', muted: '#151b22', panel: '#1a2129', hover: '#24303c', rail: '#0c1014'},
        slate: {bg: '#121417', muted: '#181c21', panel: '#1d2228', hover: '#282e36', rail: '#0e1013'},
    }

    var DARK_UI = {
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
    }

    var LIGHT_UI = {
        border: '#e5e7eb',
        borderLight: '#eef0f3',
        panelBorder: 'rgba(15, 23, 42, 0.08)',
        panelShadow: '0 1px 2px rgba(15, 23, 42, 0.04)',
        text: '#111827',
        textSecondary: '#6b7280',
        textMuted: '#9ca3af',
        textDim: '#808080',
        chrome: '#e3e6eb',
        tabBarBg: '#dee1e6',
        tabBarBorder: '#c8ccd4',
        tabActiveBg: '#ffffff',
        tabActiveBorder: '#007acc',
        tabActiveText: '#1f2937',
        tabInactiveText: '#6b7280',
        tabHoverBg: 'rgba(0, 0, 0, 0.08)',
        tabCloseHover: 'rgba(0, 0, 0, 0.08)',
        shadow: '0 8px 24px rgba(15, 23, 42, 0.1)',
        menuShadow:
            '0 1px 2px rgba(15, 23, 42, 0.04), 0 4px 12px rgba(15, 23, 42, 0.06), 0 16px 40px rgba(15, 23, 42, 0.1)',
    }

    function withAlpha(hex, alpha) {
        var value = hex.replace('#', '')
        if (value.length === 3) {
            value = value
                .split('')
                .map(function (c) {
                    return c + c
                })
                .join('')
        }
        var r = parseInt(value.slice(0, 2), 16)
        var g = parseInt(value.slice(2, 4), 16)
        var b = parseInt(value.slice(4, 6), 16)
        return 'rgba(' + r + ', ' + g + ', ' + b + ', ' + alpha + ')'
    }

    function readAppearance(parsed) {
        if (parsed.appearance === 'light' || parsed.appearance === 'dark' || parsed.appearance === 'system') {
            return parsed.appearance
        }
        if (parsed.mode === 'dark') return 'dark'
        return 'light'
    }

    function readUiSkin(value) {
        return value === 'ide' || value === 'classic' ? value : 'classic'
    }

    function readPrefs() {
        try {
            var raw = localStorage.getItem(THEME_KEY)
            if (raw) {
                var parsed = JSON.parse(raw)
                return {
                    appearance: readAppearance(parsed),
                    background: parsed.background || 'default',
                    primary: parsed.primary || 'violet',
                    uiSkin: readUiSkin(parsed.uiSkin),
                }
            }
            var configRaw = localStorage.getItem(CONFIG_KEY)
            if (configRaw) {
                var config = JSON.parse(configRaw)
                if (config.theme) {
                    return {
                        appearance: readAppearance(config.theme),
                        background: config.theme.background || 'default',
                        primary: config.theme.primary || 'violet',
                        uiSkin: readUiSkin(config.theme.uiSkin),
                    }
                }
            }
        } catch (e) {
            /* fall through */
        }
        return {appearance: 'light', background: 'default', primary: 'violet', uiSkin: 'classic'}
    }

    function resolveMode(appearance) {
        if (appearance === 'system') {
            return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
        }
        return appearance
    }

    function apply(mode, prefs) {
        var root = document.documentElement
        var primary = PRIMARY[prefs.primary] || PRIMARY.violet
        var surfaces =
            mode === 'dark'
                ? BG_DARK[prefs.background] || BG_DARK.default
                : BG_LIGHT[prefs.background] || BG_LIGHT.default
        var ui = mode === 'dark' ? DARK_UI : LIGHT_UI

        var skin = prefs.uiSkin || 'classic'
        root.setAttribute('data-theme', mode)
        root.setAttribute('data-bg-tone', prefs.background)
        root.setAttribute('data-ui-skin', skin)
        root.style.colorScheme = mode

        var chrome = mode === 'dark' ? surfaces.rail : LIGHT_UI.chrome
        var isIde = skin === 'ide'

        var vars = {
            '--dw-primary': primary.primary,
            '--dw-primary-hover': primary.hover,
            '--dw-primary-softer': withAlpha(primary.primary, mode === 'dark' ? 0.08 : 0.06),
            '--dw-primary-mild': withAlpha(primary.primary, mode === 'dark' ? 0.16 : 0.1),
            '--dw-primary-soft': withAlpha(primary.primary, mode === 'dark' ? 0.14 : 0.12),
            '--dw-primary-tint':
                mode === 'dark'
                    ? 'color-mix(in srgb, ' + primary.primary + ' 18%, var(--dw-bg-panel))'
                    : 'color-mix(in srgb, ' + primary.primary + ' 11%, var(--dw-bg))',
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
            '--dw-panel-shadow': isIde ? 'none' : ui.panelShadow,
            '--dw-text': ui.text,
            '--dw-text-secondary': ui.textSecondary,
            '--dw-text-muted': ui.textMuted,
            '--dw-text-dim': ui.textDim,
            '--dw-tool-hover':
                mode === 'dark'
                    ? 'color-mix(in srgb, #fff 7%, transparent)'
                    : 'color-mix(in srgb, var(--dw-text) 6%, transparent)',
            '--dw-tool-active': 'color-mix(in srgb, ' + primary.primary + ' 10%, var(--dw-bg-rail))',
            '--dw-tool-pill-active':
                mode === 'dark'
                    ? DARK_UI.toolPillActive
                    : 'color-mix(in srgb, var(--dw-text) 9%, var(--dw-bg-hover))',
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

        for (var name in vars) {
            if (Object.prototype.hasOwnProperty.call(vars, name)) {
                root.style.setProperty(name, vars[name])
            }
        }
    }

    try {
        var prefs = readPrefs()
        apply(resolveMode(prefs.appearance), prefs)
    } catch (e) {
        document.documentElement.setAttribute('data-theme', 'light')
    }
})()
