/**
 * Workspace 全局状态（Pinia Store）
 */
import {defineStore} from 'pinia'
import {computed, ref} from 'vue'
import type {DbType, StatusSnapshot, WorkspaceTab} from '@/core/types'
import {t} from '@/i18n'
import type {ConsoleQueryState, QueryResultItem} from '@/features/workspace/types'
import type {WorkspaceTabSnapshot} from '@/shared/config/app-config.types'
import type {PlatformFeatureId} from '@/features/platform/types/platform.types'
import {captureWorkspaceTabs} from '@/features/workspace/utils/workspace-session'
import {platformCatalogTabTitle} from '@/features/platform/services/platform-catalog.service'
import {resolveConsoleInstanceLabel} from '@/features/workspace/services/resolve-console-instance'
import {
    buildConsoleTabTitleFromParts,
    formatSqlFileTabLabel,
    getBoundConsoleSqlFile,
    isSameConsoleTabLabel,
    parseConsoleTabTitle,
    resolveConsoleSqlFileName,
    resolveConsoleTabTitle,
    sqlFileNameFromTabLabel,
    syncConsoleTabTitle,
    scriptFileNameFromTabTitle,
} from '@/features/workspace/services/console-tab-title'
import {
    resolveNextConsoleScriptFile,
    resolveNextScriptFileForOpen,
} from '@/features/explorer/services/sql-script.service'
import {
    extractDataSources,
    findDataSource,
    pickDefaultDataSource,
    probeAllConnections,
} from '@/features/explorer/utils/data-sources'
import {isConsoleTabDirty} from '@/features/workspace/services/console-tab-dirty'
import {
    replaceConsoleQueryResultAtIndex,
    sumConsoleQueryTotals,
} from '@/features/workspace/services/query-result-refresh.service'
import {useExplorerStore} from '@/features/explorer/stores/explorer'
import {
    resolveConsoleWorkspaceInstance,
    resolveWorkspaceInstanceNodeId,
    TRINO_CONNECTION_SCRIPTS_INSTANCE,
} from '@/features/workspace/services/console-workspace-instance'
import {isCatalogSchemaDbType} from '@/features/explorer/services/explorer-lazy-load'
import {useLayoutStore} from '@/features/layout/stores/layout'
import {canOpenConnectionCatalogForm} from '@/features/auth/services/feature-permission.service'
import {useAuthStore} from '@/features/auth/stores/auth-store'
import {instanceSqlApi} from '@/api'
import {viewModelApi} from '@/api/modules/view-model'
import {
    isValidViewModelBaseName,
    stripViewModelDisplayName,
} from '@/features/explorer/services/view-model-naming'
import {resolveNextViewModelNameForOpen} from '@/features/explorer/services/view-model-open.service'

let tabCounter = 0

function nextTabId(prefix: string) {
    return `${prefix}-${++tabCounter}`
}

export type {ConsoleQueryState, QueryResultItem} from '@/features/workspace/types'

export const useWorkspaceStore = defineStore('workspace', () => {
    const tabs = ref<WorkspaceTab[]>([])
    const activeTabId = ref<string | null>(null)
    const status = ref<StatusSnapshot>({
        message: t('common.ready'),
        duration: '-',
        rowCount: '-',
    })
    const consoleQueryByTabId = ref<Record<string, ConsoleQueryState>>({})
    /** 表数据 Tab 假数据插入成功后递增，触发网格刷新 */
    const tableDataRefreshSeq = ref<Record<string, number>>({})
    /** 从表数据工具栏请求打开假数据对话框（WorkspaceTabs 监听） */
    const fakeDataDialogRequest = ref<{ tabId: string; nonce: number } | null>(null)

    const activeTab = computed(() =>
        activeTabId.value ? tabs.value.find((t) => t.id === activeTabId.value) ?? null : null,
    )

    const hasOpenTabs = computed(() => tabs.value.length > 0)

    function activateTab(tabId: string) {
        activeTabId.value = tabId
    }

    function resolveConnectionLabel(connectionId: string) {
        const explorer = useExplorerStore()
        return (
            explorer.findNode(connectionId)?.label
            ?? findDataSource(extractDataSources(explorer.tree), connectionId)?.label
        )
    }

    function resolveOpenConsoleOptions(options?: {
        connectionName?: string
        connectionId?: string
        instanceId?: string | null
        database?: string
        sql?: string
        sqlFile?: string
        title?: string
        explorerNodeId?: string
        teamSharedQuery?: WorkspaceTab['teamSharedQuery']
    }) {
        const explorer = useExplorerStore()
        const sources = extractDataSources(explorer.tree)
        const healthById = explorer.connectionHealthById

        let connectionId = options?.connectionId
        let instanceId = options?.instanceId
        let database = options?.database
        let connectionName = options?.connectionName

        if (!connectionId) {
            const active = activeTab.value
            if (active?.type === 'console' && active.connectionId) {
                connectionId = active.connectionId
                instanceId = instanceId ?? active.instanceId
                database = database ?? active.database
            } else {
                const defaultSource = pickDefaultDataSource(sources, healthById)
                if (defaultSource) connectionId = defaultSource.id
            }
        }

        if (connectionId && !connectionName) {
            connectionName = resolveConnectionLabel(connectionId)
        }

        const source = connectionId ? findDataSource(sources, connectionId) : undefined
        const connectionNode = connectionId ? explorer.findNode(connectionId) : undefined
        const catalogSchemaFamily = isCatalogSchemaDbType(connectionNode?.dbType)
        if (
            connectionId
            && source?.instances.length
            && instanceId == null
            && !database
            && !catalogSchemaFamily
        ) {
            instanceId = source.instances[0].id
            database = source.instances[0].label
        }

        return {
            ...options,
            connectionId,
            instanceId,
            database,
            connectionName,
        }
    }

    function ensureConsoleTabScriptFile(tab: WorkspaceTab) {
        if (tab.type !== 'console' || !tab.connectionId || getBoundConsoleSqlFile(tab)) return

        const fromTitle = tab.title ? scriptFileNameFromTabTitle(tab.title) : null
        if (fromTitle) {
            tab.sqlFile = fromTitle
            return
        }

        const explorer = useExplorerStore()
        void resolveNextScriptFileForOpen({
            tabs: tabs.value,
            connectionId: tab.connectionId,
            instanceId: tab.instanceId,
            instanceName: tab.database,
            tree: explorer.tree,
            excludeTabId: tab.id,
        }).then((fileName) => {
            const latest = tabs.value.find((item) => item.id === tab.id)
            if (!latest || !latest.connectionId || getBoundConsoleSqlFile(latest)) return
            latest.sqlFile = fileName
            const nextTitle = syncConsoleTabTitle(latest, resolveConnectionLabel(latest.connectionId))
            if (nextTitle) latest.title = nextTitle
        })
    }

    async function openConsole(options?: {
        connectionName?: string
        connectionId?: string
        instanceId?: string | null
        database?: string
        sql?: string
        sqlFile?: string
        title?: string
        explorerNodeId?: string
        teamSharedQuery?: WorkspaceTab['teamSharedQuery']
        skipEnsureScriptFile?: boolean
    }) {
        const explorer = useExplorerStore()
        const resolved = resolveOpenConsoleOptions(options)

        if (!resolved.connectionId) {
            await probeAllConnections(explorer.tree, (connectionId) =>
                explorer.ensureChildrenLoaded(connectionId),
            )
        } else {
            const sources = extractDataSources(explorer.tree)
            const source = findDataSource(sources, resolved.connectionId)
            if (!source?.instances.length) {
                await explorer.ensureChildrenLoaded(resolved.connectionId)
            }
        }

        const finalResolved = resolveOpenConsoleOptions({
            ...options,
            connectionId: resolved.connectionId,
            instanceId: resolved.instanceId,
            database: resolved.database,
            connectionName: resolved.connectionName,
        })

        if (finalResolved.connectionId && finalResolved.instanceId && finalResolved.sqlFile) {
            const existing = tabs.value.find(
                (item) =>
                    item.type === 'console' &&
                    item.connectionId === finalResolved.connectionId &&
                    item.instanceId === finalResolved.instanceId &&
                    item.sqlFile === finalResolved.sqlFile,
            )
            if (existing) {
                if (finalResolved.sql !== undefined) existing.sql = finalResolved.sql
                if (finalResolved.database !== undefined) existing.database = finalResolved.database
                if (finalResolved.explorerNodeId) existing.explorerNodeId = finalResolved.explorerNodeId
                const nextTitle = resolveConsoleTabTitle({
                    sqlFile: existing.sqlFile,
                    connectionName: finalResolved.connectionName,
                    kind: 'script',
                })
                if (nextTitle) existing.title = nextTitle
                activeTabId.value = existing.id
                ensureConsoleQueryState(existing.id)
                return existing.id
            }
        }

        if (
            finalResolved.connectionId &&
            finalResolved.instanceId &&
            !finalResolved.sqlFile
        ) {
            const existingPlaceholder = tabs.value.find(
                (item) =>
                    item.type === 'console' &&
                    item.connectionId === finalResolved.connectionId &&
                    item.instanceId === finalResolved.instanceId &&
                    !getBoundConsoleSqlFile(item),
            )
            if (existingPlaceholder) {
                if (finalResolved.sql !== undefined) existingPlaceholder.sql = finalResolved.sql
                if (finalResolved.database !== undefined) {
                    existingPlaceholder.database = finalResolved.database
                }
                if (finalResolved.explorerNodeId) {
                    existingPlaceholder.explorerNodeId = finalResolved.explorerNodeId
                }
                activeTabId.value = existingPlaceholder.id
                ensureConsoleQueryState(existingPlaceholder.id)
                return existingPlaceholder.id
            }
        }

        const id = nextTabId('console')
        const sqlFile = finalResolved.sqlFile
        const title =
            finalResolved.title ??
            (sqlFile
                ? resolveConsoleTabTitle({
                    sqlFile,
                    connectionName: finalResolved.connectionName,
                    kind: 'script',
                })
                : resolveConsoleTabTitle({
                    connectionName: finalResolved.connectionName,
                    kind: 'console',
                })) ??
            t('console.consoleTitle', {n: tabCounter})
        const tab: WorkspaceTab = {
            id,
            title,
            type: 'console',
            closable: true,
            connectionId: finalResolved.connectionId,
            instanceId: finalResolved.instanceId,
            database: finalResolved.database,
            sql: finalResolved.sql ?? '',
            savedSql: finalResolved.sql ?? '',
            sqlFile,
            explorerNodeId: finalResolved.explorerNodeId,
            teamSharedQuery: finalResolved.teamSharedQuery,
        }
        await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()))
        tabs.value.push(tab)
        activeTabId.value = id
        ensureConsoleQueryState(id)
        if (!sqlFile && finalResolved.connectionId && !options?.skipEnsureScriptFile) {
            ensureConsoleTabScriptFile(tab)
        }
        return id
    }

    function openTable(
        tableName: string,
        connectionId?: string,
        instanceId?: string,
        database?: string,
        explorerNodeId?: string,
        tableView?: NonNullable<WorkspaceTab['tableView']>,
        relationKind: NonNullable<WorkspaceTab['relationKind']> = 'table',
    ) {
        const existing = tabs.value.find(
            (t) =>
                t.type === 'table' &&
                t.tableName === tableName &&
                t.connectionId === connectionId &&
                (t.relationKind ?? 'table') === relationKind &&
                (database ? t.database === database : t.instanceId === instanceId),
        )
        if (existing) {
            if (connectionId) existing.connectionId = connectionId
            if (instanceId) existing.instanceId = instanceId
            if (database) existing.database = database
            if (explorerNodeId) existing.explorerNodeId = explorerNodeId
            if (tableView) existing.tableView = tableView
            existing.relationKind = relationKind
            activeTabId.value = existing.id
            return existing.id
        }
        const id = nextTabId('table')
        tabs.value.push({
            id,
            title: tableName,
            type: 'table',
            closable: true,
            tableName,
            connectionId,
            instanceId,
            database,
            explorerNodeId,
            tableView: tableView ?? 'properties',
            tableSection: 'columns',
            relationKind,
        })
        activeTabId.value = id
        return id
    }

    function openConnectionForm(
        dbType: DbType,
        options?: { connectionId?: string; connectionName?: string; groupId?: string },
    ): string | null {
        if (!canOpenConnectionCatalogForm(useAuthStore().isGuest)) {
            useLayoutStore().showErrorToast(t('auth.permissionDenied'))
            return null
        }

        if (options?.connectionId) {
            const existing = tabs.value.find(
                (tab) => tab.type === 'connection' && tab.connectionId === options.connectionId,
            )
            if (existing) {
                activeTabId.value = existing.id
                return existing.id
            }
        }

        const id = nextTabId('connection')
        const title =
            options?.connectionId && options.connectionName
                ? t('connection.editTitle', {name: options.connectionName})
                : t('console.newConnectionTitle', {dbType})
        tabs.value.push({
            id,
            title,
            type: 'connection',
            closable: true,
            dbType,
            connectionId: options?.connectionId,
            targetGroupId: options?.groupId,
        })
        activeTabId.value = id
        return id
    }

    function openRedisKey(options: {
        connectionId: string
        key: string
        connectionName?: string
        explorerNodeId?: string
    }) {
        const existing = tabs.value.find(
            (tab) =>
                tab.type === 'redis-key'
                && tab.connectionId === options.connectionId
                && tab.redisKey === options.key,
        )
        if (existing) {
            activeTabId.value = existing.id
            return existing.id
        }

        const id = nextTabId('redis')
        tabs.value.push({
            id,
            title: options.key,
            type: 'redis-key',
            closable: true,
            connectionId: options.connectionId,
            redisKey: options.key,
            dbType: 'redis',
            explorerNodeId: options.explorerNodeId,
        })
        activeTabId.value = id
        return id
    }

    function openRedisConsole(options: {
        connectionId: string
        connectionName?: string
        explorerNodeId?: string
        view?: 'keys' | 'command'
    }) {
        const view = options.view ?? 'keys'
        const existing = tabs.value.find(
            (tab) =>
                tab.type === 'redis-console'
                && tab.connectionId === options.connectionId,
        )
        if (existing) {
            existing.redisView = view
            activeTabId.value = existing.id
            return existing.id
        }

        const label = options.connectionName ?? resolveConnectionLabel(options.connectionId)
        const id = nextTabId('redis-console')
        tabs.value.push({
            id,
            title: label ? t('explorer.redisConsole.tabTitle', {name: label}) : t('explorer.redisConsole.title'),
            type: 'redis-console',
            closable: true,
            connectionId: options.connectionId,
            dbType: 'redis',
            explorerNodeId: options.explorerNodeId,
            redisView: view,
        })
        activeTabId.value = id
        return id
    }

    function openKafkaTopics(options: {
        connectionId: string
        connectionName?: string
        explorerNodeId?: string
        topic?: string
    }) {
        const existing = tabs.value.find(
            (tab) =>
                tab.type === 'kafka-topics'
                && tab.connectionId === options.connectionId,
        )
        if (existing) {
            if (options.topic) {
                updateTabContext(existing.id, {kafkaTopic: options.topic})
            }
            activeTabId.value = existing.id
            return existing.id
        }

        const label = options.connectionName ?? resolveConnectionLabel(options.connectionId)
        const id = nextTabId('kafka-topics')
        tabs.value.push({
            id,
            title: label ? t('explorer.kafkaConsole.tabTitle', {name: label}) : t('explorer.kafkaConsole.title'),
            type: 'kafka-topics',
            closable: true,
            connectionId: options.connectionId,
            dbType: 'kafka',
            explorerNodeId: options.explorerNodeId,
            kafkaTopic: options.topic,
        })
        activeTabId.value = id
        return id
    }

    function openKafkaTopic(options: {
        connectionId: string
        connectionName?: string
        explorerNodeId?: string
        topic: string
    }) {
        return openKafkaTopics({
            connectionId: options.connectionId,
            connectionName: options.connectionName,
            explorerNodeId: options.explorerNodeId,
            topic: options.topic,
        })
    }

    function openKafkaConsumerGroups(options: {
        connectionId: string
        connectionName?: string
        explorerNodeId?: string
        topic?: string
    }) {
        const existing = tabs.value.find(
            (tab) =>
                tab.type === 'kafka-consumer-groups'
                && tab.connectionId === options.connectionId,
        )
        if (existing) {
            if (options.topic) existing.kafkaTopic = options.topic
            activeTabId.value = existing.id
            return existing.id
        }

        const label = options.connectionName ?? resolveConnectionLabel(options.connectionId)
        const id = nextTabId('kafka-consumer-groups')
        tabs.value.push({
            id,
            title: label
                ? t('explorer.kafkaConsumerGroups.tabTitle', {name: label})
                : t('explorer.kafkaConsumerGroups.title'),
            type: 'kafka-consumer-groups',
            closable: true,
            connectionId: options.connectionId,
            dbType: 'kafka',
            explorerNodeId: options.explorerNodeId,
            kafkaTopic: options.topic,
        })
        activeTabId.value = id
        return id
    }

    function openKafkaTablePublish(options: {
        kafkaConnectionId?: string
        kafkaConnectionName?: string
        explorerNodeId?: string
        lockKafkaConnection?: boolean
        source?: {
            connectionId: string
            connectionLabel?: string
            database: string
            tableName: string
        }
    }) {
        const source = options.source
        const kafkaId = options.kafkaConnectionId

        const existing = tabs.value.find((tab) => {
            if (tab.type !== 'kafka-table-publish') return false
            if (source) {
                return tab.kafkaPublishSourceConnectionId === source.connectionId
                    && tab.database === source.database
                    && tab.tableName === source.tableName
            }
            if (kafkaId) {
                return tab.connectionId === kafkaId && !tab.kafkaPublishSourceConnectionId
            }
            return false
        })

        if (existing) {
            if (kafkaId) existing.connectionId = kafkaId
            if (options.lockKafkaConnection) existing.kafkaPublishLockConnection = true
            activeTabId.value = existing.id
            return existing.id
        }

        const kafkaLabel = options.kafkaConnectionName
            ?? (kafkaId ? resolveConnectionLabel(kafkaId) : undefined)

        const title = source?.tableName
            ? t('explorer.kafkaTablePublish.tabTitleTable', {table: source.tableName})
            : kafkaLabel
                ? t('explorer.kafkaTablePublish.tabTitle', {name: kafkaLabel})
                : t('explorer.kafkaTablePublish.title')

        const id = nextTabId('kafka-table-publish')
        tabs.value.push({
            id,
            title,
            type: 'kafka-table-publish',
            closable: true,
            connectionId: kafkaId,
            dbType: 'kafka',
            explorerNodeId: options.explorerNodeId,
            kafkaPublishSourceConnectionId: source?.connectionId,
            kafkaPublishLockConnection: options.lockKafkaConnection ?? false,
            database: source?.database,
            tableName: source?.tableName,
        })
        activeTabId.value = id
        return id
    }

    function openTerminal() {
        const existing = tabs.value.find((tab) => tab.type === 'terminal')
        if (existing) {
            activeTabId.value = existing.id
            return existing.id
        }
        const id = nextTabId('terminal')
        tabs.value.push({
            id,
            title: t('terminal.title'),
            type: 'terminal',
            closable: true,
        })
        activeTabId.value = id
        return id
    }

    function openSchemaCompare(options?: {
        left?: WorkspaceTab['schemaCompareLeft']
        right?: WorkspaceTab['schemaCompareRight']
    }) {
        const existing = tabs.value.find((tab) => tab.type === 'schema-compare')
        if (existing) {
            if (options?.left) existing.schemaCompareLeft = options.left
            if (options?.right) existing.schemaCompareRight = options.right
            activeTabId.value = existing.id
            return existing.id
        }
        const id = nextTabId('schema')
        tabs.value.push({
            id,
            title: t('schemaCompare.tabTitle'),
            type: 'schema-compare',
            closable: true,
            schemaCompareLeft: options?.left,
            schemaCompareRight: options?.right,
        })
        activeTabId.value = id
        return id
    }

    function openSchemaEr(options: {
        connectionId: string
        database: string
        instanceId?: string
        explorerNodeId?: string
        focusTableName?: string
    }) {
        const existing = tabs.value.find(
            (tab) =>
                tab.type === 'schema-er'
                && tab.connectionId === options.connectionId
                && tab.database === options.database,
        )
        if (existing) {
            if (options.instanceId) existing.instanceId = options.instanceId
            if (options.explorerNodeId) existing.explorerNodeId = options.explorerNodeId
            if (options.focusTableName?.trim()) existing.tableName = options.focusTableName.trim()
            activeTabId.value = existing.id
            return existing.id
        }
        const id = nextTabId('schema-er')
        tabs.value.push({
            id,
            title: t('workspace.schemaEr.tabTitle', {database: options.database}),
            type: 'schema-er',
            closable: true,
            connectionId: options.connectionId,
            database: options.database,
            instanceId: options.instanceId,
            explorerNodeId: options.explorerNodeId,
            tableName: options.focusTableName?.trim() || undefined,
        })
        activeTabId.value = id
        return id
    }

    function openSchemaTables(options: {
        connectionId: string
        database: string
        instanceId?: string
        explorerNodeId?: string
    }) {
        const existing = tabs.value.find(
            (tab) =>
                tab.type === 'schema-tables'
                && tab.connectionId === options.connectionId
                && tab.database === options.database,
        )
        if (existing) {
            if (options.instanceId) existing.instanceId = options.instanceId
            if (options.explorerNodeId) existing.explorerNodeId = options.explorerNodeId
            activeTabId.value = existing.id
            return existing.id
        }
        const id = nextTabId('schema-tables')
        tabs.value.push({
            id,
            title: t('workspace.schemaTables.tabTitle', {database: options.database}),
            type: 'schema-tables',
            closable: true,
            connectionId: options.connectionId,
            database: options.database,
            instanceId: options.instanceId,
            explorerNodeId: options.explorerNodeId,
        })
        activeTabId.value = id
        return id
    }

    function openMetadataDoc(options: {
        connectionId: string
        database: string
        instanceId?: string
        explorerNodeId?: string
        title?: string
        html?: string
        markdown?: string
        fileName?: string
        loading?: boolean
        loadError?: string
        detailsLoading?: boolean
    }) {
        const existing = tabs.value.find(
            (tab) =>
                tab.type === 'metadoc'
                && tab.connectionId === options.connectionId
                && tab.database === options.database,
        )
        if (existing) {
            existing.metadocHtml = options.html ?? existing.metadocHtml
            existing.metadocMarkdown = options.markdown ?? existing.metadocMarkdown
            existing.metadocFileName = options.fileName ?? existing.metadocFileName
            existing.metadocLoading = options.loading ?? false
            existing.metadocLoadError = options.loadError ?? undefined
            existing.metadocDetailsLoading = options.detailsLoading ?? existing.metadocDetailsLoading ?? false
            existing.metadocView = existing.metadocView ?? 'preview'
            if (options.instanceId) existing.instanceId = options.instanceId
            if (options.explorerNodeId) existing.explorerNodeId = options.explorerNodeId
            if (options.title?.trim()) existing.title = options.title.trim()
            activeTabId.value = existing.id
            return existing.id
        }
        const id = nextTabId('metadoc')
        tabs.value.push({
            id,
            title: options.title?.trim() || t('workspace.metadoc.tabTitle', {database: options.database}),
            type: 'metadoc',
            closable: true,
            connectionId: options.connectionId,
            database: options.database,
            instanceId: options.instanceId,
            explorerNodeId: options.explorerNodeId,
            metadocHtml: options.html ?? '',
            metadocMarkdown: options.markdown ?? '',
            metadocFileName: options.fileName ?? '',
            metadocView: 'preview',
            metadocLoading: options.loading ?? false,
            metadocLoadError: options.loadError ?? undefined,
            metadocDetailsLoading: options.detailsLoading ?? false,
        })
        activeTabId.value = id
        return id
    }

    function openPlatformCatalog(options: {
        feature: PlatformFeatureId
        connectionId: string
        database: string
        instanceId?: string
        explorerNodeId?: string
    }) {
        const existing = tabs.value.find(
            (tab) =>
                tab.type === 'platform_catalog'
                && tab.platformFeature === options.feature
                && tab.connectionId === options.connectionId
                && tab.database === options.database,
        )
        if (existing) {
            if (options.instanceId) existing.instanceId = options.instanceId
            if (options.explorerNodeId) existing.explorerNodeId = options.explorerNodeId
            activeTabId.value = existing.id
            return existing.id
        }
        const id = nextTabId('platform-catalog')
        tabs.value.push({
            id,
            title: platformCatalogTabTitle(options.feature, options.database, t),
            type: 'platform_catalog',
            closable: true,
            connectionId: options.connectionId,
            database: options.database,
            instanceId: options.instanceId,
            explorerNodeId: options.explorerNodeId,
            platformFeature: options.feature,
        })
        activeTabId.value = id
        return id
    }

    function openCrossEnvCompare(options?: {
        left?: WorkspaceTab['crossEnvCompareLeft']
        right?: WorkspaceTab['crossEnvCompareRight']
        sql?: string
    }) {
        const existing = tabs.value.find((tab) => tab.type === 'cross-env-compare')
        if (existing) {
            if (options?.left) existing.crossEnvCompareLeft = options.left
            if (options?.right) existing.crossEnvCompareRight = options.right
            if (options?.sql?.trim()) existing.crossEnvCompareSql = options.sql.trim()
            activeTabId.value = existing.id
            return existing.id
        }
        const id = nextTabId('cross-env')
        tabs.value.push({
            id,
            title: t('crossEnvCompare.tabTitle'),
            type: 'cross-env-compare',
            closable: true,
            crossEnvCompareLeft: options?.left,
            crossEnvCompareRight: options?.right,
            crossEnvCompareSql: options?.sql?.trim() || undefined,
        })
        activeTabId.value = id
        return id
    }

    function openTableMigration(options: {
        source: NonNullable<WorkspaceTab['migrationSource']>
        preselectedTables?: string[]
    }) {
        const existing = tabs.value.find(
            (tab) =>
                tab.type === 'table-migration'
                && tab.migrationSource?.connectionId === options.source.connectionId
                && tab.migrationSource?.database === options.source.database,
        )
        if (existing) {
            if (options.preselectedTables?.length) {
                existing.migrationPreselectedTables = [
                    ...new Set([
                        ...(existing.migrationPreselectedTables ?? []),
                        ...options.preselectedTables,
                    ]),
                ]
            }
            activeTabId.value = existing.id
            return existing.id
        }

        const preselected = options.preselectedTables ?? []
        const title =
            preselected.length === 1
                ? t('tableMigration.tabTitleTable', {table: preselected[0]})
                : t('tableMigration.tabTitle', {database: options.source.database})

        const id = nextTabId('migration')
        tabs.value.push({
            id,
            title,
            type: 'table-migration',
            closable: true,
            migrationSource: options.source,
            migrationPreselectedTables: preselected.length ? preselected : undefined,
            connectionId: options.source.connectionId,
            database: options.source.database,
        })
        activeTabId.value = id
        return id
    }

    async function openViewModelEditor(options: {
        connectionId: string
        instanceId?: string | null
        database?: string
        viewModelName?: string
        sql?: string
        explorerNodeId?: string
    }) {
        const database = options.database
        const viewModelName = options.viewModelName?.trim()
            || await resolveNextViewModelNameForOpen({
                tabs: tabs.value,
                connectionId: options.connectionId,
                instanceId: options.instanceId,
                database,
            })

        const existing = tabs.value.find(
            (tab) =>
                tab.type === 'view_model_editor'
                && tab.viewModelName === viewModelName
                && tab.connectionId === options.connectionId
                && (database ? tab.database === database : tab.instanceId === options.instanceId),
        )
        if (existing) {
            if (options.sql !== undefined) {
                existing.viewModelSql = options.sql
            }
            if (options.explorerNodeId) existing.explorerNodeId = options.explorerNodeId
            activeTabId.value = existing.id
            return existing.id
        }

        let sql = options.sql ?? ''
        let isDraft = false
        if (options.sql === undefined && database) {
            try {
                const result = await viewModelApi.read({
                    connectionId: options.connectionId,
                    instanceName: database,
                    name: viewModelName,
                })
                sql = result.sql
                isDraft = Boolean(result.draft)
            } catch {
                sql = ''
            }
        }

        const id = nextTabId('vm-editor')
        tabs.value.push({
            id,
            title: viewModelName,
            type: 'view_model_editor',
            closable: true,
            viewModelName,
            viewModelSql: sql,
            viewModelSavedSql: sql,
            viewModelIsDraft: isDraft,
            connectionId: options.connectionId,
            instanceId: options.instanceId,
            database,
            explorerNodeId: options.explorerNodeId,
        })
        activeTabId.value = id
        return id
    }

    function openViewModelData(options: {
        viewModelName: string
        viewModelSql: string
        connectionId: string
        instanceId?: string | null
        database?: string
        explorerNodeId?: string
    }) {
        const existing = tabs.value.find(
            (tab) =>
                tab.type === 'view_model'
                && tab.viewModelName === options.viewModelName
                && tab.connectionId === options.connectionId
                && (options.database ? tab.database === options.database : tab.instanceId === options.instanceId),
        )
        if (existing) {
            existing.viewModelSql = options.viewModelSql
            if (options.explorerNodeId) existing.explorerNodeId = options.explorerNodeId
            activeTabId.value = existing.id
            return existing.id
        }
        const id = nextTabId('viewmodel')
        tabs.value.push({
            id,
            title: options.viewModelName,
            type: 'view_model',
            closable: true,
            viewModelName: options.viewModelName,
            viewModelSql: options.viewModelSql,
            connectionId: options.connectionId,
            instanceId: options.instanceId,
            database: options.database,
            explorerNodeId: options.explorerNodeId,
        })
        activeTabId.value = id
        return id
    }

    function openViewModelLineage(options: {
        viewModelName: string
        connectionId: string
        instanceId?: string | null
        database?: string
        explorerNodeId?: string
    }) {
        const existing = tabs.value.find(
            (tab) =>
                tab.type === 'view_model_lineage'
                && tab.viewModelName === options.viewModelName
                && tab.connectionId === options.connectionId
                && (options.database ? tab.database === options.database : tab.instanceId === options.instanceId),
        )
        if (existing) {
            if (options.explorerNodeId) existing.explorerNodeId = options.explorerNodeId
            activeTabId.value = existing.id
            return existing.id
        }
        const id = nextTabId('lineage')
        tabs.value.push({
            id,
            title: t('lineage.tabTitle', {name: options.viewModelName}),
            type: 'view_model_lineage',
            closable: true,
            viewModelName: options.viewModelName,
            connectionId: options.connectionId,
            instanceId: options.instanceId,
            database: options.database,
            explorerNodeId: options.explorerNodeId,
        })
        activeTabId.value = id
        return id
    }

    async function openViewModelConsole(options: {
        viewModelName: string
        sql: string
        connectionId: string
        connectionName?: string
        instanceId?: string | null
        database?: string
        explorerNodeId?: string
    }) {
        return openViewModelEditor({
            connectionId: options.connectionId,
            instanceId: options.instanceId,
            database: options.database,
            viewModelName: options.viewModelName,
            sql: options.sql,
            explorerNodeId: options.explorerNodeId,
        })
    }

    function openViewModelMigration(options: {
        source: NonNullable<WorkspaceTab['migrationSource']>
        viewModelName: string
        sourceSelectSql: string
        targetTableName?: string
    }) {
        const id = nextTabId('migration')
        tabs.value.push({
            id,
            title: t('tableMigration.tabTitleViewModel', {name: options.viewModelName}),
            type: 'table-migration',
            closable: true,
            migrationSource: options.source,
            migrationPreselectedTables: [options.viewModelName],
            migrationSourceSelectSql: options.sourceSelectSql,
            migrationTargetTableName: options.targetTableName,
            connectionId: options.source.connectionId,
            database: options.source.database,
        })
        activeTabId.value = id
        return id
    }

    function isTabDirty(tabId: string): boolean {
        const tab = tabs.value.find((item) => item.id === tabId)
        if (!tab) return false
        if (tab.type === 'view_model_editor') {
            return (tab.viewModelSql ?? '').trim() !== (tab.viewModelSavedSql ?? '').trim()
        }
        return isConsoleTabDirty(tab)
    }

    function markConsoleTabSaved(tabId: string, sql?: string) {
        const tab = tabs.value.find((item) => item.id === tabId)
        if (!tab || tab.type !== 'console') return
        tab.savedSql = sql ?? tab.sql ?? ''
    }

    async function saveConsoleTab(tabId: string): Promise<boolean> {
        const tab = tabs.value.find((item) => item.id === tabId)
        if (!tab || tab.type !== 'console') return false

        let fileName = getBoundConsoleSqlFile(tab)
        if (!fileName) {
            const scope = resolveConsoleTabSaveScope(tab)
            if (!scope) return false
            fileName = await resolveNextConsoleScriptFile({
                connectionId: scope.connectionId,
                instanceName: scope.instanceName,
            })
            if (!fileName) return false
        }

        return persistConsoleTabSql(tab, fileName, {bindToTab: true})
    }

    async function saveConsoleStatementAsFile(tabId: string, statementSql: string): Promise<boolean> {
        const tab = tabs.value.find((item) => item.id === tabId)
        if (!tab || tab.type !== 'console') return false
        const sql = statementSql.trim()
        if (!sql) return false

        const scope = resolveConsoleTabSaveScope(tab)
        if (!scope) return false

        const fileName = await resolveNextConsoleScriptFile({
            connectionId: scope.connectionId,
            instanceName: scope.instanceName,
        })
        if (!fileName) return false
        return persistConsoleTabSql(tab, fileName, {bindToTab: false, sql})
    }

    async function saveConsoleTabAsMigration(tabId: string, fileName: string): Promise<boolean> {
        const tab = tabs.value.find((item) => item.id === tabId)
        if (!tab || tab.type !== 'console') return false
        const normalized = fileName.trim()
        if (!normalized) return false
        return persistConsoleTabSql(tab, normalized, {bindToTab: false})
    }

    function resolveConsoleTabSaveScope(tab: WorkspaceTab): {
        connectionId: string
        instanceName: string
        scopeNodeId: string | null | undefined
    } | null {
        const connectionId = tab.connectionId
        if (!connectionId) return null

        const explorer = useExplorerStore()
        const connectionNode = explorer.findNode(connectionId)
        const dbType = connectionNode?.dbType
        const instanceName = resolveConsoleWorkspaceInstance({
            dbType,
            sql: tab.sql ?? '',
            tabDatabase: tab.database,
            tree: explorer.tree,
            connectionId,
            selectedNodeId: explorer.selectedNodeId,
            findNode: (nodeId) => explorer.findNode(nodeId) ?? null,
        })
        if (!instanceName) return null

        const scopeNodeId = resolveWorkspaceInstanceNodeId(
            explorer.tree,
            connectionId,
            instanceName,
            dbType,
        )
        return {connectionId, instanceName, scopeNodeId: scopeNodeId ?? tab.instanceId}
    }

    async function persistConsoleTabSql(
        tab: WorkspaceTab,
        fileName: string,
        options: { bindToTab: boolean; sql?: string },
    ): Promise<boolean> {
        const scope = resolveConsoleTabSaveScope(tab)
        if (!scope) return false
        const sql = (options.sql ?? tab.sql ?? '').trim()
        if (!sql) return false

        try {
            const result = await instanceSqlApi.save({
                connectionId: scope.connectionId,
                instanceName: scope.instanceName,
                sql,
                fileName,
            })
            if (options.bindToTab) {
                bindConsoleSqlFile(tab.id, result.fileName)
                updateTabContext(tab.id, {
                    connectionId: scope.connectionId,
                    database: scope.instanceName,
                    instanceId: scope.scopeNodeId ?? tab.instanceId,
                })
                markConsoleTabSaved(tab.id)
            }
            setStatus(t('console.savedToWorkspace', {path: result.relativePath}))
            useLayoutStore().showToast(t('console.savedToWorkspace', {path: result.relativePath}))
            try {
                const explorer = useExplorerStore()
                await explorer.reloadWorkspacesFolder(
                    scope.connectionId,
                    scope.instanceName,
                    scope.scopeNodeId ?? tab.instanceId,
                )
            } catch (reloadError) {
                console.error('[reloadWorkspacesFolder]', reloadError)
            }
            return true
        } catch (error) {
            console.error('[persistConsoleTabSql]', error)
            return false
        }
    }

    function closeTab(tabId: string) {
        const tab = tabs.value.find((t) => t.id === tabId)
        if (!tab?.closable) return
        const idx = tabs.value.findIndex((t) => t.id === tabId)
        tabs.value.splice(idx, 1)
        delete consoleQueryByTabId.value[tabId]
        if (activeTabId.value === tabId) {
            activeTabId.value = tabs.value[Math.max(0, idx - 1)]?.id ?? null
        }
    }

    function closeConsoleTabsForSqlFile(options: {
        connectionId: string
        instanceId?: string | null
        fileName: string
    }) {
        const fileName = options.fileName.trim()
        if (!fileName) return

        const tabIds = tabs.value
            .filter(
                (tab) =>
                    tab.type === 'console' &&
                    tab.connectionId === options.connectionId &&
                    tab.sqlFile === fileName &&
                    (options.instanceId == null || tab.instanceId === options.instanceId),
            )
            .map((tab) => tab.id)

        for (const tabId of tabIds) {
            closeTab(tabId)
        }
    }

    function closeTableTabs(options: {
        connectionId?: string
        database?: string
        tableName: string
    }) {
        const tableName = options.tableName.trim()
        if (!tableName) return

        const tabIds = tabs.value
            .filter(
                (tab) =>
                    tab.type === 'table' &&
                    tab.tableName === tableName &&
                    (!options.connectionId || tab.connectionId === options.connectionId) &&
                    (!options.database || tab.database === options.database),
            )
            .map((tab) => tab.id)

        for (const tabId of tabIds) {
            closeTab(tabId)
        }
    }

    function closeOthers(tabId: string) {
        tabs.value = tabs.value.filter((t) => t.id === tabId)
        activeTabId.value = tabId
    }

    function closeTabsToLeft(tabId: string) {
        const idx = tabs.value.findIndex((t) => t.id === tabId)
        if (idx <= 0) return
        const removeIds = tabs.value
            .slice(0, idx)
            .filter((t) => t.closable)
            .map((t) => t.id)
        removeIds.forEach((id) => delete consoleQueryByTabId.value[id])
        tabs.value = tabs.value.filter((t) => !removeIds.includes(t.id))
        if (!tabs.value.some((t) => t.id === activeTabId.value)) {
            activeTabId.value = tabId
        }
    }

    function closeTabsToRight(tabId: string) {
        const idx = tabs.value.findIndex((t) => t.id === tabId)
        if (idx < 0 || idx >= tabs.value.length - 1) return
        const removeIds = tabs.value
            .slice(idx + 1)
            .filter((t) => t.closable)
            .map((t) => t.id)
        removeIds.forEach((id) => delete consoleQueryByTabId.value[id])
        tabs.value = tabs.value.filter((t) => !removeIds.includes(t.id))
        if (!tabs.value.some((t) => t.id === activeTabId.value)) {
            activeTabId.value = tabId
        }
    }

    function getTabTitle(tabId: string) {
        return tabs.value.find((t) => t.id === tabId)?.title ?? ''
    }

    function renameTab(tabId: string, title: string) {
        const tab = tabs.value.find((t) => t.id === tabId)
        if (!tab) return false
        const next = title.trim()
        if (!next) return false
        tab.title = next
        return true
    }

    async function renameConsoleTab(tabId: string, newLabel: string) {
        const tab = tabs.value.find((item) => item.id === tabId)
        if (!tab || tab.type !== 'console') return false

        const label = (() => {
            const parsedInput = parseConsoleTabTitle(newLabel)
            return (parsedInput.hasHostPrefix ? parsedInput.editableLabel : newLabel).trim()
        })()
        if (!label) return false

        const newBaseName = sqlFileNameFromTabLabel(label)
        if (!newBaseName) return false

        if (!tab.connectionId) return false

        const explorer = useExplorerStore()
        const instanceName = resolveConsoleInstanceLabel({
            tabInstanceId: tab.instanceId,
            tabDatabase: tab.database,
            findNodeLabel: (nodeId) => explorer.findNode(nodeId)?.label,
        })
        if (!instanceName) return false

        let currentFileName = resolveConsoleSqlFileName(tab)
        if (!currentFileName) {
            const saved = await saveConsoleTab(tabId)
            if (!saved) return false
            currentFileName = getBoundConsoleSqlFile(tab)
            if (!currentFileName) return false
        }

        const parsed = parseConsoleTabTitle(tab.title)
        const hostLabel = parsed.hostLabel

        if (isSameConsoleTabLabel(currentFileName, label)) {
            tab.title = resolveConsoleTabTitle({
                connectionHost: hostLabel,
                sqlFile: currentFileName,
                kind: 'script',
            }) ?? buildConsoleTabTitleFromParts(hostLabel, formatSqlFileTabLabel(currentFileName))
            if (!tab.database) tab.database = instanceName
            return true
        }

        try {
            if (isConsoleTabDirty(tab)) {
                await instanceSqlApi.save({
                    connectionId: tab.connectionId,
                    instanceName,
                    sql: tab.sql ?? '',
                    fileName: currentFileName,
                })
            }

            const result = await instanceSqlApi.rename({
                connectionId: tab.connectionId,
                instanceName,
                oldFileName: currentFileName,
                newFileName: newBaseName,
            })
            tab.sqlFile = result.fileName
            tab.database = instanceName
            tab.explorerNodeId = undefined
            tab.title = resolveConsoleTabTitle({
                connectionHost: hostLabel,
                sqlFile: result.fileName,
                kind: 'script',
            }) ?? buildConsoleTabTitleFromParts(hostLabel, formatSqlFileTabLabel(result.fileName))
            markConsoleTabSaved(tabId)
            return true
        } catch (error) {
            console.error('[renameConsoleTab]', error)
            return false
        }
    }

    async function renameViewModelTab(tabId: string, newName: string): Promise<boolean> {
        const tab = tabs.value.find((item) => item.id === tabId)
        if (!tab || tab.type !== 'view_model_editor') return false

        const trimmed = stripViewModelDisplayName(newName)
        if (!isValidViewModelBaseName(trimmed)) return false

        const oldName = tab.viewModelName?.trim() ?? tab.title.trim()
        if (oldName === trimmed) {
            tab.viewModelName = trimmed
            tab.title = trimmed
            return true
        }

        if (!tab.connectionId) return false
        const explorer = useExplorerStore()
        const instanceName = resolveConsoleInstanceLabel({
            tabInstanceId: tab.instanceId,
            tabDatabase: tab.database,
            findNodeLabel: (nodeId) => explorer.findNode(nodeId)?.label,
        })
        if (!instanceName) return false

        const hasPersisted = Boolean(tab.viewModelSavedSql?.trim())
        if (hasPersisted) {
            try {
                await viewModelApi.rename({
                    connectionId: tab.connectionId,
                    instanceName,
                    oldName,
                    newName: trimmed,
                })
                await explorer.reloadViewsFolder(tab.connectionId, instanceName, tab.instanceId)
            } catch (error) {
                console.error('[renameViewModelTab]', error)
                return false
            }
        }

        tab.viewModelName = trimmed
        tab.title = trimmed
        return true
    }

    function bindConsoleSqlFile(tabId: string, fileName: string) {
        const tab = tabs.value.find((item) => item.id === tabId)
        if (!tab || tab.type !== 'console') return
        tab.sqlFile = fileName
        tab.explorerNodeId = undefined
        const parsed = parseConsoleTabTitle(tab.title)
        const nextTitle = resolveConsoleTabTitle({
            connectionHost: parsed.hostLabel,
            sqlFile: fileName,
            kind: 'script',
        })
        if (nextTitle) tab.title = nextTitle
        markConsoleTabSaved(tabId)
    }

    function closeAllClosable() {
        tabs.value = []
        activeTabId.value = null
    }

    function setExecutionResult(rows: number, durationMs: number) {
        status.value = {
            message: '',
            duration: `${durationMs}ms`,
            durationMs,
            rowCount: t('workspace.rowCount', {count: rows}),
        }
    }

    function ensureConsoleQueryState(tabId: string): ConsoleQueryState {
        if (!consoleQueryByTabId.value[tabId]) {
            consoleQueryByTabId.value[tabId] = {
                results: [],
                activeView: 'overview',
            }
        }
        return consoleQueryByTabId.value[tabId]
    }

    function getConsoleQueryState(tabId: string): ConsoleQueryState {
        return ensureConsoleQueryState(tabId)
    }

    function renumberResultLabels(results: QueryResultItem[]) {
        results.forEach((item, index) => {
            item.label = t('queryResult.resultTab', {n: index + 1})
        })
    }

    /** 替换控制台当前一次执行的全部结果 Tab */
    function setConsoleQueryResults(tabId: string, results: QueryResultItem[]) {
        const nextResults = results.map((item, index) => ({
            ...item,
            id: item.id || `result-${index}-${Date.now()}`,
            label: item.label || t('queryResult.resultTab', {n: index + 1}),
        }))

        const activeView: ConsoleQueryState['activeView'] =
            nextResults.length === 0 ? 'overview' : nextResults.length - 1

        consoleQueryByTabId.value = {
            ...consoleQueryByTabId.value,
            [tabId]: {
                results: nextResults,
                activeView,
            },
        }
    }

    /** 刷新单个结果 Tab 时原地更新，保留其它 Tab 与当前视图 */
    function updateConsoleQueryResultAtIndex(
        tabId: string,
        index: number,
        item: QueryResultItem,
    ) {
        consoleQueryByTabId.value = replaceConsoleQueryResultAtIndex(
            consoleQueryByTabId.value,
            tabId,
            index,
            item,
        )
    }

    function appendConsoleQueryResultPage(tabId: string, index: number, item: QueryResultItem) {
        updateConsoleQueryResultAtIndex(tabId, index, item)
        recalculateConsoleExecutionTotals(tabId)
    }

    function recalculateConsoleExecutionTotals(tabId: string) {
        const state = consoleQueryByTabId.value[tabId]
        if (!state) return
        const {totalRows, totalDuration} = sumConsoleQueryTotals(state.results)
        setExecutionResult(totalRows, totalDuration)
    }

    function setConsoleActiveView(tabId: string, view: 'overview' | number) {
        const state = consoleQueryByTabId.value[tabId]
        if (!state) return
        consoleQueryByTabId.value = {
            ...consoleQueryByTabId.value,
            [tabId]: {
                ...state,
                activeView: view,
            },
        }
    }

    function closeConsoleQueryResult(tabId: string, index: number) {
        const state = consoleQueryByTabId.value[tabId]
        if (!state || index < 0 || index >= state.results.length) return

        state.results.splice(index, 1)
        renumberResultLabels(state.results)

        if (state.results.length === 0) {
            state.activeView = 'overview'
            return
        }

        const current = state.activeView
        if (current === 'overview') return

        if (current === index) {
            state.activeView = Math.min(index, state.results.length - 1)
        } else if (current > index) {
            state.activeView = current - 1
        }
    }

    function closeOtherConsoleQueryResults(tabId: string, keepIndex: number) {
        const state = consoleQueryByTabId.value[tabId]
        if (!state?.results[keepIndex]) return

        state.results = [state.results[keepIndex]]
        renumberResultLabels(state.results)
        state.activeView = 0
    }

    function closeConsoleQueryResultsToLeft(tabId: string, index: number) {
        const state = consoleQueryByTabId.value[tabId]
        if (!state || index <= 0) return

        state.results.splice(0, index)
        renumberResultLabels(state.results)

        if (state.results.length === 0) {
            state.activeView = 'overview'
            return
        }

        if (state.activeView === 'overview') return
        if (typeof state.activeView === 'number') {
            state.activeView = Math.max(0, state.activeView - index)
        }
    }

    function closeConsoleQueryResultsToRight(tabId: string, index: number) {
        const state = consoleQueryByTabId.value[tabId]
        if (!state || index < 0 || index >= state.results.length - 1) return

        state.results.splice(index + 1)
        renumberResultLabels(state.results)

        if (typeof state.activeView === 'number' && state.activeView > index) {
            state.activeView = index
        }
    }

    function getConsoleQueryResultLabel(tabId: string, index: number) {
        return consoleQueryByTabId.value[tabId]?.results[index]?.label ?? ''
    }

    function renameConsoleQueryResult(tabId: string, index: number, label: string) {
        const state = consoleQueryByTabId.value[tabId]
        if (!state?.results[index]) return false
        const next = label.trim()
        if (!next) return false
        state.results[index].label = next
        return true
    }

    function closeAllConsoleQueryResults(tabId: string) {
        const state = consoleQueryByTabId.value[tabId]
        if (!state) return
        state.results = []
        state.activeView = 'overview'
    }

    function updateTabSql(tabId: string, sql: string) {
        const tab = tabs.value.find((item) => item.id === tabId)
        if (tab && tab.sql !== sql) tab.sql = sql
    }

    function updateConsoleSqlFile(options: {
        connectionId: string
        instanceId: string
        oldFileName: string
        newFileName: string
        connectionName?: string
    }) {
        for (const tab of tabs.value) {
            if (
                tab.type !== 'console' ||
                tab.connectionId !== options.connectionId ||
                tab.instanceId !== options.instanceId ||
                tab.sqlFile !== options.oldFileName
            ) {
                continue
            }
            tab.sqlFile = options.newFileName
            const nextTitle = resolveConsoleTabTitle({
                connectionName: options.connectionName,
                sqlFile: options.newFileName,
                kind: 'script',
            })
            if (nextTitle) tab.title = nextTitle
            markConsoleTabSaved(tab.id)
        }
    }

    function updateTabContext(
        tabId: string,
        ctx: {
            connectionId?: string
            instanceId?: string | null
            database?: string
            explorerNodeId?: string | null
            kafkaTopic?: string
        },
    ) {
        const tab = tabs.value.find((item) => item.id === tabId)
        if (!tab) return
        const prevConnectionId = tab.connectionId
        const prevInstanceId = tab.instanceId
        const prevDatabase = tab.database

        if (ctx.connectionId !== undefined) tab.connectionId = ctx.connectionId
        if (ctx.instanceId !== undefined) tab.instanceId = ctx.instanceId
        if (ctx.database !== undefined) tab.database = ctx.database
        if (ctx.explorerNodeId !== undefined) tab.explorerNodeId = ctx.explorerNodeId ?? undefined
        if (ctx.kafkaTopic !== undefined) tab.kafkaTopic = ctx.kafkaTopic

        const contextChanged =
            (ctx.connectionId !== undefined && ctx.connectionId !== prevConnectionId)
            || (ctx.instanceId !== undefined && ctx.instanceId !== prevInstanceId)
            || (ctx.database !== undefined && ctx.database !== prevDatabase)

        if (tab.type === 'console' && tab.connectionId && contextChanged && !getBoundConsoleSqlFile(tab)) {
            ensureConsoleTabScriptFile(tab)
            const nextTitle = syncConsoleTabTitle(tab, resolveConnectionLabel(tab.connectionId))
            if (nextTitle && nextTitle !== tab.title) tab.title = nextTitle
        }
    }

    function setStatus(message: string) {
        status.value = {...status.value, message}
    }

    function tabIdPrefix(type: WorkspaceTab['type']) {
        if (type === 'console') return 'console'
        if (type === 'table') return 'table'
        if (type === 'terminal') return 'terminal'
        if (type === 'connection') return 'connection'
        if (type === 'schema-compare') return 'schema'
        if (type === 'schema-er') return 'schema-er'
        if (type === 'schema-tables') return 'schema-tables'
        if (type === 'metadoc') return 'metadoc'
        if (type === 'cross-env-compare') return 'cross-env'
        if (type === 'table-migration') return 'migration'
        if (type === 'redis-key') return 'redis'
        if (type === 'redis-console') return 'redis-console'
        if (type === 'kafka-topics') return 'kafka-topics'
        if (type === 'kafka-topic') return 'kafka-topic'
        if (type === 'kafka-consumer-groups') return 'kafka-consumer-groups'
        if (type === 'kafka-table-publish') return 'kafka-table-publish'
        if (type === 'platform_catalog') return 'platform-catalog'
        if (type === 'view_model_lineage') return 'lineage'
        return 'tab'
    }

    function restoreSession(snapshots: WorkspaceTabSnapshot[], activeTabIndex = 0) {
        if (!snapshots.length) return

        tabs.value = []
        consoleQueryByTabId.value = {}

        for (const snap of snapshots) {
            const id = nextTabId(tabIdPrefix(snap.type))
            tabs.value.push({
                id,
                title: snap.title,
                type: snap.type,
                closable: true,
                sql: snap.sql,
                savedSql: snap.savedSql ?? (snap.type === 'console' ? (snap.sql ?? '') : undefined),
                sqlFile: snap.sqlFile,
                tableName: snap.tableName,
                connectionId: snap.connectionId,
                instanceId: snap.instanceId,
                database: snap.database,
                explorerNodeId: snap.explorerNodeId,
                dbType: snap.dbType,
                tableView: snap.tableView ?? (snap.type === 'table' ? 'properties' : undefined),
                tableSection: snap.tableSection ?? (snap.type === 'table' ? 'columns' : undefined),
                teamSharedQuery: snap.teamSharedQuery,
            })
            if (snap.type === 'console') ensureConsoleQueryState(id)
        }

        const index = Math.min(Math.max(0, activeTabIndex), tabs.value.length - 1)
        activeTabId.value = tabs.value[index]?.id ?? null
    }

    function captureSession() {
        return {
            tabs: captureWorkspaceTabs(tabs.value),
            activeTabIndex: tabs.value.findIndex((tab) => tab.id === activeTabId.value),
        }
    }

    function bumpTableDataRefresh(tabId: string) {
        tableDataRefreshSeq.value = {
            ...tableDataRefreshSeq.value,
            [tabId]: (tableDataRefreshSeq.value[tabId] ?? 0) + 1,
        }
    }

    function requestFakeDataDialog(tabId: string) {
        fakeDataDialogRequest.value = {tabId, nonce: Date.now()}
    }

    return {
        tabs,
        activeTabId,
        activeTab,
        hasOpenTabs,
        status,
        consoleQueryByTabId,
        tableDataRefreshSeq,
        fakeDataDialogRequest,
        bumpTableDataRefresh,
        requestFakeDataDialog,
        activateTab,
        openConsole,
        openTable,
        openConnectionForm,
        openTerminal,
        openSchemaCompare,
        openSchemaEr,
        openSchemaTables,
        openMetadataDoc,
        openPlatformCatalog,
        openCrossEnvCompare,
        openTableMigration,
        openViewModelData,
        openViewModelLineage,
        openViewModelEditor,
        openViewModelConsole,
        openViewModelMigration,
        openRedisKey,
        openRedisConsole,
        openKafkaTopics,
        openKafkaTopic,
        openKafkaConsumerGroups,
        openKafkaTablePublish,
        closeTab,
        closeConsoleTabsForSqlFile,
        closeTableTabs,
        isTabDirty,
        markConsoleTabSaved,
        saveConsoleTab,
        saveConsoleStatementAsFile,
        saveConsoleTabAsMigration,
        closeOthers,
        closeTabsToLeft,
        closeTabsToRight,
        getTabTitle,
        renameTab,
        renameConsoleTab,
        renameViewModelTab,
        bindConsoleSqlFile,
        closeAllClosable,
        setExecutionResult,
        getConsoleQueryState,
        setConsoleQueryResults,
        updateConsoleQueryResultAtIndex,
        appendConsoleQueryResultPage,
        recalculateConsoleExecutionTotals,
        setConsoleActiveView,
        closeConsoleQueryResult,
        closeOtherConsoleQueryResults,
        closeConsoleQueryResultsToLeft,
        closeConsoleQueryResultsToRight,
        getConsoleQueryResultLabel,
        renameConsoleQueryResult,
        closeAllConsoleQueryResults,
        updateTabSql,
        updateConsoleSqlFile,
        updateTabContext,
        setStatus,
        restoreSession,
        captureSession,
    }
})
