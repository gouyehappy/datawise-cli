/**

 * Tab 类型 → Vue 组件 的注册表

 *

 * 扩展方式：在 definitions 数组追加一条即可，无需改 Record 结构。

 */

import {defineAsyncComponent, type Component} from 'vue'

import type {WorkspaceTabType} from '@/core/types'

import {createRegistry, resolveRegistryComponent} from '@/core/registry/create-registry'

function lazyTab(loader: () => Promise<{ default: Component }>) {
    return defineAsyncComponent(loader)
}

const definitions = [

    {key: 'welcome' as const, component: lazyTab(() => import('./components/tabs/WelcomeTab.vue'))},

    {key: 'console' as const, component: lazyTab(() => import('./components/tabs/SqlConsoleTab.vue'))},

    {key: 'table' as const, component: lazyTab(() => import('./components/tabs/TableDetailTab.vue'))},

    {key: 'connection' as const, component: lazyTab(() => import('./components/tabs/ConnectionFormTab.vue'))},

    {key: 'terminal' as const, component: lazyTab(() => import('./components/tabs/TerminalTab.vue'))},

    {key: 'schema-compare' as const, component: lazyTab(() => import('./components/tabs/SchemaCompareTab.vue'))},

    {key: 'schema-er' as const, component: lazyTab(() => import('./components/tabs/SchemaErTab.vue'))},

    {key: 'schema-tables' as const, component: lazyTab(() => import('./components/tabs/SchemaTablesTab.vue'))},

    {key: 'metadoc' as const, component: lazyTab(() => import('./components/tabs/MetadocTab.vue'))},

    {key: 'cross-env-compare' as const, component: lazyTab(() => import('./components/tabs/CrossEnvCompareTab.vue'))},

    {key: 'table-migration' as const, component: lazyTab(() => import('./components/tabs/TableMigrationTab.vue'))},

    {key: 'view_model' as const, component: lazyTab(() => import('./components/tabs/ViewModelDataTab.vue'))},

    {key: 'view_model_editor' as const, component: lazyTab(() => import('./components/tabs/ViewModelEditorTab.vue'))},

    {key: 'view_model_lineage' as const, component: lazyTab(() => import('./components/tabs/ViewModelLineageTab.vue'))},

    {key: 'redis-key' as const, component: lazyTab(() => import('./components/tabs/RedisKeyTab.vue'))},

    {key: 'redis-console' as const, component: lazyTab(() => import('./components/tabs/RedisConsoleTab.vue'))},

    {key: 'kafka-topics' as const, component: lazyTab(() => import('./components/tabs/KafkaTopicsTab.vue'))},

    {key: 'kafka-topic' as const, component: lazyTab(() => import('./components/tabs/KafkaTopicTab.vue'))},

    {key: 'kafka-consumer-groups' as const, component: lazyTab(() => import('./components/tabs/KafkaConsumerGroupsTab.vue'))},

    {key: 'kafka-table-publish' as const, component: lazyTab(() => import('./components/tabs/KafkaTablePublishTab.vue'))},
    {key: 'yarn-applications' as const, component: lazyTab(() => import('./components/tabs/YarnApplicationsTab.vue'))},
    {key: 'yarn-nodes' as const, component: lazyTab(() => import('./components/tabs/YarnNodesTab.vue'))},
    {key: 'yarn-queues' as const, component: lazyTab(() => import('./components/tabs/YarnQueuesTab.vue'))},
    {key: 'ssh-terminal' as const, component: lazyTab(() => import('./components/tabs/SshTerminalTab.vue'))},
    {key: 'ssh-script-record' as const, component: lazyTab(() => import('./components/tabs/SshScriptRecordTab.vue'))},

    {key: 'platform_catalog' as const, component: lazyTab(() => import('./components/tabs/PlatformCatalogTab.vue'))},

    {key: 'data_catalog' as const, component: lazyTab(() => import('./components/tabs/DataCatalogTab.vue'))},

    {key: 'create-database' as const, component: lazyTab(() => import('./components/tabs/CreateDatabaseTab.vue'))},

]


export const WORKSPACE_TAB_REGISTRY = createRegistry(definitions)


export function resolveWorkspaceTab(type: WorkspaceTabType): Component | null {
    return resolveRegistryComponent(WORKSPACE_TAB_REGISTRY, type)
}
