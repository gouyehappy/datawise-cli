/**
 * 导航模块 → 页面组件注册表
 *
 * 「数据库」「AI」在 MainContent 中单独布局，不在此表；
 * 此处仅注册使用 ModuleWorkbench 外壳的模块（仪表盘、插件、团队、设置等）。
 */
import type {Component} from 'vue'
import type {NavModule} from '@/core/types'
import DashboardView from '@/features/dashboard/DashboardView.vue'
import PluginView from '@/features/plugin/PluginView.vue'
import PluginDevToolsView from '@/features/plugin/PluginDevToolsView.vue'
import ConnectorMarketView from '@/features/plugin/ConnectorMarketView.vue'
import TeamView from '@/features/team/TeamView.vue'
import SettingsView from '@/features/settings/SettingsView.vue'
import {createRegistry, resolveRegistryComponent} from '@/core/registry/create-registry'

const definitions = [
    {key: 'dashboard' as const, component: DashboardView},
    {key: 'plugin' as const, component: PluginView},
    {key: 'pluginDev' as const, component: PluginDevToolsView},
    {key: 'connectorMarket' as const, component: ConnectorMarketView},
    {key: 'team' as const, component: TeamView},
    {key: 'settings' as const, component: SettingsView},
]

export const WORKBENCH_MODULE_REGISTRY = createRegistry(definitions)

export function resolveWorkbenchModule(module: NavModule): Component | null {
    return resolveRegistryComponent(WORKBENCH_MODULE_REGISTRY, module as keyof typeof WORKBENCH_MODULE_REGISTRY)
}
