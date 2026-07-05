import {api} from '@/shared/api'
import type {ConnectionConfig} from '@/core/types'

/** 连接树：数据源与结构浏览 */
export const explorerApi = {
    fetchTree: (options?: { refresh?: boolean }) => api.explorer.fetchTree(options),
    loadChildren: (
        connectionId: string,
        nodeId: string,
        options?: {
            silent?: boolean
            pattern?: string
            refresh?: boolean
            offset?: number
            limit?: number
            ifNoneMatch?: string
        },
    ) => api.explorer.loadChildren(connectionId, nodeId, options),
    pingConnection: (connectionId: string) => api.explorer.pingConnection(connectionId),
    fetchRedisKey: (connectionId: string, key: string, options?: { database?: number }) =>
        api.explorer.fetchRedisKey(connectionId, key, options),
    fetchRedisKeysScan: (
        connectionId: string,
        options?: { pattern?: string; cursor?: string; count?: number; database?: number },
    ) => api.explorer.fetchRedisKeysScan(connectionId, options),
    executeRedisCommand: (connectionId: string, command: string, options?: { database?: number }) =>
        api.explorer.executeRedisCommand(connectionId, command, options),
    fetchKafkaTopics: (
        connectionId: string,
        options?: { pattern?: string; limit?: number },
    ) => api.explorer.fetchKafkaTopics(connectionId, options),
    fetchKafkaTopicDetail: (connectionId: string, topic: string) =>
        api.explorer.fetchKafkaTopicDetail(connectionId, topic),
    fetchKafkaMessages: (
        connectionId: string,
        topic: string,
        options?: {
            partition?: number
            offset?: number
            limit?: number
            fromBeginning?: boolean
        },
    ) => api.explorer.fetchKafkaMessages(connectionId, topic, options),
    produceKafkaMessage: (
        connectionId: string,
        topic: string,
        payload: { key?: string; value: string; partition?: number },
    ) => api.explorer.produceKafkaMessage(connectionId, topic, payload),
    fetchKafkaConsumerGroups: (
        connectionId: string,
        options?: { pattern?: string; limit?: number },
    ) => api.explorer.fetchKafkaConsumerGroups(connectionId, options),
    fetchKafkaConsumerGroupMetrics: (
        connectionId: string,
        groupId: string,
        options?: { topic?: string },
    ) => api.explorer.fetchKafkaConsumerGroupMetrics(connectionId, groupId, options),
    fetchConnection: (connectionId: string) => api.explorer.fetchConnection(connectionId),
    connectConnection: (connectionId: string) => api.explorer.connectConnection(connectionId),
    disconnectConnection: (connectionId: string) => api.explorer.disconnectConnection(connectionId),
    reconnectConnection: (connectionId: string) => api.explorer.reconnectConnection(connectionId),
    createGroup: (label: string, parentId?: string) => api.explorer.createGroup(label, parentId),
    updateGroup: (groupId: string, label: string) => api.explorer.updateGroup(groupId, label),
    createConnection: (config: ConnectionConfig, groupId?: string) =>
        api.explorer.createConnection(config, groupId),
    updateConnection: (connectionId: string, config: ConnectionConfig) =>
        api.explorer.updateConnection(connectionId, config),
    moveConnection: (connectionId: string, targetGroupId: string) =>
        api.explorer.moveConnection(connectionId, targetGroupId),
    deleteNode: (nodeId: string) => api.explorer.deleteNode(nodeId),
    importConnections: (configs: ConnectionConfig[]) => api.explorer.importConnections(configs),
}
