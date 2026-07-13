import type {TreeNode} from '@/core/types'

export type YarnFeatureId = 'applications' | 'nodes' | 'queues'

export function buildYarnConnectionFeatureChildren(connectionId: string): TreeNode[] {
    return [
        {
            id: `${connectionId}:yarn:feature:applications`,
            label: 'applications',
            type: 'yarn-feature',
            dbType: 'yarn',
            meta: 'applications',
        },
        {
            id: `${connectionId}:yarn:feature:nodes`,
            label: 'nodes',
            type: 'yarn-feature',
            dbType: 'yarn',
            meta: 'nodes',
        },
        {
            id: `${connectionId}:yarn:feature:queues`,
            label: 'queues',
            type: 'yarn-feature',
            dbType: 'yarn',
            meta: 'queues',
        },
    ]
}

export function parseYarnFeatureId(node: Pick<TreeNode, 'type' | 'meta'>): YarnFeatureId | null {
    if (node.type !== 'yarn-feature') return null
    if (node.meta === 'applications' || node.meta === 'nodes' || node.meta === 'queues') {
        return node.meta
    }
    return null
}

export function ensureYarnConnectionFeatureChildren(node: TreeNode): void {
    if (node.type !== 'connection' || node.dbType !== 'yarn') return
    const expected = buildYarnConnectionFeatureChildren(node.id)
    if (!node.children?.length) {
        node.children = expected
        return
    }
    const existingMetas = new Set(
        node.children.filter((child) => child.type === 'yarn-feature').map((child) => child.meta),
    )
    for (const child of expected) {
        if (!existingMetas.has(child.meta)) {
            node.children.push(child)
        }
    }
}
