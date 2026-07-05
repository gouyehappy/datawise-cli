import type {TeamSummary} from '@/core/types'
import {canManageTeam, isTeamViewer} from '@/features/team/services/team-role.service'

export type ConnectionAccessLevel = 'readonly' | 'readwrite' | 'ddl'

const WRITE_PATTERN =
    /\b(INSERT|UPDATE|DELETE|DROP|ALTER|CREATE|TRUNCATE|REPLACE|MERGE|GRANT|REVOKE|CALL|EXEC|BEGIN|COMMIT|ROLLBACK|START\s+TRANSACTION)\b/i

const DDL_PATTERN = /\b(CREATE|ALTER|DROP|TRUNCATE|GRANT|REVOKE)\b/i

const ACCESS_ORDER: Record<ConnectionAccessLevel, number> = {
    readonly: 0,
    readwrite: 1,
    ddl: 2,
}

export function normalizeStoredAccess(value: string | undefined): ConnectionAccessLevel {
    if (!value?.trim()) return 'ddl'
    switch (value.trim().toLowerCase()) {
        case 'read':
        case 'readonly':
            return 'readonly'
        case 'readwrite':
        case 'dml':
            return 'readwrite'
        case 'write':
        case 'ddl':
            return 'ddl'
        default:
            return 'ddl'
    }
}

export function requiresWriteAccess(sql: string): boolean {
    const stripped = stripSqlComments(sql).trim()
    if (!stripped) return false
    if (WRITE_PATTERN.test(stripped)) return true
    const upper = stripped.toUpperCase()
    return !upper.startsWith('SELECT')
        && !upper.startsWith('WITH')
        && !upper.startsWith('SHOW')
        && !upper.startsWith('DESCRIBE')
        && !upper.startsWith('DESC')
        && !upper.startsWith('EXPLAIN')
        && !upper.startsWith('USE ')
}

export function requiresDdlAccess(sql: string): boolean {
    const stripped = stripSqlComments(sql).trim()
    if (!stripped) return false
    return DDL_PATTERN.test(stripped)
}

function stripSqlComments(sql: string): string {
    const noBlock = sql.replace(/\/\*[\s\S]*?\*\//g, ' ')
    return noBlock
        .split('\n')
        .map((line) => {
            const idx = line.indexOf('--')
            return idx >= 0 ? line.slice(0, idx) : line
        })
        .join('\n')
}

export function resolveConnectionAccess(
    connectionId: string | undefined,
    teams: TeamSummary[],
): ConnectionAccessLevel {
    if (!connectionId?.trim()) return 'ddl'

    let effective: ConnectionAccessLevel | null = null
    for (const team of teams) {
        const sharedIds = team.sharedConnectionIds ?? []
        if (!sharedIds.includes(connectionId)) continue

        const role = team.role
        let level: ConnectionAccessLevel
        if (isTeamViewer(role)) {
            level = 'readonly'
        } else if (canManageTeam(role)) {
            level = 'ddl'
        } else {
            level = normalizeStoredAccess(team.sharedConnectionAccess?.[connectionId])
        }
        effective = effective == null ? level : restrictAccess(effective, level)
    }

    return effective ?? 'ddl'
}

export function canDmlConnection(
    connectionId: string | undefined,
    teams: TeamSummary[],
): boolean {
    return resolveConnectionAccess(connectionId, teams) !== 'readonly'
}

export function canDdlConnection(
    connectionId: string | undefined,
    teams: TeamSummary[],
): boolean {
    return resolveConnectionAccess(connectionId, teams) === 'ddl'
}

/** @deprecated use canDdlConnection */
export function canWriteConnection(
    connectionId: string | undefined,
    teams: TeamSummary[],
): boolean {
    return canDdlConnection(connectionId, teams)
}

function restrictAccess(current: ConnectionAccessLevel, next: ConnectionAccessLevel): ConnectionAccessLevel {
    return ACCESS_ORDER[current] <= ACCESS_ORDER[next] ? current : next
}

export function buildConnectionAccessMap(
    connectionIds: string[],
    current: Record<string, ConnectionAccessLevel | 'read' | 'write'> | undefined,
): Record<string, ConnectionAccessLevel> {
    const next: Record<string, ConnectionAccessLevel> = {}
    for (const id of connectionIds) {
        next[id] = normalizeStoredAccess(current?.[id])
    }
    return next
}

export function toStoredConnectionAccess(
    access: Record<string, ConnectionAccessLevel>,
): Record<string, ConnectionAccessLevel> {
    const stored: Record<string, ConnectionAccessLevel> = {}
    for (const [id, level] of Object.entries(access)) {
        if (level === 'readonly' || level === 'readwrite') {
            stored[id] = level
        }
    }
    return stored
}
