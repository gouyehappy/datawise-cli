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

/** 等待进行中的 401 恢复（游客登录 / 登录框）；无则立刻返回 */
export function awaitUnauthorizedRecovery(): Promise<void> {
    return recoveryPromise ?? Promise.resolve()
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
