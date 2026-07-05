import type {DeepLinkOpenPayload} from './deep-link.types'

export const DEEP_LINK_SCHEME = 'datawise'
export const DEEP_LINK_HOST = 'open'

function resolveDeepLinkHost(url: URL): string {
    if (url.hostname) return url.hostname
    return url.pathname.replace(/^\/+/, '').split('/')[0] ?? ''
}

export function parseDeepLinkUrl(raw: string): DeepLinkOpenPayload | null {
    const trimmed = raw.trim()
    if (!trimmed) return null

    try {
        const url = new URL(trimmed)
        if (url.protocol !== `${DEEP_LINK_SCHEME}:`) return null
        if (resolveDeepLinkHost(url) !== DEEP_LINK_HOST) return null

        const connectionId = url.searchParams.get('connectionId')?.trim() || undefined
        const database = url.searchParams.get('database')?.trim() || undefined
        const sql = url.searchParams.get('sql')?.trim() || undefined

        if (!connectionId && !database && !sql) return null

        return {connectionId, database, sql}
    } catch {
        return null
    }
}

export function buildDeepLinkUrl(params: DeepLinkOpenPayload): string {
    const url = new URL(`${DEEP_LINK_SCHEME}://${DEEP_LINK_HOST}`)
    if (params.connectionId) url.searchParams.set('connectionId', params.connectionId)
    if (params.database) url.searchParams.set('database', params.database)
    if (params.sql) url.searchParams.set('sql', params.sql)
    return url.toString()
}

export function buildDeepLinkExample(): string {
    return buildDeepLinkUrl({
        connectionId: 'your-connection-id',
        database: 'mydb',
        sql: 'SELECT 1',
    })
}

export function extractDeepLinkFromArgv(argv: string[]): string | null {
    return argv.find((arg) => arg.startsWith(`${DEEP_LINK_SCHEME}://`)) ?? null
}
