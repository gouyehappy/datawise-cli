import {getPluginBundledSharedLayer} from '@sql-editor/config/snippets/builtin'
import {resolveSqlEditorShortcutsLayers, snippetIdentityKey} from '@sql-editor/config/snippets/merge'
import {shallowRef} from 'vue'
import type {
    SqlCompletionSlot,
    SqlEditorShortcutsLayer,
    SqlEditorShortcutsSettings,
    SqlSnippet,
    SqlSnippetConfig,
} from '@sql-editor/types'

let activeSettings: SqlEditorShortcutsSettings = resolveSqlEditorShortcutsLayers({
    pluginShared: getPluginBundledSharedLayer(),
})

let globalSnippets: SqlSnippet[] = []
let slotSnippets: Partial<Record<SqlCompletionSlot, SqlSnippet[]>> = {}

/** 设置变更时递增，供 Monaco / 补全等重配置刷新 */
export const sqlEditorSettingsVersion = shallowRef(0)

/** 仅提示条显隐变更时递增，避免触发 Monaco 全量重配置 */
export const sqlEditorHintBarVersion = shallowRef(0)

function bumpSettingsVersion() {
    sqlEditorSettingsVersion.value += 1
}

function snippetCacheKey(snippets: readonly SqlSnippetConfig[]): string {
    return snippets
        .filter((s) => s.enabled)
        .map((s) => `${s.id}\0${snippetIdentityKey(s)}`)
        .join('\n')
}

function toRuntimeSnippet(item: { label: string; insertText: string; detail?: string }): SqlSnippet {
    return {
        label: item.label,
        insertText: item.insertText,
        detail: item.detail,
    }
}

function rebuildSnippetCache(): void {
    const enabled = activeSettings.snippets.filter((s) => s.enabled)

    globalSnippets = enabled.filter((s) => s.slots.length === 0).map(toRuntimeSnippet)

    const nextSlots: Partial<Record<SqlCompletionSlot, SqlSnippet[]>> = {}
    for (const item of enabled) {
        if (item.slots.length === 0) continue
        const snippet = toRuntimeSnippet(item)
        for (const slot of item.slots) {
            if (!nextSlots[slot]) nextSlots[slot] = []
            nextSlots[slot]!.push(snippet)
        }
    }
    slotSnippets = nextSlots
}

/** 写入运行时片段层并刷新补全缓存 */
export function setSqlEditorSnippetLayers(
    layers: {
        pluginShared?: SqlEditorShortcutsLayer | null
        shared?: SqlEditorShortcutsLayer | null
        personal?: SqlEditorShortcutsLayer | null
    },
    options?: { hintBarOnly?: boolean },
): SqlEditorShortcutsSettings {
    const prevKey = snippetCacheKey(activeSettings.snippets)
    activeSettings = resolveSqlEditorShortcutsLayers(layers)
    const nextKey = snippetCacheKey(activeSettings.snippets)
    if (prevKey !== nextKey) {
        rebuildSnippetCache()
    }
    if (options?.hintBarOnly) {
        sqlEditorHintBarVersion.value += 1
    } else {
        bumpSettingsVersion()
    }
    return activeSettings
}

/** 当前合并后的完整设置 */
export function getSqlEditorShortcutsSettings(): SqlEditorShortcutsSettings {
    return activeSettings
}

/** 是否自动为表生成别名 */
export function getSqlEditorAutoTableAliasEnabled(): boolean {
    return activeSettings.autoTableAlias
}

/** 是否显示提示条 */
export function getSqlEditorShowHintBar(): boolean {
    return activeSettings.showHintBar === true
}

/** 是否显示提示条快捷芯片 */
export function getSqlEditorShowHintQuickChips(): boolean {
    return activeSettings.showHintQuickChips !== false
}

/** 是否显示补全二级预览面板 */
export function getSqlEditorShowSuggestDetails(): boolean {
    return activeSettings.showSuggestDetails !== false
}

/** 是否启用代码折叠 */
export function getSqlEditorFolding(): boolean {
    return activeSettings.folding !== false
}

/** 是否显示行内执行按钮 */
export function getSqlEditorShowRunGutterButton(): boolean {
    return activeSettings.showRunGutterButton !== false
}

/** 个人层覆盖的字号；未设置时返回 undefined，由宿主 Monaco 配置决定 */
export function getSqlEditorFontSize(): number | undefined {
    return activeSettings.fontSize
}

/** 个人层覆盖的主题；未设置时返回 undefined，由宿主注入决定 */
export function getSqlEditorTheme(): string | undefined {
    return activeSettings.theme
}

/** 当前生效的 SQL 格式化选项 */
export function getSqlEditorFormatterSettings() {
    return activeSettings.formatter!
}

/** 当前 AI 助手配置 */
export function getSqlEditorAiSettings() {
    return activeSettings.ai
}

/** 全局 Tab 片段（无 slot 限制） */
export function getConfiguredGlobalSnippets(): readonly SqlSnippet[] {
    return globalSnippets
}

/** 按补全槽位过滤的 Tab 片段 */
export function getConfiguredSlotSnippets(slot: SqlCompletionSlot): readonly SqlSnippet[] {
    return slotSnippets[slot] ?? []
}

rebuildSnippetCache()
