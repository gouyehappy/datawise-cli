import {defineStore} from 'pinia'
import {ref} from 'vue'
import {
    checkForUpdates,
    persistUpdatePreferences,
    readStoredUpdatePreferences,
    type UpdateCheckResult,
    type UpdatePreferences,
} from '@/features/settings/services/about-settings.service'

export const useUpdateSettingsStore = defineStore('update-settings', () => {
    const preferences = ref<UpdatePreferences>(readStoredUpdatePreferences())
    const checking = ref(false)
    const lastCheck = ref<UpdateCheckResult | null>(null)

    function patchPreferences(patch: Partial<UpdatePreferences>) {
        preferences.value = {...preferences.value, ...patch}
        persistUpdatePreferences(preferences.value)
    }

    async function runUpdateCheck() {
        checking.value = true
        try {
            lastCheck.value = await checkForUpdates()
            return lastCheck.value
        } finally {
            checking.value = false
        }
    }

    return {
        preferences,
        checking,
        lastCheck,
        patchPreferences,
        runUpdateCheck,
    }
})
