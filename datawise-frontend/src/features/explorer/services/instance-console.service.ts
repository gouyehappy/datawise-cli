import type {TreeNode} from '@/core/types'
import {findAncestorByType} from '@/core/utils/tree'
import {fetchConnectionHost} from '@/features/explorer/services/resolve-connection-host'
import {
    resolveExplorerInstanceLabel,
    resolveExplorerSqlFileScope,
} from '@/features/explorer/services/explorer-database-scope'
import {resolveConsoleTabTitle} from '@/features/workspace/services/console-tab-title'
import {useWorkspaceStore} from '@/features/workspace/stores/workspace'
import {instanceSqlApi} from '@/api'

function openConsoleWithSql(options: {
    connectionId: string
    connectionName?: string
    connectionHost?: string
    instanceId: string
    instanceLabel: string
    fileName: string
    sql: string
    explorerNodeId?: string
}) {
    const workspace = useWorkspaceStore()
    workspace.openConsole({
        connectionId: options.connectionId,
        connectionName: options.connectionName,
        instanceId: options.instanceId,
        database: options.instanceLabel,
        sql: options.sql,
        sqlFile: options.fileName,
        explorerNodeId: options.explorerNodeId,
        title: resolveConsoleTabTitle({
            connectionHost: options.connectionHost,
            connectionName: options.connectionName,
            sqlFile: options.fileName,
            kind: 'script',
        }),
    })
}

/** 打开实例控制台：优先加载 workspaces 下最近保存的 .sql */
export async function openInstanceConsole(options: {
    tree: TreeNode[]
    connectionId: string
    connectionName?: string
    databaseNode: Pick<TreeNode, 'id' | 'label'>
}) {
    const {tree, connectionId, connectionName, databaseNode} = options
    const connectionHost = await fetchConnectionHost(connectionId, connectionName)
    const connection = findAncestorByType(tree, databaseNode.id, 'connection')
    const instanceLabel =
        resolveExplorerInstanceLabel(tree, databaseNode.id, connection?.dbType) ?? databaseNode.label

    try {
        const result = await instanceSqlApi.readLatest({
            connectionId,
            instanceName: instanceLabel,
        })
        if (result.relativePath) {
            openConsoleWithSql({
                connectionId,
                connectionName,
                connectionHost,
                instanceId: databaseNode.id,
                instanceLabel,
                fileName: result.fileName,
                sql: result.sql,
            })
            return
        }
    } catch {
        // fall through to empty console
    }

    const workspace = useWorkspaceStore()
    workspace.openConsole({
        connectionId,
        connectionName,
        instanceId: databaseNode.id,
        database: instanceLabel,
    })
}

/** 打开 workspaces 目录下的指定 SQL 文件 */
export async function openSqlFileFromTree(tree: TreeNode[], node: TreeNode) {
    const connectionId = findAncestorByType(tree, node.id, 'connection')?.id
    const scope = resolveExplorerSqlFileScope(tree, node.id)
    if (!connectionId || !scope) return false

    const connectionName = findAncestorByType(tree, node.id, 'connection')?.label
    const connectionHost = await fetchConnectionHost(connectionId, connectionName)
    const result = await instanceSqlApi.read({
        connectionId,
        instanceName: scope.instanceLabel,
        fileName: node.label,
    })
    openConsoleWithSql({
        connectionId,
        connectionName,
        connectionHost,
        instanceId: scope.scopeNode.id,
        instanceLabel: scope.instanceLabel,
        fileName: node.label,
        sql: result.sql,
        explorerNodeId: node.id,
    })
    return true
}
