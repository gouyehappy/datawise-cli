import {describe, it} from 'node:test'
import assert from 'node:assert/strict'
import {
    clearOnboardingCompleted,
    isOnboardingCompleted,
    markOnboardingCompleted,
    shouldShowOnboardingOnBoot,
} from '../../features/onboarding/services/onboarding.service.ts'

describe('onboarding.service', () => {
    it('tracks completion in storage', () => {
        const storage = new Map<string, string>()
        const mockStorage = {
            getItem: (key: string) => storage.get(key) ?? null,
            setItem: (key: string, value: string) => {
                storage.set(key, value)
            },
            removeItem: (key: string) => {
                storage.delete(key)
            },
        } as Storage

        assert.equal(shouldShowOnboardingOnBoot(mockStorage), true)
        markOnboardingCompleted(mockStorage)
        assert.equal(isOnboardingCompleted(mockStorage), true)
        assert.equal(shouldShowOnboardingOnBoot(mockStorage), false)
        clearOnboardingCompleted(mockStorage)
        assert.equal(isOnboardingCompleted(mockStorage), false)
    })
})
