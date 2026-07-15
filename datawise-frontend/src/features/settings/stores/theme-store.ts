import {defineStore} from 'pinia'
import {computed, ref} from 'vue'
import type {
    BackgroundTone,
    PrimaryTone,
    ThemeAppearance,
    ThemeMode,
    ThemePreferences,
} from '@/features/settings/constants/theme-presets'
import type {UiSkin} from '@/core/ui-skin'
import {resolveThemeMode} from '@/features/settings/constants/theme-presets'
import {
    applyThemePreferences,
    getSystemPrefersDark,
    normalizeThemePreferences,
    persistThemePreferences,
    readThemePreferencesOnBoot,
    watchSystemTheme,
} from '@/features/settings/services/theme.service'

/** 主题外观、配色与 UI 款式偏好 */
export const useThemeStore = defineStore('theme', () => {
    const storedTheme = readThemePreferencesOnBoot()

    const appearance = ref<ThemeAppearance>(storedTheme.appearance)
    const backgroundTone = ref<BackgroundTone>(storedTheme.background)
    const primaryTone = ref<PrimaryTone>(storedTheme.primary)
    const uiSkin = ref<UiSkin>(storedTheme.uiSkin)
    const systemPrefersDark = ref(getSystemPrefersDark())

    const resolvedMode = computed<ThemeMode>(() =>
        resolveThemeMode(appearance.value, systemPrefersDark.value),
    )

    function currentPreferences(): ThemePreferences {
        return {
            appearance: appearance.value,
            background: backgroundTone.value,
            primary: primaryTone.value,
            uiSkin: uiSkin.value,
        }
    }

    function syncPreferences() {
        const prefs = currentPreferences()
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

    function setUiSkin(skin: UiSkin) {
        uiSkin.value = skin
        syncPreferences()
    }

    function toggleMode() {
        setAppearance(resolvedMode.value === 'light' ? 'dark' : 'light')
    }

    function importPreferences(prefs: ThemePreferences | Partial<ThemePreferences>) {
        const next = normalizeThemePreferences(prefs)
        appearance.value = next.appearance
        backgroundTone.value = next.background
        primaryTone.value = next.primary
        uiSkin.value = next.uiSkin
        syncPreferences()
    }

    return {
        appearance,
        backgroundTone,
        primaryTone,
        uiSkin,
        resolvedMode,
        setAppearance,
        setMode,
        setBackgroundTone,
        setPrimaryTone,
        setUiSkin,
        toggleMode,
        importPreferences,
    }
})
