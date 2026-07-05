import {defineStore} from 'pinia'
import {ref} from 'vue'
import type {EditorSettings} from '@/features/settings/constants/editor-presets'
import {
    applyEditorTheme,
    persistEditorSettings,
    readStoredEditorSettings,
} from '@/features/settings/services/editor-settings.service'

export const useEditorSettingsStore = defineStore('editorSettings', () => {
    const settings = ref<EditorSettings>(readStoredEditorSettings())

    function syncEditorSettings() {
        persistEditorSettings(settings.value)
        applyEditorTheme(settings.value.theme)
    }

    syncEditorSettings()

    function patchSettings(patch: Partial<EditorSettings>) {
        settings.value = {...settings.value, ...patch}
        syncEditorSettings()
    }

    return {
        settings,
        patchSettings,
        syncEditorSettings,
    }
})
