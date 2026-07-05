import type {TreeNode} from '@/core/types'
import {findAncestorByType} from '@/core/utils/tree'
import {fetchConnectionHost} from '@/features/explorer/services/resolve-connection-host'
import {resolveExplorerInstanceLabel} from '@/features/explorer/services/explorer-database-scope'
import {
    createEmptySqlScript,
    listInstanceSqlScripts,
    nextScriptFileName,
} from '@/features/explorer/services/sql-script.service'
import {useWorkspaceStore} from '@/features/workspace/stores/workspace'
import {instanceSqlApi} from '@/api'

export interface DatabaseConsoleContext {
    connectionId: string
    connectionName?: string
    connectionHost?: string
    databaseNode: Pick<TreeNode, 'id' | 'label'>
}

async function resolveDatabaseConsoleContext(
    tree: TreeNode[],
    databaseNode: Pick<TreeNode, 'id' | 'label'>,
    connectionName?: string,
): Promise<DatabaseConsoleContext | null> {
    const connectionId = findAncestorByType(tree, databaseNode.id, 'connection')?.id
    if (!connectionId) return null
    const connectionHost = await fetchConnectionHost(connectionId, connectionName)
    const connection = findAncestorByType(tree, databaseNode.id, 'connection')
    const instanceLabel =
        resolveExplorerInstanceLabel(tree, databaseNode.id, connection?.dbType) ?? databaseNode.label
    return {
        connectionId,
        connectionName,
        connectionHost,
        databaseNode: {id: databaseNode.id, label: instanceLabel},
    }
}

function openConsoleTab(options: {
    connectionId: string
    connectionName?: string
    instanceId: string
    instanceLabel: string
    connectionHost?: string
    sql?: string
    sqlFile?: string
}) {
    const workspace = useWorkspaceStore()
    workspace.openConsole({
        connectionId: options.connectionId,
        connectionName: options.connectionName,
        instanceId: options.instanceId,
        database: options.instanceLabel,
        sql: options.sql ?? '',
        sqlFile: options.sqlFile,
    })
}

/** SQL 编辑器：打开最近修改的脚本（F3） */
export async function openLatestSqlEditor(
    tree: TreeNode[],
    databaseNode: Pick<TreeNode, 'id' | 'label'>,
    connectionName?: string,
) {
    const ctx = await resolveDatabaseConsoleContext(tree, databaseNode, connectionName)
    if (!ctx) return

    try {
        const result = await instanceSqlApi.readLatest({
            connectionId: ctx.connectionId,
            instanceName: ctx.databaseNode.label,
        })
        if (result.relativePath) {
            openConsoleTab({
                connectionId: ctx.connectionId,
                connectionName: ctx.connectionName,
                connectionHost: ctx.connectionHost,
                instanceId: ctx.databaseNode.id,
                instanceLabel: ctx.databaseNode.label,
                sql: result.sql,
                sqlFile: result.fileName,
            })
            return
        }
    } catch {
        // fall through
    }

    openConsoleTab({
        connectionId: ctx.connectionId,
        connectionName: ctx.connectionName,
        connectionHost: ctx.connectionHost,
        instanceId: ctx.databaseNode.id,
        instanceLabel: ctx.databaseNode.label,
    })
}

/** 打开指定 workspaces SQL 脚本 */
export async function openSqlScriptFile(
    ctx: DatabaseConsoleContext,
    fileName: string,
) {
    const result = await instanceSqlApi.read({
        connectionId: ctx.connectionId,
        instanceName: ctx.databaseNode.label,
        fileName,
    })
    openConsoleTab({
        connectionId: ctx.connectionId,
        connectionName: ctx.connectionName,
        connectionHost: ctx.connectionHost,
        instanceId: ctx.databaseNode.id,
        instanceLabel: ctx.databaseNode.label,
        sql: result.sql,
        sqlFile: result.fileName,
    })
}

/** 新建 SQL 编辑器（Script-N.sql） */
export async function createNewSqlEditor(
    tree: TreeNode[],
    databaseNode: Pick<TreeNode, 'id' | 'label'>,
    connectionName?: string,
) {
    const ctx = await resolveDatabaseConsoleContext(tree, databaseNode, connectionName)
    if (!ctx) return

    const files = await listInstanceSqlScripts({
        connectionId: ctx.connectionId,
        instanceName: ctx.databaseNode.label,
    })
    const fileName = nextScriptFileName(files)
    await createEmptySqlScript({
        connectionId: ctx.connectionId,
        instanceId: ctx.databaseNode.id,
        instanceName: ctx.databaseNode.label,
        fileName,
    })
    await openSqlScriptFile(ctx, fileName)
}

/** 打开空白 SQL 控制台（首次保存时创建脚本文件） */
export async function openBlankSqlConsole(
    tree: TreeNode[],
    databaseNode: Pick<TreeNode, 'id' | 'label'>,
    connectionName?: string,
) {
    const ctx = await resolveDatabaseConsoleContext(tree, databaseNode, connectionName)
    if (!ctx) return

    openConsoleTab({
        connectionId: ctx.connectionId,
        connectionName: ctx.connectionName,
        connectionHost: ctx.connectionHost,
        instanceId: ctx.databaseNode.id,
        instanceLabel: ctx.databaseNode.label,
    })
}

export async function buildDatabaseConsoleContext(
    tree: TreeNode[],
    databaseNode: Pick<TreeNode, 'id' | 'label'>,
    connectionName?: string,
) {
    return resolveDatabaseConsoleContext(tree, databaseNode, connectionName)
}
