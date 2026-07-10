export interface KafkaTopicsResult {
    topics: string[]
    totalCount: number
}

export interface KafkaTopicPartition {
    partition: number
    beginningOffset: number
    endOffset: number
}

export interface KafkaTopicDetail {
    name: string
    partitionCount: number
    replicationFactor: number
    partitions: KafkaTopicPartition[]
}

export interface KafkaMessage {
    partition: number
    offset: number
    timestamp: number
    key: string | null
    value: string | null
    headers: Record<string, string>
}

export interface KafkaMessagesResult {
    messages: KafkaMessage[]
    hasMore: boolean
}

export interface KafkaProduceResult {
    topic: string
    partition: number
    offset: number
}

export interface PublishTableToKafkaRequest {
    sourceConnectionId: string
    sourceDatabase?: string | null
    tableName: string
    topic: string
    keyColumn?: string | null
    maxMessages?: number | null
    intervalMs?: number | null
    partition?: number | null
    fakeData?: boolean | null
    datagenSeed?: number | null
    datagenRowOffset?: number | null
}

export interface PublishTableToKafkaResult {
    messagesSent: number
    messagesFailed: number
    durationMs: number
    stopReason: string
    lastError?: string | null
    lastProduce?: KafkaProduceResult | null
}

export interface KafkaConsumerGroupSummary {
    groupId: string
    state: string
}

export interface KafkaConsumerGroupsResult {
    groups: KafkaConsumerGroupSummary[]
    totalCount: number
}

export interface KafkaConsumerGroupPartitionMetric {
    topic: string
    partition: number
    committedOffset: number
    endOffset: number
    lag: number
    memberId: string | null
}

export interface KafkaConsumerGroupMetrics {
    groupId: string
    state: string
    memberCount: number
    totalLag: number
    partitions: KafkaConsumerGroupPartitionMetric[]
}

export function parseKafkaTopicFromNodeId(nodeId: string, connectionId: string): string | null {
    const prefix = `${connectionId}:kafka:`
    if (!nodeId.startsWith(prefix)) return null
    const topic = nodeId.slice(prefix.length)
    return topic || null
}

export function kafkaTopicNodeId(connectionId: string, topic: string): string {
    return `${connectionId}:kafka:${topic}`
}
