import {useEditorSettingsStore} from '@/features/settings/stores/editor-settings'
import {resolveEffectiveMaxResultRows} from '@/features/settings/services/production-perf-mode.policy'
import {CURSOR_LOADED_ROWS_MAX} from '@/features/workspace/constants/query-result-limits'

/** 客户端配置的 SQL / 表数据最大返回行数；0 表示不限制 */
export function resolveClientMaxResultRows(productionPerfActive = false): number {
    const base = useEditorSettingsStore().settings.maxResultRows
    return resolveEffectiveMaxResultRows(base, productionPerfActive)
}

const DEFAULT_SQL_PAGE_SIZE = 500

/** 游标分页每页行数：有上限时用设置值，否则默认 500 */
export function resolveSqlPageSize(productionPerfActive = false): number {
    const max = resolveClientMaxResultRows(productionPerfActive)
    if (max <= 0) return DEFAULT_SQL_PAGE_SIZE
    return max
}

export {resolveEffectiveCursorLoadedRowsMax as resolveCursorLoadedRowsMax} from '@/features/settings/services/production-perf-mode.policy'
