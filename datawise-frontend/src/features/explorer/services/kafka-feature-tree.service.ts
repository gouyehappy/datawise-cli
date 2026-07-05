import type {TreeNode} from '@/core/types'

export type KafkaFeatureId = 'topics' | 'consumer-groups'

export function buildKafkaConnectionFeatureChildren(connectionId: string): TreeNode[] {
    return [
        {
            id: `${connectionId}:kafka:feature:topics`,
            label: 'topics',
            type: 'kafka-feature',
            dbType: 'kafka',
            meta: 'topics',
        },
        {
            id: `${connectionId}:kafka:feature:consumer-groups`,
            label: 'consumer-groups',
            type: 'kafka-feature',
            dbType: 'kafka',
            meta: 'consumer-groups',
        },
    ]
}

export function parseKafkaFeatureId(node: Pick<TreeNode, 'type' | 'meta'>): KafkaFeatureId | null {
    if (node.type !== 'kafka-feature') return null
    if (node.meta === 'topics' || node.meta === 'consumer-groups') return node.meta
    return null
}

export function ensureKafkaConnectionFeatureChildren(node: TreeNode): void {
    if (node.type !== 'connection' || node.dbType !== 'kafka' || node.children?.length) return
    node.children = buildKafkaConnectionFeatureChildren(node.id)
}
