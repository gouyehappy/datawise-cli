import {useEditorSettingsStore} from '@/features/settings/stores/editor-settings'

/** 客户端配置的 SQL / 表数据最大返回行数；0 表示不限制 */
export function resolveClientMaxResultRows(): number {
    return useEditorSettingsStore().settings.maxResultRows
}

const DEFAULT_SQL_PAGE_SIZE = 500

/** 游标分页每页行数：有上限时用设置值，否则默认 500 */
export function resolveSqlPageSize(): number {
    const max = resolveClientMaxResultRows()
    if (max <= 0) return DEFAULT_SQL_PAGE_SIZE
    return max
}
