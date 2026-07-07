import {reactive, readonly} from 'vue'
import {readDesktopBridge} from '@/features/layout/services/desktop-bridge'

export type BackendStartupPhase =
    | 'idle'
    | 'config'
    | 'spawning'
    | 'warming'
    | 'session'
    | 'sync'
    | 'ready'
    | 'failed'

export interface BackendStartupEvent {
    phase: BackendStartupPhase
    progress: number
}

/** 主进程 JVM health OK 的上限；100% 留给渲染进程会话/配置同步 */
export const DESKTOP_BACKEND_READY_PROGRESS = 78

const MIN_VISIBLE_MS = 1_400
const TICK_MS = 48
const MIN_STEP = 0.35
const MAX_STEP = 2.6

const state = reactive({
    phase: 'idle' as BackendStartupPhase,
    targetProgress: 0,
    displayProgress: 0,
    complete: false,
    startedAt: 0,
})

/** @deprecated 使用 displayProgress */
export const desktopBackendStartup = readonly({
    get phase() {
        return state.phase
    },
    get progress() {
        return Math.round(state.displayProgress)
    },
    get complete() {
        return state.complete
    },
})

export const desktopStartupProgress = readonly(state)

let unsubscribe: (() => void) | undefined
let tickTimer: ReturnType<typeof setInterval> | null = null
let finalizeWaiters: Array<() => void> = []

function stopTicker() {
    if (tickTimer) {
        clearInterval(tickTimer)
        tickTimer = null
    }
}

function ensureTicker() {
    if (tickTimer) return
    if (!state.startedAt) state.startedAt = Date.now()
    tickTimer = setInterval(tickProgress, TICK_MS)
}

function tickProgress() {
    if (state.complete) {
        stopTicker()
        return
    }

    const gap = state.targetProgress - state.displayProgress
    if (gap > 0) {
        const step = Math.min(MAX_STEP, Math.max(MIN_STEP, gap * 0.11))
        state.displayProgress = Math.min(state.targetProgress, state.displayProgress + step)
    }

    if (
        state.targetProgress >= 100
        && state.displayProgress >= 99.5
        && Date.now() - state.startedAt >= MIN_VISIBLE_MS
    ) {
        state.displayProgress = 100
        state.complete = true
        stopTicker()
        const waiters = finalizeWaiters
        finalizeWaiters = []
        waiters.forEach((resolve) => resolve())
    }
}

export function setDesktopStartupTarget(progress: number, phase?: BackendStartupPhase): void {
    const capped = Math.max(0, Math.min(100, progress))
    state.targetProgress = Math.max(state.targetProgress, capped)
    if (phase) state.phase = phase
    ensureTicker()
}

export function initDesktopBackendStartupListener(): void {
    if (unsubscribe) return

    const bridge = readDesktopBridge()
    const backend = bridge?.backend
    if (!backend) return

    void backend.getStartupState?.().then((snapshot) => {
        if (snapshot) applyStartupEvent(normalizeStartupEvent(snapshot))
    })

    unsubscribe = backend.onStartupProgress?.((event) => {
        applyStartupEvent(normalizeStartupEvent(event))
    })
}

function normalizeStartupEvent(event: { phase: string; progress: number }): BackendStartupEvent {
    const phase = event.phase as BackendStartupPhase
    return {phase, progress: event.progress}
}

export function applyStartupEvent(event: BackendStartupEvent): void {
    if (event.phase === 'failed') {
        state.phase = 'failed'
        state.complete = true
        stopTicker()
        return
    }

    let progress = event.progress
    if (event.phase === 'ready') {
        progress = Math.min(progress, DESKTOP_BACKEND_READY_PROGRESS)
    }
    setDesktopStartupTarget(progress, event.phase)
}

export function markDesktopBackendStartupComplete(): void {
    setDesktopStartupTarget(DESKTOP_BACKEND_READY_PROGRESS, 'ready')
}

export function reportDesktopBootstrapSessionProgress(): void {
    setDesktopStartupTarget(86, 'session')
}

export function reportDesktopBootstrapSyncProgress(): void {
    setDesktopStartupTarget(94, 'sync')
}

export function reportDesktopBootstrapHealthPollProgress(elapsedMs: number, timeoutMs: number): void {
    const ratio = 1 - Math.exp(-elapsedMs / Math.max(1, timeoutMs / 3))
    const progress = 48 + Math.round(ratio * 26)
    setDesktopStartupTarget(Math.min(progress, DESKTOP_BACKEND_READY_PROGRESS - 2), 'warming')
}

export async function finalizeDesktopStartup(): Promise<void> {
    setDesktopStartupTarget(100, 'ready')
    if (state.complete) return

    await new Promise<void>((resolve) => {
        finalizeWaiters.push(resolve)
        ensureTicker()
        tickProgress()
    })
}

export function disposeDesktopBackendStartupListener(): void {
    unsubscribe?.()
    unsubscribe = undefined
    stopTicker()
}
