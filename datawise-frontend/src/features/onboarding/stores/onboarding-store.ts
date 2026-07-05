import {defineStore} from 'pinia'
import {ref} from 'vue'
import {
    markOnboardingCompleted,
    shouldShowOnboardingOnBoot,
} from '@/features/onboarding/services/onboarding.service'

export const useOnboardingStore = defineStore('onboarding', () => {
    const open = ref(false)

    function showGuide() {
        open.value = true
    }

    function finishGuide() {
        markOnboardingCompleted()
        open.value = false
    }

    function skipGuide() {
        finishGuide()
    }

    function tryAutoOpenOnBoot() {
        if (shouldShowOnboardingOnBoot()) {
            open.value = true
        }
    }

    return {
        open,
        showGuide,
        finishGuide,
        skipGuide,
        tryAutoOpenOnBoot,
    }
})
