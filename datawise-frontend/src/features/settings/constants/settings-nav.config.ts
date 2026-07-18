import type {SettingsSection} from '@/core/types'
import {
    FeaturePermission,
    type FeaturePermissionKey,
} from '@/features/auth/types/feature-permission.types'

export const SETTINGS_SECTION_PERMISSION_MAP: Partial<Record<SettingsSection, FeaturePermissionKey>> = {
    basic: FeaturePermission.SettingsBasic,
    layout: FeaturePermission.SettingsLayout,
    profile: FeaturePermission.SettingsProfile,
    editor: FeaturePermission.SettingsEditor,
    shortcuts: FeaturePermission.SettingsShortcuts,
    sqlEditor: FeaturePermission.SettingsSqlEditor,
    sqlSnippets: FeaturePermission.SettingsSqlSnippets,
    connectionHealth: FeaturePermission.SettingsConnectionHealth,
    systemMetrics: FeaturePermission.SettingsSystemMetrics,
    ai: FeaturePermission.SettingsAi,
    dataAgent: FeaturePermission.SettingsDataAgent,
    knowledge: FeaturePermission.SettingsDataAgent,
    plugins: FeaturePermission.SettingsPlugins,
    about: FeaturePermission.SettingsAbout,
    integrations: FeaturePermission.SettingsIntegrations,
    secrets: FeaturePermission.SettingsIntegrations,
    userPermissions: FeaturePermission.SettingsUserPermissions,
    tenants: FeaturePermission.SettingsTenants,
}

export interface SettingsNavItem {
    id: SettingsSection
    labelKey: string
    /** 租户管理员可见（账号权限 / 集成等） */
    adminOnly?: boolean
    /** 仅 multi 模式显示（租户管理） */
    multiOnly?: boolean
    /** 仅平台超管 + multi（历史兼容；优先用 adminOnly+multiOnly） */
    platformAdminOnly?: boolean
}

export interface SettingsNavGroup {
    labelKey: string
    items: SettingsNavItem[]
}

/**
 * 设置侧栏分组：个人偏好 → 编辑器 → 运行 → AI → 组织安全 → 本机账户。
 * 权限页「设置页入口」与此对齐。
 */
export const SETTINGS_NAV_GROUPS: SettingsNavGroup[] = [
    {
        labelKey: 'settings.nav.groups.preferences',
        items: [
            {id: 'basic', labelKey: 'settings.nav.basic'},
            {id: 'layout', labelKey: 'settings.nav.layout'},
            {id: 'shortcuts', labelKey: 'settings.nav.shortcuts'},
        ],
    },
    {
        labelKey: 'settings.nav.groups.editor',
        items: [
            {id: 'editor', labelKey: 'settings.nav.editor'},
            {id: 'sqlEditor', labelKey: 'settings.nav.sqlEditor'},
            {id: 'sqlSnippets', labelKey: 'settings.nav.sqlEditorSnippets'},
        ],
    },
    {
        labelKey: 'settings.nav.groups.database',
        items: [
            {id: 'connectionHealth', labelKey: 'settings.nav.connectionHealth'},
            {id: 'systemMetrics', labelKey: 'settings.nav.systemMetrics'},
        ],
    },
    {
        labelKey: 'settings.nav.groups.ai',
        items: [
            {id: 'ai', labelKey: 'settings.nav.aiModels'},
            {id: 'dataAgent', labelKey: 'settings.nav.dataAgent'},
        ],
    },
    {
        labelKey: 'settings.nav.groups.security',
        items: [
            {id: 'userPermissions', labelKey: 'settings.nav.userPermissions', adminOnly: true},
            {id: 'tenants', labelKey: 'settings.nav.tenants', adminOnly: true, multiOnly: true},
            {id: 'secrets', labelKey: 'settings.nav.secrets', adminOnly: true},
            {id: 'integrations', labelKey: 'settings.nav.integrations', adminOnly: true},
        ],
    },
    {
        labelKey: 'settings.nav.groups.account',
        items: [
            {id: 'profile', labelKey: 'settings.nav.profile'},
            {id: 'plugins', labelKey: 'settings.nav.plugins'},
            {id: 'about', labelKey: 'settings.nav.about'},
        ],
    },
]

export function flattenSettingsNavItems(options?: {includeAdminOnly?: boolean}): SettingsNavItem[] {
    const includeAdminOnly = options?.includeAdminOnly ?? true
    return SETTINGS_NAV_GROUPS.flatMap((group) =>
        group.items.filter((item) => includeAdminOnly || (!item.adminOnly && !item.platformAdminOnly)),
    )
}

export function buildSettingsNavGroups(options: {
    isAdmin: boolean
    platformAdmin?: boolean
    multiTenancy?: boolean
}): SettingsNavGroup[] {
    return SETTINGS_NAV_GROUPS.map((group) => ({
        ...group,
        items: group.items.filter((item) => {
            if (item.platformAdminOnly) {
                return Boolean(options.platformAdmin && options.multiTenancy)
            }
            if (item.multiOnly && !options.multiTenancy) {
                return false
            }
            if (item.adminOnly) {
                return options.isAdmin
            }
            return true
        }),
    }))
}

export function buildSettingsPermissionNavItems(): Array<{key: FeaturePermissionKey; labelKey: string}> {
    return flattenSettingsNavItems({includeAdminOnly: true})
        .map((item) => {
            const key = SETTINGS_SECTION_PERMISSION_MAP[item.id]
            if (!key) return null
            return {key, labelKey: item.labelKey}
        })
        .filter((item): item is {key: FeaturePermissionKey; labelKey: string} => item != null)
}
