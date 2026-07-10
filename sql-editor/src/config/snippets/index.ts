export {
    buildDefaultSnippetConfigsFromConstants,
    getPluginBundledSharedLayer,
} from '@sql-editor/config/snippets/builtin'

export {
    normalizeSnippetConfig,
    normalizeQuickChipConfig,
    normalizeKeybindingConfig,
    normalizeSqlEditorShortcutsLayer,
    normalizeSqlEditorShortcutsSettings,
} from '@sql-editor/config/snippets/normalize'

export {
    applySqlEditorShortcutsOverlay,
    createEmptySqlEditorShortcutsLayer,
    createDefaultSqlEditorShortcutsSettings,
    mergeSqlEditorShortcutsLayers,
    resolveSqlEditorShortcutsLayers,
    toExportableSqlEditorShortcutsSettings,
    resolveSqlSnippetSource,
    snippetIdentityKey,
    filterRedundantGlobalSnippetsForDisplay,
} from '@sql-editor/config/snippets/merge'

export {sqlEditorShortcutsLayerHasOverrides} from '@sql-editor/config/snippets/layer-overrides'

export {
    setSqlEditorSnippetLayers,
    getSqlEditorShortcutsSettings,
    getSqlEditorAutoTableAliasEnabled,
    getSqlEditorShowHintQuickChips,
    sqlEditorSettingsVersion,
    getConfiguredGlobalSnippets,
    getConfiguredSlotSnippets,
} from '@sql-editor/config/snippets/cache'

export {getPluginBundledSharedLayer as getPluginBundledSqlEditorShortcuts} from '@sql-editor/config/snippets/builtin'
