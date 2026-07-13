import {useAuthStore} from '@/features/auth/stores/auth-store'
import {useLayoutStore} from '@/features/layout/stores/layout'
import {useOnboardingStore} from '@/features/onboarding/stores/onboarding-store'

export function useProfileMenuActions(onClose?: () => void) {
    const layout = useLayoutStore()
    const auth = useAuthStore()
    const onboarding = useOnboardingStore()

    function closeAndRun(action: () => void) {
        action()
        onClose?.()
    }

    return {
        openSettings: () => closeAndRun(() => layout.openSettingsModule('basic')),
        openProfile: () => closeAndRun(() => layout.openSettingsModule('profile')),
        openOnboardingGuide: () => closeAndRun(() => onboarding.showGuide()),
        openTeam: () => closeAndRun(() => layout.openTeamModule()),
        openAccountLogin: () => closeAndRun(() => auth.openLoginDialog()),
        signOut: () => closeAndRun(() => void auth.signOut()),
    }
}
