import type {TreeNode} from '@/core/types'
import {readPinnedExplorerNodeIds} from '@/features/explorer/services/pinned-explorer-nodes.service'

/** 支持置顶排序的节点类型（数据源 / 库 / Schema / 表） */
export function isPinnableExplorerNode(node: Pick<TreeNode, 'type'>): boolean {
    return node.type === 'connection'
        || node.type === 'database'
        || node.type === 'schema'
        || node.type === 'table'
}

/** 该父节点的子级列表是否应按置顶排序 */
export function shouldSortChildrenByPinned(parent: Pick<TreeNode, 'type' | 'label'>): boolean {
    if (parent.type === 'group' || parent.type === 'connection' || parent.type === 'database') return true
    return parent.type === 'folder' && parent.label === 'tables'
}

export function sortGroupChildrenByPinned(
    children: TreeNode[],
    pinnedIds: readonly string[] = readPinnedExplorerNodeIds(),
): TreeNode[] {
    const groups = children.filter((child) => child.type === 'group')
    const connections = children.filter((child) => child.type === 'connection')
    const rest = children.filter((child) => child.type !== 'group' && child.type !== 'connection')
    if (connections.length < 2) return children
    return [...groups, ...sortExplorerChildrenByPinned(connections, pinnedIds), ...rest]
}

/** 置顶项在前（按置顶顺序），其余按名称排序 */
export function sortExplorerChildrenByPinned(
    children: TreeNode[],
    pinnedIds: readonly string[] = readPinnedExplorerNodeIds(),
): TreeNode[] {
    if (!pinnedIds.length || children.length < 2) return children

    const pinnedOrder = new Map(pinnedIds.map((id, index) => [id, index]))
    const pinned: TreeNode[] = []
    const unpinned: TreeNode[] = []

    for (const child of children) {
        if (pinnedOrder.has(child.id)) {
            pinned.push(child)
        } else {
            unpinned.push(child)
        }
    }

    if (!pinned.length) return children

    pinned.sort((a, b) => (pinnedOrder.get(a.id) ?? 0) - (pinnedOrder.get(b.id) ?? 0))
    unpinned.sort((a, b) => a.label.localeCompare(b.label, undefined, {sensitivity: 'base'}))
    return [...pinned, ...unpinned]
}

export function applyPinnedSortToNodeChildren(node: TreeNode): void {
    if (!node.children?.length || !shouldSortChildrenByPinned(node)) return
    if (node.type === 'group') {
        node.children = sortGroupChildrenByPinned(node.children, readPinnedExplorerNodeIds())
        return
    }
    node.children = sortExplorerChildrenByPinned(node.children)
}

export function applyPinnedSortInTree(nodes: TreeNode[]): void {
    for (const node of nodes) {
        applyPinnedSortToNodeChildren(node)
        if (node.children?.length) {
            applyPinnedSortInTree(node.children)
        }
    }
}
