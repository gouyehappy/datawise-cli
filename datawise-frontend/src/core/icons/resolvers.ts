import type {SettingsSection} from '@/core/types'
import type {WorkspaceTabType} from '@/core/types'
import type {DwIconName} from '@/core/icons/registry'
import type {SideRailItemId} from '@/features/layout/constants/side-rail-nav'
import type {ShortcutPanel} from '@/core/types'

export function settingsSectionDwIcon(section: SettingsSection): DwIconName {
    const map: Record<SettingsSection, DwIconName> = {
        basic: 'settings-basic',
        layout: 'settings-layout',
        connectionHealth: 'settings-connection-health',
        systemMetrics: 'settings-system-metrics',
        profile: 'settings-profile',
        editor: 'settings-editor',
        sqlEditor: 'settings-sql-editor',
        sqlSnippets: 'settings-sql-editor',
        shortcuts: 'settings-shortcuts',
        plugins: 'settings-plugins',
        ai: 'settings-ai',
        dataAgent: 'settings-data-agent',
        knowledge: 'settings-knowledge',
        about: 'settings-about',
    }
    return map[section]
}

export function workspaceTabDwIcon(type: WorkspaceTabType): DwIconName {
    switch (type) {
        case 'welcome':
            return 'tab-welcome'
        case 'console':
            return 'tab-console'
        case 'table':
        case 'schema-tables':
        case 'metadoc':
            return 'tab-table'
        case 'connection':
            return 'tab-connection'
        case 'terminal':
            return 'tab-terminal'
        case 'schema-compare':
            return 'tab-schema-compare'
        case 'schema-er':
            return 'tab-schema-er'
        case 'cross-env-compare':
            return 'tab-cross-env-compare'
        case 'view_model':
            return 'tab-view-model'
        case 'view_model_editor':
            return 'tab-view-model-editor'
        case 'view_model_lineage':
            return 'tab-view-model'
        case 'redis-key':
            return 'tab-redis-key'
        case 'redis-console':
            return 'tab-redis-console'
        case 'kafka-topics':
        case 'kafka-topic':
        case 'kafka-consumer-groups':
        case 'kafka-table-publish':
            return 'tab-kafka'
        case 'platform_catalog':
            return 'ai'
        default:
            return 'tab-file'
    }
}

const SHORTCUT_ICON_MAP: Record<string, DwIconName> = {
    search: 'search',
    refresh: 'refresh',
    locate: 'locate',
    settings: 'settings',
    run: 'run',
    save: 'save',
    console: 'console',
    ai: 'ai',
    'comment-column': 'comment-column',
    'comment-table': 'comment-table',
    'comment-all': 'comment-all',
    terminal: 'terminal',
    notify: 'notify',
}

export function shortcutActionDwIcon(iconName: string): DwIconName | null {
    return SHORTCUT_ICON_MAP[iconName] ?? null
}

export function sideRailDwIcon(id: SideRailItemId): DwIconName {
    const map: Record<SideRailItemId, DwIconName> = {
        database: 'database',
        dashboard: 'dashboard',
        ai: 'ai',
        plugin: 'plugins',
        connectorMarket: 'connectors',
        pluginDev: 'dev-tools',
        profile: 'user',
        team: 'users',
        settings: 'settings',
        refresh: 'refresh',
        notify: 'notify',
        feedback: 'feedback',
        terminal: 'terminal',
    }
    return map[id]
}

export function shortcutRailDwIcon(id: ShortcutPanel): DwIconName {
    const map: Record<ShortcutPanel, DwIconName> = {
        info: 'about',
        history: 'history',
        monitor: 'monitor',
        console: 'tab-console',
        export: 'export',
        migration: 'migration',
    }
    return map[id]
}
