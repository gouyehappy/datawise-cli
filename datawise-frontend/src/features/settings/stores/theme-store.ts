import {defineStore} from 'pinia'
import {computed, ref} from 'vue'
import type {
    BackgroundTone,
    PrimaryTone,
    ThemeAppearance,
    ThemeMode,
    ThemePreferences
} from '@/features/settings/constants/theme-presets'
import {resolveThemeMode} from '@/features/settings/constants/theme-presets'
import {
    applyThemePreferences,
    getSystemPrefersDark,
    persistThemePreferences,
    readThemePreferencesOnBoot,
    watchSystemTheme,
} from '@/features/settings/services/theme.service'

/** 主题外观与配色偏好 */
export const useThemeStore = defineStore('theme', () => {
    const storedTheme = readThemePreferencesOnBoot()

    const appearance = ref<ThemeAppearance>(storedTheme.appearance)
    const backgroundTone = ref<BackgroundTone>(storedTheme.background)
    const primaryTone = ref<PrimaryTone>(storedTheme.primary)
    const systemPrefersDark = ref(getSystemPrefersDark())

    const resolvedMode = computed<ThemeMode>(() =>
        resolveThemeMode(appearance.value, systemPrefersDark.value),
    )

    function syncPreferences() {
        const prefs = {
            appearance: appearance.value,
            background: backgroundTone.value,
            primary: primaryTone.value,
        }
        persistThemePreferences(prefs)
        applyThemePreferences(prefs, resolvedMode.value)
    }

    syncPreferences()
    watchSystemTheme(() => {
        systemPrefersDark.value = getSystemPrefersDark()
        if (appearance.value === 'system') syncPreferences()
    })

    function setAppearance(value: ThemeAppearance) {
        appearance.value = value
        syncPreferences()
    }

    function setMode(mode: ThemeMode) {
        setAppearance(mode)
    }

    function setBackgroundTone(tone: BackgroundTone) {
        backgroundTone.value = tone
        syncPreferences()
    }

    function setPrimaryTone(tone: PrimaryTone) {
        primaryTone.value = tone
        syncPreferences()
    }

    function toggleMode() {
        setAppearance(resolvedMode.value === 'light' ? 'dark' : 'light')
    }

    function importPreferences(prefs: ThemePreferences) {
        appearance.value = prefs.appearance
        backgroundTone.value = prefs.background
        primaryTone.value = prefs.primary
        syncPreferences()
    }

    return {
        appearance,
        backgroundTone,
        primaryTone,
        resolvedMode,
        setAppearance,
        setMode,
        setBackgroundTone,
        setPrimaryTone,
        toggleMode,
        importPreferences,
    }
})
