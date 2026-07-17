import type {UiSkin} from '@/core/ui-skin'
import {UI_SKIN_IDS} from '@/core/ui-skin'

export type ThemeMode = 'light' | 'dark'
export type ThemeAppearance = ThemeMode | 'system'
export type BackgroundTone = 'default' | 'warm' | 'cool' | 'slate'
export type PrimaryTone = 'violet' | 'blue' | 'cyan' | 'green' | 'orange' | 'rose'
export type {UiSkin}

export interface ThemePreferences {
    appearance: ThemeAppearance
    background: BackgroundTone
    primary: PrimaryTone
    uiSkin: UiSkin
}

export const THEME_STORAGE_KEY = 'dw-cli-theme-prefs'
/** @deprecated 请用 @/core/ui-skin 的 UI_SKIN_IDS；保留兼容旧 import */
export const UI_SKINS: UiSkin[] = [...UI_SKIN_IDS]

export const DEFAULT_THEME_PREFERENCES: ThemePreferences = {
    appearance: 'light',
    background: 'cool',
    primary: 'blue',
    uiSkin: 'classic',
}

export function resolveThemeMode(appearance: ThemeAppearance, systemPrefersDark = false): ThemeMode {
    if (appearance === 'system') return systemPrefersDark ? 'dark' : 'light'
    return appearance
}

interface BgTokens {
    bg: string
    muted: string
    panel: string
    hover: string
    rail: string
}

interface PrimaryTokens {
    primary: string
    hover: string
}

export const PRIMARY_PRESETS: Record<PrimaryTone, PrimaryTokens> = {
    violet: {primary: '#7c3aed', hover: '#6d28d9'},
    blue: {primary: '#2563eb', hover: '#1d4ed8'},
    cyan: {primary: '#0891b2', hover: '#0e7490'},
    green: {primary: '#16a34a', hover: '#15803d'},
    orange: {primary: '#ea580c', hover: '#c2410c'},
    rose: {primary: '#e11d48', hover: '#be123c'},
}

export const BACKGROUND_PRESETS_LIGHT: Record<BackgroundTone, BgTokens> = {
    default: {
        bg: '#ffffff',
        muted: '#f8f9fb',
        panel: '#fafbfc',
        hover: '#f3f4f6',
        rail: '#f5f6f8',
    },
    warm: {
        bg: '#faf9f7',
        muted: '#f5f3ef',
        panel: '#f7f5f1',
        hover: '#ede9e3',
        rail: '#f0ece6',
    },
    cool: {
        bg: '#f8fafc',
        muted: '#f1f5f9',
        panel: '#f4f7fb',
        hover: '#e8eef5',
        rail: '#eef2f7',
    },
    slate: {
        bg: '#f4f6f8',
        muted: '#eceff3',
        panel: '#f0f2f5',
        hover: '#e2e6eb',
        rail: '#e8ebef',
    },
}

export const BACKGROUND_PRESETS_DARK: Record<BackgroundTone, BgTokens> = {
    default: {
        bg: '#111113',
        muted: '#18181b',
        panel: '#1c1c1f',
        hover: '#27272a',
        rail: '#141416',
    },
    warm: {
        bg: '#141210',
        muted: '#1b1916',
        panel: '#201e1a',
        hover: '#2b2823',
        rail: '#12100e',
    },
    cool: {
        bg: '#0f1419',
        muted: '#151b22',
        panel: '#1a2129',
        hover: '#24303c',
        rail: '#0c1014',
    },
    slate: {
        bg: '#121417',
        muted: '#181c21',
        panel: '#1d2228',
        hover: '#282e36',
        rail: '#0e1013',
    },
}
