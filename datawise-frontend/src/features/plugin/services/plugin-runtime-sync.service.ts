import {getDefaultSqlEditorRuntime} from '@datawise/sql-editor/runtime/sql-editor-runtime'

import {getAppSqlEditorShortcutsController} from '@/features/settings/services/sql-editor-shortcuts.controller'

import {

    resolveSqlSnippetLayerEnabled,

    type PluginId,

} from '@/features/plugin/services/plugin-registry.service'

import type {PluginItem} from '@/core/types'



/** 将插件中心开关同步到 SQL 编辑器运行时（内置 / 团队 / 个人片段层） */

export function syncSqlSnippetPluginGates(

    catalog: PluginItem[],

    overrides: Record<string, boolean | undefined>,

) {

    const runtime = getDefaultSqlEditorRuntime()

    runtime.setPluginBundledSnippetsEnabled(

        resolveSqlSnippetLayerEnabled('bundled', catalog, overrides),

    )

    runtime.setTeamSnippetsEnabled(

        resolveSqlSnippetLayerEnabled('team', catalog, overrides),

    )

    runtime.setPersonalSnippetsEnabled(

        resolveSqlSnippetLayerEnabled('personal', catalog, overrides),

    )

    runtime.sync()

    getAppSqlEditorShortcutsController().refreshFromRuntime()

}



/** @deprecated 使用 syncSqlSnippetPluginGates */

export function syncSqlSnippetPluginGate(enabled: boolean) {

    syncSqlSnippetPluginGates([], {'p-sql-snippets': enabled})

}



export function isSqlSnippetPluginId(id: PluginId | string): boolean {

    const key = id as string

    return key === 'p-sql-snippets'

        || key === 'p-sql-snippets-team'

        || key === 'p-sql-snippets-personal'

}

