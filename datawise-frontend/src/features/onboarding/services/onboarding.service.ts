export const ONBOARDING_COMPLETED_KEY = 'dw-cli-onboarding-completed'
export const ONBOARDING_FIRST_INSIGHT_COMPLETED_KEY = 'dw-cli-onboarding-first-insight-completed'

export {
    ONBOARDING_STEP_IDS,
    ONBOARDING_TOUR_STEPS,
} from '@/features/onboarding/services/onboarding-tour.config'
export type {
    OnboardingTourContext,
    OnboardingTourPlacement,
    OnboardingTourStep,
} from '@/features/onboarding/services/onboarding-tour.config'

export function isOnboardingCompleted(storage: Storage = localStorage): boolean {
    return storage.getItem(ONBOARDING_COMPLETED_KEY) === '1'
}

export function markOnboardingCompleted(storage: Storage = localStorage): void {
    storage.setItem(ONBOARDING_COMPLETED_KEY, '1')
}

export function clearOnboardingCompleted(storage: Storage = localStorage): void {
    storage.removeItem(ONBOARDING_COMPLETED_KEY)
}

export function shouldShowOnboardingOnBoot(storage: Storage = localStorage): boolean {
    return !isOnboardingCompleted(storage)
}

export function isFirstInsightGuideCompleted(storage: Storage = localStorage): boolean {
    return storage.getItem(ONBOARDING_FIRST_INSIGHT_COMPLETED_KEY) === '1'
}

export function markFirstInsightGuideCompleted(storage: Storage = localStorage): void {
    storage.setItem(ONBOARDING_FIRST_INSIGHT_COMPLETED_KEY, '1')
}
