import type {TreeNode} from '@/core/types'

export type KafkaFeatureId = 'topics' | 'consumer-groups' | 'table-publish'

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
        {
            id: `${connectionId}:kafka:feature:table-publish`,
            label: 'table-publish',
            type: 'kafka-feature',
            dbType: 'kafka',
            meta: 'table-publish',
        },
    ]
}

export function parseKafkaFeatureId(node: Pick<TreeNode, 'type' | 'meta'>): KafkaFeatureId | null {
    if (node.type !== 'kafka-feature') return null
    if (node.meta === 'topics' || node.meta === 'consumer-groups' || node.meta === 'table-publish') {
        return node.meta
    }
    return null
}

export function ensureKafkaConnectionFeatureChildren(node: TreeNode): void {
    if (node.type !== 'connection' || node.dbType !== 'kafka') return
    const expected = buildKafkaConnectionFeatureChildren(node.id)
    if (!node.children?.length) {
        node.children = expected
        return
    }
    const existingMetas = new Set(
        node.children.filter((child) => child.type === 'kafka-feature').map((child) => child.meta),
    )
    for (const child of expected) {
        if (!existingMetas.has(child.meta)) {
            node.children.push(child)
        }
    }
}
