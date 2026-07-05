import {
    GRID_PAGE_SIZE_OPTIONS,
    type GridPageSizeValue,
} from '@/features/settings/constants/editor-presets'
import {useEditorSettingsStore} from '@/features/settings/stores/editor-settings'

/** 从候选条目中取数值最小的分页大小 */
export function minGridPageSizeOption(options: readonly string[]): string {
    const sorted = [...options].map(String).sort((left, right) => Number(left) - Number(right))
    return sorted[0] ?? String(GRID_PAGE_SIZE_OPTIONS[0])
}

/** 读取设置中的默认分页；未配置或不在候选列表时回退为最小值 */
export function resolveGridPageSizeOption(
    options: readonly string[] = GRID_PAGE_SIZE_OPTIONS.map(String),
): string {
    const sorted = [...options].map(String).sort((left, right) => Number(left) - Number(right))
    const min = minGridPageSizeOption(sorted)
    const configured = useEditorSettingsStore().settings.defaultGridPageSize
    if (!configured || configured <= 0) return min
    const match = sorted.find((option) => Number(option) === configured)
    return match ?? min
}

export function isGridPageSizeValue(value: number): value is GridPageSizeValue {
    return GRID_PAGE_SIZE_OPTIONS.some((option) => option === value)
}
