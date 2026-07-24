/**
 * 导航模块 → 页面组件注册表
 *
 * 「数据库」「AI」在 MainContent 中单独布局，不在此表；
 * 此处仅注册使用 ModuleWorkbench 外壳的模块（仪表盘、插件、团队、设置等）。
 */
import type {Component} from 'vue'
import type {NavModule} from '@/core/types'
import {createRegistry, resolveRegistryComponent} from '@/core/registry/create-registry'
import {
    createLazyView,
    prefetchLazyLoaders,
    type LazyViewLoader,
} from '@/core/registry/create-lazy-view'

const MODULE_LOADERS = {
    dashboard: () => import('@/features/dashboard/DashboardView.vue'),
    plugin: () => import('@/features/plugin/PluginView.vue'),
    pluginDev: () => import('@/features/plugin/PluginDevToolsView.vue'),
    connectorMarket: () => import('@/features/plugin/ConnectorMarketView.vue'),
    team: () => import('@/features/team/TeamView.vue'),
    settings: () => import('@/features/settings/SettingsView.vue'),
} as const satisfies Record<string, LazyViewLoader>

type RegisteredModule = keyof typeof MODULE_LOADERS

const definitions = (Object.keys(MODULE_LOADERS) as RegisteredModule[]).map((key) => ({
    key,
    component: createLazyView(MODULE_LOADERS[key]),
}))

export const WORKBENCH_MODULE_REGISTRY = createRegistry(definitions)

export const WORKBENCH_MODULE_WARMUP: RegisteredModule[] = [
    'dashboard',
    'settings',
]

export function resolveWorkbenchModule(module: NavModule): Component | null {
    return resolveRegistryComponent(
        WORKBENCH_MODULE_REGISTRY,
        module as keyof typeof WORKBENCH_MODULE_REGISTRY,
    )
}

export function prefetchWorkbenchModules(
    modules: readonly RegisteredModule[] = WORKBENCH_MODULE_WARMUP,
): Promise<void> {
    return prefetchLazyLoaders(modules.map((module) => MODULE_LOADERS[module]))
}
