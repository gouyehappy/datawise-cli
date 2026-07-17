import type {
    ExplorerApi,
    ExplorerConnectionResult,
    ExplorerGroupResult,
    ExplorerImportResult,
    ExplorerLoadChildrenResult,
    ConnectionTestResult,
} from '@/shared/api/types'
import type {ConnectionConfig, TreeNode} from '@/core/types'
import type {ApiResponse} from '@/shared/api/types'
import {deleteJson, getJson, postJson, putJson, requireBaseUrl} from '@/shared/api/http/request'
import {API_PATHS} from '@/shared/api/http/paths'

function sessionHeaders(extra?: Record<string, string>): Record<string, string> {
    const headers: Record<string, string> = {...(extra ?? {})}
    if (typeof localStorage !== 'undefined') {
        const sessionId = localStorage.getItem('dw-cli-session-id')
        if (sessionId) {
            headers['X-DW-Session-Id'] = sessionId
        }
    }
    return headers
}

async function getExplorerChildren(
    path: string,
    query?: Record<string, string | undefined>,
    options?: { silent?: boolean; ifNoneMatch?: string },
): Promise<ExplorerLoadChildrenResult> {
    const params = new URLSearchParams()
    if (query) {
        for (const [key, value] of Object.entries(query)) {
            if (value !== undefined && value !== '') {
                params.set(key, value)
            }
        }
    }
    const qs = params.toString()
    const baseUrl = requireBaseUrl()
    let url = baseUrl ? `${baseUrl}${path}` : path
    if (qs) {
        url += path.includes('?') ? `&${qs}` : `?${qs}`
    }
    const headers = sessionHeaders(
        options?.ifNoneMatch ? {'If-None-Match': options.ifNoneMatch} : undefined,
    )
    const response = await fetch(url, {
        method: 'GET',
        headers,
        credentials: 'include',
    })
    if (response.status === 304) {
        const responseEtag = response.headers.get('etag')
        return {
            tree: [],
            unchanged: true,
            etag: responseEtag ?? options?.ifNoneMatch ?? null,
        }
    }
    let payload: ApiResponse<{
        tree: TreeNode[]
        hasMore?: boolean
        nextOffset?: number
        etag?: string
    }>
    try {
        payload = (await response.json()) as typeof payload
    } catch {
        throw new Error('HTTP API request failed.')
    }
    if (!response.ok || payload.code !== 0) {
        throw new Error(payload.msg?.trim() || `HTTP ${response.status}`)
    }
    const data = payload.data
    return {
        tree: data.tree ?? [],
        hasMore: data.hasMore ?? undefined,
        nextOffset: data.nextOffset ?? undefined,
        etag: response.headers.get('etag') ?? data.etag ?? null,
    }
}

export function createHttpExplorerApi(): ExplorerApi {
    return {
        fetchTree: async (options) => {
            const data = await getJson<{ tree: TreeNode[] }>(API_PATHS.explorer.tree, {
                refresh: options?.refresh ? 'true' : undefined,
            })
            return data.tree
        },

        loadChildren: async (connectionId, nodeId, options) => {
            const params: Record<string, string | undefined> = {}
            if (options?.pattern) {
                params.pattern = options.pattern
            }
            if (options?.refresh) {
                params.refresh = 'true'
            }
            if (options?.offset != null) {
                params.offset = String(options.offset)
            }
            if (options?.limit != null) {
                params.limit = String(options.limit)
            }
            if (options?.skeleton === false) {
                params.skeleton = 'false'
            }
            return getExplorerChildren(
                API_PATHS.explorer.nodeChildren(connectionId, nodeId),
                params,
                {silent: options?.silent, ifNoneMatch: options?.ifNoneMatch},
            )
        },

        fetchRedisKey: async (connectionId, key, options) =>
            getJson(API_PATHS.explorer.redisKey(connectionId), {
                key,
                database: options?.database != null ? String(options.database) : undefined,
            }),

        fetchRedisKeysScan: async (connectionId, options) =>
            getJson(API_PATHS.explorer.redisKeys(connectionId), {
                pattern: options?.pattern,
                cursor: options?.cursor,
                count: options?.count != null ? String(options.count) : undefined,
                database: options?.database != null ? String(options.database) : undefined,
            }),

        executeRedisCommand: async (connectionId, command, options) =>
            postJson(
                API_PATHS.explorer.redisCommand(connectionId, options?.database),
                {command},
            ),

        fetchKafkaTopics: async (connectionId, options) =>
            getJson(API_PATHS.explorer.kafkaTopics(connectionId), {
                pattern: options?.pattern,
                limit: options?.limit != null ? String(options.limit) : undefined,
            }),

        fetchKafkaTopicDetail: async (connectionId, topic) =>
            getJson(API_PATHS.explorer.kafkaTopic(connectionId, topic)),

        fetchKafkaMessages: async (connectionId, topic, options) =>
            getJson(API_PATHS.explorer.kafkaMessages(connectionId, topic), {
                partition: options?.partition != null ? String(options.partition) : undefined,
                offset: options?.offset != null ? String(options.offset) : undefined,
                limit: options?.limit != null ? String(options.limit) : undefined,
                fromBeginning: options?.fromBeginning ? 'true' : undefined,
            }),

        produceKafkaMessage: async (connectionId, topic, payload) =>
            postJson(API_PATHS.explorer.kafkaProduce(connectionId, topic), payload),

        publishTableToKafka: async (connectionId, payload, options) =>
            postJson(API_PATHS.explorer.kafkaPublishTable(connectionId), payload, options),

        fetchKafkaConsumerGroups: async (connectionId, options) =>
            getJson(API_PATHS.explorer.kafkaConsumerGroups(connectionId), {
                pattern: options?.pattern,
                limit: options?.limit != null ? String(options.limit) : undefined,
            }),

        fetchKafkaConsumerGroupMetrics: async (connectionId, groupId, options) =>
            getJson(API_PATHS.explorer.kafkaConsumerGroupMetrics(connectionId, groupId), {
                topic: options?.topic,
            }),

        fetchYarnClusterInfo: async (connectionId) =>
            getJson(API_PATHS.explorer.yarnInfo(connectionId)),

        fetchYarnApplications: async (connectionId, options) =>
            getJson(API_PATHS.explorer.yarnApps(connectionId), {
                state: options?.state,
                user: options?.user,
                queue: options?.queue,
                limit: options?.limit != null ? String(options.limit) : undefined,
            }),

        fetchYarnApplicationDetail: async (connectionId, appId) =>
            getJson(API_PATHS.explorer.yarnApp(connectionId, appId)),

        fetchYarnNodes: async (connectionId, options) =>
            getJson(API_PATHS.explorer.yarnNodes(connectionId), {
                limit: options?.limit != null ? String(options.limit) : undefined,
            }),

        fetchYarnQueues: async (connectionId) =>
            getJson(API_PATHS.explorer.yarnQueues(connectionId)),

        killYarnApplication: async (connectionId, appId, payload) =>
            putJson(API_PATHS.explorer.yarnKillApp(connectionId, appId), payload ?? {}),

        moveYarnApplicationQueue: async (connectionId, appId, payload) =>
            putJson(API_PATHS.explorer.yarnMoveAppQueue(connectionId, appId), payload),

        updateYarnQueue: async (connectionId, payload) =>
            putJson(API_PATHS.explorer.yarnQueues(connectionId), payload),

        removeYarnQueue: async (connectionId, payload) =>
            postJson(API_PATHS.explorer.yarnRemoveQueue(connectionId), payload),

        fetchConnection: async (connectionId) =>
            getJson<ConnectionConfig>(API_PATHS.explorer.connection(connectionId)),

        connectConnection: async (connectionId) =>
            postJson<ConnectionTestResult>(API_PATHS.explorer.connectConnection(connectionId), {}),

        pingConnection: async (connectionId) =>
            getJson<ConnectionTestResult>(API_PATHS.explorer.pingConnection(connectionId)),

        touchConnection: async (connectionId) =>
            postJson<boolean>(API_PATHS.explorer.touchConnection(connectionId), {}),

        disconnectConnection: async (connectionId) => {
            await postJson<void>(API_PATHS.explorer.disconnectConnection(connectionId), {})
        },

        listPooledConnections: async () =>
            getJson<string[]>(API_PATHS.explorer.pooledConnections),

        reconnectConnection: async (connectionId) =>
            postJson<ConnectionTestResult>(API_PATHS.explorer.reconnectConnection(connectionId), {}),

        createGroup: async (label, parentId) =>
            postJson<ExplorerGroupResult>(API_PATHS.explorer.groups, {
                label,
                ...(parentId ? {parentId} : {}),
            }),

        updateGroup: async (groupId, label) => {
            const data = await putJson<{ tree: TreeNode[] }>(API_PATHS.explorer.group(groupId), {
                label,
            })
            return data.tree
        },

        createConnection: async (config, groupId) =>
            postJson<ExplorerConnectionResult>(API_PATHS.explorer.connections, {
                config,
                groupId,
            }),

        updateConnection: async (connectionId, config) => {
            const data = await putJson<{ tree: TreeNode[] }>(
                API_PATHS.explorer.connection(connectionId),
                config,
            )
            return data.tree
        },

        moveConnection: async (connectionId, targetGroupId) => {
            const data = await putJson<{ tree: TreeNode[] }>(
                API_PATHS.explorer.connectionGroup(connectionId),
                {groupId: targetGroupId},
            )
            return data.tree
        },

        deleteNode: async (nodeId) => {
            const data = await deleteJson<{ tree: TreeNode[] }>(API_PATHS.explorer.node(nodeId))
            return data.tree
        },

        importConnections: async (configs) =>
            postJson<ExplorerImportResult>(API_PATHS.explorer.importConnections, {configs}),

        createDatabase: async (connectionId, payload) =>
            postJson(API_PATHS.explorer.createDatabase(connectionId), payload),

        deleteDatabase: async (connectionId, name) =>
            deleteJson(API_PATHS.explorer.deleteDatabase(connectionId, name)),

        createSchema: async (connectionId, payload) =>
            postJson(API_PATHS.explorer.createSchema(connectionId), payload),

        fetchMysqlCharsets: async (connectionId) =>
            getJson(API_PATHS.explorer.mysqlCharsets(connectionId)),
    }
}
