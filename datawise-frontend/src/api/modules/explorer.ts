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
    publishTableToKafka: (
        connectionId: string,
        payload: import('@/features/explorer/services/kafka-topic.service').PublishTableToKafkaRequest,
        options?: { silent?: boolean },
    ) => api.explorer.publishTableToKafka(connectionId, payload, options),
    fetchKafkaConsumerGroups: (
        connectionId: string,
        options?: { pattern?: string; limit?: number },
    ) => api.explorer.fetchKafkaConsumerGroups(connectionId, options),
    fetchKafkaConsumerGroupMetrics: (
        connectionId: string,
        groupId: string,
        options?: { topic?: string },
    ) => api.explorer.fetchKafkaConsumerGroupMetrics(connectionId, groupId, options),
    fetchYarnClusterInfo: (connectionId: string) => api.explorer.fetchYarnClusterInfo(connectionId),
    fetchYarnApplications: (
        connectionId: string,
        options?: { state?: string; user?: string; queue?: string; limit?: number },
    ) => api.explorer.fetchYarnApplications(connectionId, options),
    fetchYarnApplicationDetail: (connectionId: string, appId: string) =>
        api.explorer.fetchYarnApplicationDetail(connectionId, appId),
    fetchYarnNodes: (connectionId: string, options?: { limit?: number }) =>
        api.explorer.fetchYarnNodes(connectionId, options),
    fetchYarnQueues: (connectionId: string) => api.explorer.fetchYarnQueues(connectionId),
    killYarnApplication: (
        connectionId: string,
        appId: string,
        payload?: { diagnostics?: string },
    ) => api.explorer.killYarnApplication(connectionId, appId, payload),
    moveYarnApplicationQueue: (
        connectionId: string,
        appId: string,
        payload: { queue: string },
    ) => api.explorer.moveYarnApplicationQueue(connectionId, appId, payload),
    updateYarnQueue: (
        connectionId: string,
        payload: { queueName: string; params: Record<string, string> },
    ) => api.explorer.updateYarnQueue(connectionId, payload),
    removeYarnQueue: (connectionId: string, payload: { queueName: string }) =>
        api.explorer.removeYarnQueue(connectionId, payload),
    fetchConnection: (connectionId: string) => api.explorer.fetchConnection(connectionId),
    connectConnection: (connectionId: string) => api.explorer.connectConnection(connectionId),
    disconnectConnection: (connectionId: string) => api.explorer.disconnectConnection(connectionId),
    listPooledConnections: () => api.explorer.listPooledConnections(),
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
    createDatabase: (
        connectionId: string,
        payload: { name: string; charset?: string; collation?: string },
    ) => api.explorer.createDatabase(connectionId, payload),
    deleteDatabase: (connectionId: string, name: string) =>
        api.explorer.deleteDatabase(connectionId, name),
    createSchema: (
        connectionId: string,
        payload: { name: string; catalog?: string },
    ) => api.explorer.createSchema(connectionId, payload),
    fetchMysqlCharsets: (connectionId: string) => api.explorer.fetchMysqlCharsets(connectionId),
}
