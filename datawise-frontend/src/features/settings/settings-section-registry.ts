/**
 * 设置页分区 → 面板组件 的注册表（与 tab-registry / module-registry 同模式）
 */
import type {Component} from 'vue'
import type {SettingsSection} from '@/core/types'
import {createRegistry, resolveRegistryComponent} from '@/core/registry/create-registry'
import AiKnowledgeSettingsPanel from '@/features/settings/components/AiKnowledgeSettingsPanel.vue'
import AiDataAgentHubPanel from '@/features/settings/components/AiDataAgentHubPanel.vue'
import AboutSettingsPanel from '@/features/settings/components/AboutSettingsPanel.vue'
import AiSettingsPanel from '@/features/settings/components/AiSettingsPanel.vue'
import BasicSettingsPanel from '@/features/settings/components/BasicSettingsPanel.vue'
import ConnectionHealthSettingsPanel from '@/features/settings/components/ConnectionHealthSettingsPanel.vue'
import SystemMetricsSettingsPanel from '@/features/settings/components/SystemMetricsSettingsPanel.vue'
import EditorSettingsPanel from '@/features/settings/components/EditorSettingsPanel.vue'
import LayoutSettingsPanel from '@/features/settings/components/LayoutSettingsPanel.vue'
import ProfileSettingsPanel from '@/features/settings/components/ProfileSettingsPanel.vue'
import PluginSettingsPanel from '@/features/settings/components/PluginSettingsPanel.vue'
import SqlEditorShortcutsPanel from '@/features/settings/components/SqlEditorShortcutsPanel.vue'
import ShortcutSettingsPanel from '@/features/settings/components/ShortcutSettingsPanel.vue'

const definitions = [
    {key: 'basic' as const, component: BasicSettingsPanel},
    {key: 'layout' as const, component: LayoutSettingsPanel},
    {key: 'connectionHealth' as const, component: ConnectionHealthSettingsPanel},
    {key: 'systemMetrics' as const, component: SystemMetricsSettingsPanel},
    {key: 'profile' as const, component: ProfileSettingsPanel},
    {key: 'editor' as const, component: EditorSettingsPanel},
    {key: 'sqlEditor' as const, component: SqlEditorShortcutsPanel},
    {key: 'shortcuts' as const, component: ShortcutSettingsPanel},
    {key: 'plugins' as const, component: PluginSettingsPanel},
    {key: 'ai' as const, component: AiSettingsPanel},
    {key: 'dataAgent' as const, component: AiDataAgentHubPanel},
    {key: 'knowledge' as const, component: AiDataAgentHubPanel},
    {key: 'about' as const, component: AboutSettingsPanel},
]

export const SETTINGS_SECTION_REGISTRY = createRegistry(definitions)

export function resolveSettingsPanel(section: SettingsSection): Component | null {
    return resolveRegistryComponent(SETTINGS_SECTION_REGISTRY, section)
}
