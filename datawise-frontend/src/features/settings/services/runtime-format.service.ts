/** Pure helpers for runtime settings UI (no API imports). */

export function formatRuntimeBytes(bytes: number): string {
    if (!Number.isFinite(bytes) || bytes <= 0) return '0 B'
    const units = ['B', 'KB', 'MB', 'GB']
    let value = bytes
    let unit = 0
    while (value >= 1024 && unit < units.length - 1) {
        value /= 1024
        unit += 1
    }
    if (unit === 0 || Number.isInteger(value) || value >= 10) {
        return `${Math.round(value)} ${units[unit]}`
    }
    return `${value.toFixed(1)} ${units[unit]}`
}

/** Core tier connector ids matching desktop packaging profile. */
export const CORE_CONNECTOR_IDS = ['mysql', 'postgresql', 'sqlite3', 'h2'] as const
