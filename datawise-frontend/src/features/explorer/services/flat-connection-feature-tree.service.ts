import type {TreeNode} from '@/core/types'
import {ensureKafkaConnectionFeatureChildren} from '@/features/explorer/services/kafka-feature-tree.service'
import {ensureRedisConnectionFeatureChildren} from '@/features/explorer/services/redis-feature-tree.service'

/** Kafka / Redis 连接展开时注入虚拟功能子节点 */
export function ensureFlatConnectionFeatureChildren(node: TreeNode): void {
    if (node.type !== 'connection') return
    if (node.dbType === 'kafka') ensureKafkaConnectionFeatureChildren(node)
    if (node.dbType === 'redis') ensureRedisConnectionFeatureChildren(node)
}

export function isConnectionFeatureNode(node: Pick<TreeNode, 'type'>): boolean {
    return node.type === 'kafka-feature' || node.type === 'redis-feature'
}
