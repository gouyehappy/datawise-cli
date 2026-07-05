import type {TreeNode} from '@/core/types'
import {walkTree} from '@/core/utils/tree'

export function collectExpandedNodeIds(tree: TreeNode[]): string[] {
    const ids: string[] = []
    walkTree(tree, (node) => {
        if (node.expanded) ids.push(node.id)
    })
    return ids
}

export function applyExpandedNodeIds(tree: TreeNode[], ids: string[]) {
    const set = new Set(ids)
    walkTree(tree, (node) => {
        if (set.has(node.id)) node.expanded = true
    })
}
