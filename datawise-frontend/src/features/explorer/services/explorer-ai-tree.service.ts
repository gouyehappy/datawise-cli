import type {TreeNode} from '@/core/types'
import {resolveConnectionId, walkTree} from '@/core/utils/tree'

export const AI_FOLDER_LABEL = 'ai'
const LEGACY_SEMANTICS_FOLDER_LABEL = 'semantics'

function isLegacySemanticsFolder(node: Pick<TreeNode, 'type' | 'label'>): boolean {
    return node.type === 'folder' && node.label.toLowerCase() === LEGACY_SEMANTICS_FOLDER_LABEL
}

/** 遍历连接树：移除旧 semantics 文件夹，补全 AI 文件夹 */
export function migrateExplorerTreeAiStructure(roots: TreeNode[]): void {
    walkTree(roots, (node) => {
        if (node.type !== 'database' && node.type !== 'schema') return
        const connectionId = resolveConnectionId(roots, node.id)
        if (connectionId) {
            ensureAiFolderInScopeChildren(node, connectionId)
        }
    })
}

/** 递归过滤 AI 文件夹（设置关闭时），并剔除遗留 semantics */
export function filterExplorerTreeAiFolders(nodes: TreeNode[], visible: boolean): TreeNode[] {
    return nodes.map((node) => {
        if (!node.children?.length) return node
        let children = node.children.filter((child) => !isLegacySemanticsFolder(child))
        if (!visible) {
            children = children.filter((child) => !isAiFolder(child))
        }
        const nextChildren = filterExplorerTreeAiFolders(children, visible)
        if (nextChildren === node.children) return node
        return {...node, children: nextChildren}
    })
}

export function isAiFolder(node: Pick<TreeNode, 'type' | 'label'>): boolean {
    return node.type === 'folder' && node.label.toLowerCase() === AI_FOLDER_LABEL
}

export function isPlatformFeatureNode(node: Pick<TreeNode, 'type'>): boolean {
    return node.type === 'platform_feature'
}

export function resolvePlatformFeatureId(node: Pick<TreeNode, 'label' | 'meta'>): string {
    return (node.meta ?? node.label).trim().toLowerCase()
}

/** 为历史 schema 缓存补全 AI 文件夹，并移除旧 semantics 文件夹 */
export function ensureAiFolderInScopeChildren(scopeNode: TreeNode, connectionId: string): void {
    let children = (scopeNode.children ?? []).filter((child) => !isLegacySemanticsFolder(child))
    if (children.some((child) => isAiFolder(child))) {
        scopeNode.children = children
        return
    }

    const referenceFolder = children.find(
        (child) =>
            child.type === 'folder'
            && ['workspaces', 'tables', 'models'].includes(child.label.toLowerCase()),
    )
    const aiId = referenceFolder
        ? referenceFolder.id
            .replace(/folder-ws/i, 'folder-ai')
            .replace(/folder-tables/i, 'folder-ai')
            .replace(/folder-models/i, 'folder-ai')
            .replace(/folder-semantics/i, 'folder-ai')
        : `folder-ai-${connectionId}-${scopeNode.label}`

    scopeNode.children = [
        ...children,
        {
            id: aiId,
            label: AI_FOLDER_LABEL,
            type: 'folder',
            expanded: false,
            children: [],
        },
    ]
}
