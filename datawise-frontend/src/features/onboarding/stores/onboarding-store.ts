import {defineStore} from 'pinia'
import {ref} from 'vue'
import {
    isFirstInsightGuideCompleted,
    markOnboardingCompleted,
    markFirstInsightGuideCompleted,
    shouldShowOnboardingOnBoot,
} from '@/features/onboarding/services/onboarding.service'
import type {OnboardingTourPreset} from '@/features/onboarding/services/onboarding-tour.config'

export const useOnboardingStore = defineStore('onboarding', () => {
    const open = ref(false)
    const preset = ref<OnboardingTourPreset>('default')

    function showGuide(nextPreset: OnboardingTourPreset = 'default') {
        preset.value = nextPreset
        open.value = true
    }

    function finishGuide() {
        markOnboardingCompleted()
        if (preset.value === 'first-insight') {
            markFirstInsightGuideCompleted()
        }
        open.value = false
        preset.value = 'default'
    }

    function skipGuide() {
        if (preset.value === 'first-insight') {
            markFirstInsightGuideCompleted()
            open.value = false
            preset.value = 'default'
            return
        }
        finishGuide()
    }

    function tryAutoOpenOnBoot() {
        if (shouldShowOnboardingOnBoot()) {
            open.value = true
        }
    }

    return {
        open,
        preset,
        showGuide,
        finishGuide,
        skipGuide,
        tryAutoOpenOnBoot,
        isFirstInsightGuideCompleted,
    }
})
