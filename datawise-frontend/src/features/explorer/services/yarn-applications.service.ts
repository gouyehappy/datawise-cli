export interface YarnClusterInfo {
    id: string | null
    state: string | null
    haState: string | null
    resourceManagerVersion: string | null
    hadoopVersion: string | null
}

export interface YarnAppSummary {
    id: string | null
    name: string | null
    user: string | null
    queue: string | null
    state: string | null
    finalStatus: string | null
    applicationType: string | null
    progress: number
    startedTime: number
    finishedTime: number
    elapsedTime: number
    allocatedMb: number
    allocatedVCores: number
    runningContainers: number
    trackingUrl: string | null
}

export interface YarnAppDetail extends YarnAppSummary {
    amHostHttpAddress: string | null
    diagnostics: string | null
}

export interface YarnAppsResult {
    apps: YarnAppSummary[]
    totalCount: number
}

export interface YarnNodeSummary {
    id: string | null
    state: string | null
    nodeHealthStatus: string | null
    lastHealthUpdate: number
    numContainers: number
    usedMemoryMb: number
    availMemoryMb: number
    usedVirtualCores: number
    availableVirtualCores: number
}

export interface YarnNodesResult {
    nodes: YarnNodeSummary[]
    totalCount: number
}

export interface YarnQueueSummary {
    name: string | null
    state: string | null
    capacity: number
    usedCapacity: number
    numApplications: number
}

export interface YarnQueuesResult {
    queues: YarnQueueSummary[]
    schedulerType: string | null
}

export interface YarnMutationResult {
    success: boolean
    message: string | null
    state: string | null
}

export function isYarnAppKillable(state: string | null | undefined): boolean {
    const normalized = (state ?? '').toUpperCase()
    return normalized === 'RUNNING'
        || normalized === 'ACCEPTED'
        || normalized === 'SUBMITTED'
        || normalized === 'NEW'
        || normalized === 'NEW_SAVING'
}

export const YARN_APP_STATE_OPTIONS = [
    'RUNNING',
    'ACCEPTED',
    'FINISHED',
    'FAILED',
    'KILLED',
] as const

/** YARN REST `states` query — comma-separated uppercase values; empty = no filter. */
export function formatYarnStateFilter(states: readonly string[]): string | undefined {
    const normalized = states
        .map((state) => state.trim().toUpperCase())
        .filter(Boolean)
    return normalized.length ? normalized.join(',') : undefined
}

export function formatYarnTimestamp(ms: number): string {
    if (!ms || ms <= 0) return '—'
    return new Date(ms).toLocaleString()
}

export function formatYarnDuration(ms: number): string {
    if (!ms || ms <= 0) return '—'
    const totalSeconds = Math.floor(ms / 1000)
    const hours = Math.floor(totalSeconds / 3600)
    const minutes = Math.floor((totalSeconds % 3600) / 60)
    const seconds = totalSeconds % 60
    if (hours > 0) return `${hours}h ${minutes}m`
    if (minutes > 0) return `${minutes}m ${seconds}s`
    return `${seconds}s`
}

export function formatYarnMemory(mb: number): string {
    if (!mb || mb <= 0) return '—'
    if (mb >= 1024) return `${(mb / 1024).toFixed(1)} GB`
    return `${mb} MB`
}
