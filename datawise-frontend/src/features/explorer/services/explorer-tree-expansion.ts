import type {DbType, TreeNode} from '@/core/types'
import {walkTree} from '@/core/utils/tree'
import {needsLazyLoad} from '@/features/explorer/services/explorer-lazy-load'

/** 从根到目标节点的 id 链（含目标） */
export function collectPathNodeIds(tree: TreeNode[], nodeId: string): string[] {
    const path: string[] = []
    walkTree(tree, (node, parents) => {
        if (node.id === nodeId) {
            path.push(...parents.map((item) => item.id), node.id)
            return true
        }
    })
    return path
}

/** 节点子级是否已加载完毕（与 expanded 无关） */
export function isNodeChildrenLoaded(node: TreeNode, dbType?: DbType): boolean {
    return !needsLazyLoad(node, dbType)
}

/** 箭头切换：仅当已展开且子级已加载时才折叠 */
export function shouldCollapseOnToggle(node: TreeNode, dbType?: DbType): boolean {
    return !!node.expanded && isNodeChildrenLoaded(node, dbType)
}

/** 行单击不展开；展开/加载仅由左侧箭头触发 */
export function shouldLoadOnNodeSelect(_node: TreeNode, _dbType?: DbType): boolean {
    return false
}

/** 是否需要对该节点执行懒加载（expand 与 load 解耦后的统一判断） */
export function shouldLoadChildren(node: TreeNode, dbType?: DbType): boolean {
    return needsLazyLoad(node, dbType)
}

/** 展开路径上哪些节点需要 load（group 等静态节点跳过 API） */
export function pathIdsNeedingLoad(
    tree: TreeNode[],
    nodeId: string,
    resolveDbType: (id: string) => DbType | undefined,
): string[] {
    return collectPathNodeIds(tree, nodeId).filter((id) => {
        const node = findNodeInTree(tree, id)
        if (!node) return false
        return shouldLoadChildren(node, resolveDbType(id))
    })
}

function findNodeInTree(tree: TreeNode[], nodeId: string): TreeNode | null {
    let found: TreeNode | null = null
    walkTree(tree, (node) => {
        if (node.id === nodeId) {
            found = node
            return true
        }
    })
    return found
}

/** 仅设置 expanded 标记，不触发 API（用于 group 等静态节点） */
export function markExpandedPath(tree: TreeNode[], nodeId: string) {
    walkTree(tree, (node, parents) => {
        if (node.id === nodeId) {
            for (const parent of parents) {
                if (!parent.expanded) parent.expanded = true
            }
            return true
        }
    })
}
