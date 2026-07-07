import {onMounted, onUnmounted, watch} from 'vue'
import {storeToRefs} from 'pinia'
import {useOnboardingStore} from '@/features/onboarding/stores/onboarding-store'
import {useExplorerStore} from '@/features/explorer/stores/explorer'

export function useOnboardingGuide() {
    const store = useOnboardingStore()
    const explorer = useExplorerStore()
    const {open, preset} = storeToRefs(store)
    let firstInsightTimer: ReturnType<typeof setTimeout> | null = null

    const clearFirstInsightTimer = () => {
        if (firstInsightTimer) {
            clearTimeout(firstInsightTimer)
            firstInsightTimer = null
        }
    }

    onMounted(() => {
        store.tryAutoOpenOnBoot()
        watch(
            () => explorer.connectionCount,
            (count, prev = 0) => {
                if (count <= 0 || prev > 0) return
                if (store.isFirstInsightGuideCompleted()) return
                clearFirstInsightTimer()
                firstInsightTimer = setTimeout(() => {
                    if (!store.open) {
                        store.showGuide('first-insight')
                    }
                    markFirstInsightHandled()
                }, 30000)
            },
            {immediate: true},
        )
    })

    onUnmounted(() => {
        clearFirstInsightTimer()
    })

    function markFirstInsightHandled() {
        clearFirstInsightTimer()
    }

    return {
        open,
        preset,
        showGuide: store.showGuide,
        finishGuide: store.finishGuide,
        skipGuide: store.skipGuide,
        markFirstInsightHandled,
    }
}
