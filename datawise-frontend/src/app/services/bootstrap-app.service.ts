import {reactive, readonly} from 'vue'
import {useAuthStore} from '@/features/auth/stores/auth-store'
import {useAppConfigStore} from '@/features/layout/stores/app-config-store'
import {useExplorerStore} from '@/features/explorer/stores/explorer'
import {useNotificationStore} from '@/features/layout/stores/notification-store'
import {useShortcutPanelStore} from '@/features/layout/stores/shortcut-panel-store'
import {usePluginStore} from '@/features/plugin/stores/plugin-store'
import {useTeamStore} from '@/features/team/stores/team-store'
import {
    settingsApi,
    type HealthStatus,
} from '@/api'
import {isDesktopApp} from '@/features/layout/services/desktop-chrome'
import {clearSession, SESSION_KEY} from '@/shared/auth/session'

const desktopBoot = isDesktopApp()
const STEP_MIN_MS = desktopBoot ? 0 : 520
const MIN_SPLASH_MS = desktopBoot ? 0 : 5000
const DESKTOP_BACKEND_WAIT_MS = 120_000
const DESKTOP_BACKEND_POLL_MS = 350

export type BootstrapStepId =
    | 'backend'
    | 'session'
    | 'explorer'
    | 'workspace'
    | 'notifications'
    | 'plugins'
    | 'teams'
    | 'finalize'

export type BackendConnectionStatus = 'idle' | 'checking' | 'connected' | 'offline'

const STEP_ORDER: BootstrapStepId[] = [
    'backend',
    'session',
    'explorer',
    'workspace',
    'notifications',
    'plugins',
    'teams',
    'finalize',
]

export interface BootstrapStepState {
    id: BootstrapStepId
    done: boolean
    active: boolean
}

function createStepStates(): BootstrapStepState[] {
    return STEP_ORDER.map((id) => ({id, done: false, active: false}))
}

const state = reactive({
    progress: 0,
    currentStep: 'backend' as BootstrapStepId,
    steps: createStepStates(),
    backend: {
        status: 'idle' as BackendConnectionStatus,
        endpoint: settingsApi.resolveBackendEndpointLabel(),
        latencyMs: null as number | null,
        serverVersion: null as string | null,
    },
})

export const bootstrapProgress = readonly(state)

function delay(ms: number) {
    return new Promise<void>((resolve) => setTimeout(resolve, ms))
}

function safeLoad(task: () => Promise<unknown>) {
    return task().catch(() => undefined)
}

function stepIndex(id: BootstrapStepId) {
    return STEP_ORDER.indexOf(id)
}

function applyBackendResult(result: HealthStatus | null, endpoint: string) {
    state.backend.endpoint = endpoint
    if (!result) {
        state.backend.status = 'offline'
        state.backend.latencyMs = null
        state.backend.serverVersion = null
        return
    }
    state.backend.latencyMs = result.latencyMs
    state.backend.serverVersion = result.serverVersion ?? null
    state.backend.status = result.ok ? 'connected' : 'offline'
}

function syncStepVisual(id: BootstrapStepId, progress: number) {
    state.currentStep = id
    state.progress = progress
    const idx = stepIndex(id)
    state.steps.forEach((step, i) => {
        step.done = i < idx
        step.active = i === idx
    })
}

function markStepDone(id: BootstrapStepId) {
    const idx = stepIndex(id)
    const nextProgress = Math.round(((idx + 1) / STEP_ORDER.length) * 100)
    state.progress = Math.min(nextProgress, 100)
    state.steps.forEach((step, i) => {
        step.done = i <= idx
        step.active = false
    })
}

async function runStep(id: BootstrapStepId, task: () => Promise<unknown>) {
    const idx = stepIndex(id)
    syncStepVisual(id, Math.round((idx / STEP_ORDER.length) * 100))

    const started = Date.now()
    await task()
    const elapsed = Date.now() - started
    if (elapsed < STEP_MIN_MS) await delay(STEP_MIN_MS - elapsed)

    markStepDone(id)
}

function isBackendSessionId(sessionId: string | null | undefined): boolean {
    return Boolean(sessionId?.startsWith('session-'))
}

/** 桌面版：等待内嵌后端就绪，避免启动页误报离线 */
async function waitForDesktopBackendHealth() {
    state.backend.status = 'checking'
    state.backend.endpoint = settingsApi.resolveBackendEndpointLabel()

    const deadline = Date.now() + DESKTOP_BACKEND_WAIT_MS
    while (Date.now() < deadline) {
        const snapshot = await settingsApi.pingHealth()
        if (snapshot.result?.ok) {
            applyBackendResult(snapshot.result, snapshot.endpoint)
            return snapshot
        }
        await delay(DESKTOP_BACKEND_POLL_MS)
    }

    const last = await settingsApi.pingHealth()
    applyBackendResult(last.result, last.endpoint)
    return last
}

/** 桌面版：恢复已有登录；无会话时再游客登录 */
async function bootstrapDesktopSession(auth: ReturnType<typeof useAuthStore>, backendConnected: boolean) {
    if (!backendConnected) {
        auth.bootstrap()
        return
    }

    const storedSessionId = localStorage.getItem(SESSION_KEY)
    const hadBackendSession = Boolean(storedSessionId && isBackendSessionId(storedSessionId))

    if (hadBackendSession) {
        try {
            await auth.bootstrapAsync(true)
            return
        } catch {
            clearSession()
        }
    } else if (storedSessionId) {
        clearSession()
    }

    try {
        await auth.loginAsGuest()
    } catch {
        auth.bootstrap()
    }
}

/** 应用启动：按步骤初始化，并驱动加载页进度展示 */
export async function bootstrapApp(): Promise<void> {
    const started = Date.now()
    const auth = useAuthStore()
    const explorer = useExplorerStore()

    await runStep('backend', async () => {
        if (desktopBoot) {
            const snapshot = await waitForDesktopBackendHealth()
            if (snapshot.result?.ok) {
                await safeLoad(() => useAppConfigStore().syncFromServer())
            }
            return
        }

        state.backend.status = 'checking'
        state.backend.endpoint = settingsApi.resolveBackendEndpointLabel()
        const snapshot = await settingsApi.pingHealth()
        applyBackendResult(snapshot.result, snapshot.endpoint)
        if (snapshot.result?.ok) {
            await safeLoad(() => useAppConfigStore().syncFromServer())
        }
    })

    await runStep('session', async () => {
        const backendConnected = state.backend.status === 'connected'
        if (desktopBoot) {
            await bootstrapDesktopSession(auth, backendConnected)
            return
        }
        try {
            await auth.bootstrapAsync(backendConnected)
        } catch {
            auth.bootstrap()
        }
    })

    await runStep('explorer', () => safeLoad(() => explorer.loadTree()))
    await runStep('workspace', () => safeLoad(() => useShortcutPanelStore().load()))
    await runStep('notifications', () => safeLoad(() => useNotificationStore().load()))
    await runStep('plugins', () => safeLoad(() => usePluginStore().load()))
    await runStep('teams', () => safeLoad(() => useTeamStore().load()))

    await runStep('finalize', async () => {
        syncStepVisual('finalize', 96)
        if (!desktopBoot) await delay(640)
    })

    state.progress = 100
    state.steps.forEach((step) => {
        step.done = true
        step.active = false
    })

    const remain = MIN_SPLASH_MS - (Date.now() - started)
    if (remain > 0) await delay(remain)
}
