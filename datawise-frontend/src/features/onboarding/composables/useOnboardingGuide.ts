import {onMounted} from 'vue'
import {storeToRefs} from 'pinia'
import {useOnboardingStore} from '@/features/onboarding/stores/onboarding-store'

export function useOnboardingGuide() {
    const store = useOnboardingStore()
    const {open} = storeToRefs(store)

    onMounted(() => {
        store.tryAutoOpenOnBoot()
    })

    return {
        open,
        showGuide: store.showGuide,
        finishGuide: store.finishGuide,
        skipGuide: store.skipGuide,
    }
}
