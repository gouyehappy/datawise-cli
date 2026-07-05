import type {TreeNode} from '@/core/types'

export type RedisFeatureId = 'keys' | 'command'

export function buildRedisConnectionFeatureChildren(connectionId: string): TreeNode[] {
    return [
        {
            id: `${connectionId}:redis:feature:keys`,
            label: 'keys',
            type: 'redis-feature',
            dbType: 'redis',
            meta: 'keys',
        },
        {
            id: `${connectionId}:redis:feature:command`,
            label: 'command',
            type: 'redis-feature',
            dbType: 'redis',
            meta: 'command',
        },
    ]
}

export function parseRedisFeatureId(node: Pick<TreeNode, 'type' | 'meta'>): RedisFeatureId | null {
    if (node.type !== 'redis-feature') return null
    if (node.meta === 'keys' || node.meta === 'command') return node.meta
    return null
}

export function ensureRedisConnectionFeatureChildren(node: TreeNode): void {
    if (node.type !== 'connection' || node.dbType !== 'redis' || node.children?.length) return
    node.children = buildRedisConnectionFeatureChildren(node.id)
}
