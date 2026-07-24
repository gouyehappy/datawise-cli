/**
 * Tab 类型 → Vue 组件 的注册表
 *
 * 扩展方式：在 definitions 数组追加一条即可，无需改 Record 结构。
 */
import type {Component} from 'vue'
import type {WorkspaceTabType} from '@/core/types'
import {createRegistry, resolveRegistryComponent} from '@/core/registry/create-registry'
import {
    createLazyView,
    prefetchLazyLoaders,
    type LazyViewLoader,
} from '@/core/registry/create-lazy-view'

const TAB_LOADERS = {
    welcome: () => import('./components/tabs/WelcomeTab.vue'),
    console: () => import('./components/tabs/SqlConsoleTab.vue'),
    table: () => import('./components/tabs/TableDetailTab.vue'),
    connection: () => import('./components/tabs/ConnectionFormTab.vue'),
    terminal: () => import('./components/tabs/TerminalTab.vue'),
    'schema-compare': () => import('./components/tabs/SchemaCompareTab.vue'),
    'schema-er': () => import('./components/tabs/SchemaErTab.vue'),
    'schema-tables': () => import('./components/tabs/SchemaTablesTab.vue'),
    metadoc: () => import('./components/tabs/MetadocTab.vue'),
    'cross-env-compare': () => import('./components/tabs/CrossEnvCompareTab.vue'),
    'table-migration': () => import('./components/tabs/TableMigrationTab.vue'),
    view_model: () => import('./components/tabs/ViewModelDataTab.vue'),
    view_model_editor: () => import('./components/tabs/ViewModelEditorTab.vue'),
    view_model_lineage: () => import('./components/tabs/ViewModelLineageTab.vue'),
    'redis-key': () => import('./components/tabs/RedisKeyTab.vue'),
    'redis-console': () => import('./components/tabs/RedisConsoleTab.vue'),
    'kafka-topics': () => import('./components/tabs/KafkaTopicsTab.vue'),
    'kafka-topic': () => import('./components/tabs/KafkaTopicTab.vue'),
    'kafka-consumer-groups': () => import('./components/tabs/KafkaConsumerGroupsTab.vue'),
    'kafka-table-publish': () => import('./components/tabs/KafkaTablePublishTab.vue'),
    'yarn-applications': () => import('./components/tabs/YarnApplicationsTab.vue'),
    'yarn-nodes': () => import('./components/tabs/YarnNodesTab.vue'),
    'yarn-queues': () => import('./components/tabs/YarnQueuesTab.vue'),
    'ssh-terminal': () => import('./components/tabs/SshTerminalTab.vue'),
    'ssh-script-record': () => import('./components/tabs/SshScriptRecordTab.vue'),
    platform_catalog: () => import('./components/tabs/PlatformCatalogTab.vue'),
    data_catalog: () => import('./components/tabs/DataCatalogTab.vue'),
    'create-database': () => import('./components/tabs/CreateDatabaseTab.vue'),
} as const satisfies Record<string, LazyViewLoader>

type RegisteredTabType = keyof typeof TAB_LOADERS

function lazyTab(loader: LazyViewLoader) {
    return createLazyView(loader)
}

const definitions = (Object.keys(TAB_LOADERS) as RegisteredTabType[]).map((key) => ({
    key,
    component: lazyTab(TAB_LOADERS[key]),
}))

export const WORKSPACE_TAB_REGISTRY = createRegistry(definitions)

/** 启动后空闲预取：覆盖最常打开的工作区页，降低首次打开卡顿与占位闪现 */
export const WORKSPACE_TAB_WARMUP_TYPES: WorkspaceTabType[] = [
    'console',
    'table',
    'connection',
    'welcome',
]

export function resolveWorkspaceTab(type: WorkspaceTabType): Component | null {
    return resolveRegistryComponent(WORKSPACE_TAB_REGISTRY, type)
}

export function prefetchWorkspaceTabs(
    types: readonly WorkspaceTabType[] = WORKSPACE_TAB_WARMUP_TYPES,
): Promise<void> {
    return prefetchLazyLoaders(types.map((type) => TAB_LOADERS[type as RegisteredTabType]))
}
