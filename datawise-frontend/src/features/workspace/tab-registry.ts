/**

 * Tab 类型 → Vue 组件 的注册表

 *

 * 扩展方式：在 definitions 数组追加一条即可，无需改 Record 结构。

 */

import type {Component} from 'vue'

import type {WorkspaceTabType} from '@/core/types'

import {createRegistry, resolveRegistryComponent} from '@/core/registry/create-registry'

import WelcomeTab from './components/tabs/WelcomeTab.vue'

import SqlConsoleTab from './components/tabs/SqlConsoleTab.vue'

import TableDetailTab from './components/tabs/TableDetailTab.vue'

import ConnectionFormTab from './components/tabs/ConnectionFormTab.vue'

import TerminalTab from './components/tabs/TerminalTab.vue'
import SchemaCompareTab from './components/tabs/SchemaCompareTab.vue'
import SchemaErTab from './components/tabs/SchemaErTab.vue'
import SchemaTablesTab from './components/tabs/SchemaTablesTab.vue'
import MetadocTab from './components/tabs/MetadocTab.vue'
import CrossEnvCompareTab from './components/tabs/CrossEnvCompareTab.vue'
import TableMigrationTab from './components/tabs/TableMigrationTab.vue'
import ViewModelDataTab from './components/tabs/ViewModelDataTab.vue'
import ViewModelEditorTab from './components/tabs/ViewModelEditorTab.vue'
import ViewModelLineageTab from './components/tabs/ViewModelLineageTab.vue'
import RedisKeyTab from './components/tabs/RedisKeyTab.vue'
import RedisConsoleTab from './components/tabs/RedisConsoleTab.vue'
import KafkaTopicsTab from './components/tabs/KafkaTopicsTab.vue'
import KafkaTopicTab from './components/tabs/KafkaTopicTab.vue'
import PlatformCatalogTab from './components/tabs/PlatformCatalogTab.vue'
import KafkaConsumerGroupsTab from './components/tabs/KafkaConsumerGroupsTab.vue'


const definitions = [

    {key: 'welcome' as const, component: WelcomeTab},

    {key: 'console' as const, component: SqlConsoleTab},

    {key: 'table' as const, component: TableDetailTab},

    {key: 'connection' as const, component: ConnectionFormTab},

    {key: 'terminal' as const, component: TerminalTab},

    {key: 'schema-compare' as const, component: SchemaCompareTab},

    {key: 'schema-er' as const, component: SchemaErTab},

    {key: 'schema-tables' as const, component: SchemaTablesTab},

    {key: 'metadoc' as const, component: MetadocTab},

    {key: 'cross-env-compare' as const, component: CrossEnvCompareTab},

    {key: 'table-migration' as const, component: TableMigrationTab},

    {key: 'view_model' as const, component: ViewModelDataTab},

    {key: 'view_model_editor' as const, component: ViewModelEditorTab},

    {key: 'view_model_lineage' as const, component: ViewModelLineageTab},

    {key: 'redis-key' as const, component: RedisKeyTab},

    {key: 'redis-console' as const, component: RedisConsoleTab},

    {key: 'kafka-topics' as const, component: KafkaTopicsTab},

    {key: 'kafka-topic' as const, component: KafkaTopicTab},

    {key: 'kafka-consumer-groups' as const, component: KafkaConsumerGroupsTab},

    {key: 'platform_catalog' as const, component: PlatformCatalogTab},

]


export const WORKSPACE_TAB_REGISTRY = createRegistry(definitions)


export function resolveWorkspaceTab(type: WorkspaceTabType): Component | null {
    return resolveRegistryComponent(WORKSPACE_TAB_REGISTRY, type)
}

