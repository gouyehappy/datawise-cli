/**
 * 设置页分区 → 面板组件 的注册表（与 tab-registry / module-registry 同模式）
 */
import {defineAsyncComponent, type Component} from 'vue'
import type {SettingsSection} from '@/core/types'
import {createRegistry, resolveRegistryComponent} from '@/core/registry/create-registry'

function lazyPanel(loader: () => Promise<{ default: Component }>) {
    return defineAsyncComponent(loader)
}

const definitions = [
    {key: 'basic' as const, component: lazyPanel(() => import('@/features/settings/components/BasicSettingsPanel.vue'))},
    {key: 'layout' as const, component: lazyPanel(() => import('@/features/settings/components/LayoutSettingsPanel.vue'))},
    {key: 'connectionHealth' as const, component: lazyPanel(() => import('@/features/settings/components/ConnectionHealthSettingsPanel.vue'))},
    {key: 'systemMetrics' as const, component: lazyPanel(() => import('@/features/settings/components/SystemMetricsSettingsPanel.vue'))},
    {key: 'profile' as const, component: lazyPanel(() => import('@/features/settings/components/ProfileSettingsPanel.vue'))},
    {key: 'editor' as const, component: lazyPanel(() => import('@/features/settings/components/EditorSettingsPanel.vue'))},
    {key: 'sqlEditor' as const, component: lazyPanel(() => import('@/features/settings/components/SqlEditorShortcutsPanel.vue'))},
    {key: 'sqlSnippets' as const, component: lazyPanel(() => import('@/features/settings/components/SqlSnippetsSettingsPanel.vue'))},
    {key: 'shortcuts' as const, component: lazyPanel(() => import('@/features/settings/components/ShortcutSettingsPanel.vue'))},
    {key: 'plugins' as const, component: lazyPanel(() => import('@/features/settings/components/PluginSettingsPanel.vue'))},
    {key: 'ai' as const, component: lazyPanel(() => import('@/features/settings/components/AiSettingsPanel.vue'))},
    {key: 'dataAgent' as const, component: lazyPanel(() => import('@/features/settings/components/AiDataAgentHubPanel.vue'))},
    {key: 'knowledge' as const, component: lazyPanel(() => import('@/features/settings/components/AiDataAgentHubPanel.vue'))},
    {key: 'about' as const, component: lazyPanel(() => import('@/features/settings/components/AboutSettingsPanel.vue'))},
    {key: 'userPermissions' as const, component: lazyPanel(() => import('@/features/settings/components/UserPermissionSettingsPanel.vue'))},
]

export const SETTINGS_SECTION_REGISTRY = createRegistry(definitions)

export function resolveSettingsPanel(section: SettingsSection): Component | null {
    return resolveRegistryComponent(SETTINGS_SECTION_REGISTRY, section)
}
