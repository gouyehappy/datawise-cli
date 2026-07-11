import {useAuthStore} from '@/features/auth/stores/auth-store'
import {
    registerUnauthorizedRecoveryHandler,
    unblockApiSession,
} from '@/shared/api/http/session-guard'

let recoveryPromise: Promise<void> | null = null

async function runUnauthorizedRecovery(): Promise<void> {
    const auth = useAuthStore()
    try {
        await auth.handleUnauthorizedAccess()
    } finally {
        unblockApiSession()
    }
}

export function installUnauthorizedSessionRecovery(): void {
    registerUnauthorizedRecoveryHandler(() => {
        if (!recoveryPromise) {
            recoveryPromise = runUnauthorizedRecovery().finally(() => {
                recoveryPromise = null
            })
        }
        void recoveryPromise
    })
}
