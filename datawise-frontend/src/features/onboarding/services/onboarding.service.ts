export const ONBOARDING_COMPLETED_KEY = 'dw-cli-onboarding-completed'

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
