import type {ComposerTranslation} from 'vue-i18n'
import type {TreeNode, TreeNodeType} from '@/core/types'

/** 后端 Schema 树预置目录/分区 label（稳定英文键，逻辑匹配仍用 node.label） */
export const EXPLORER_CATALOG_LABEL_KEYS = [
    'tables',
    'models',
    'views',
    'functions',
    'procedures',
    'triggers',
    'workspaces',
    'columns',
    'keys',
    'indexes',
] as const

export type ExplorerCatalogLabelKey = (typeof EXPLORER_CATALOG_LABEL_KEYS)[number]

const CATALOG_LABEL_KEY_SET = new Set<string>(EXPLORER_CATALOG_LABEL_KEYS)

const CATALOG_LABEL_BY_NODE_TYPE: Partial<Record<TreeNodeType, ExplorerCatalogLabelKey>> = {
    columns: 'columns',
    keys: 'keys',
    indexes: 'indexes',
}

export function normalizeExplorerCatalogLabelKey(label: string): ExplorerCatalogLabelKey | null {
    const key = label.trim().toLowerCase()
    return CATALOG_LABEL_KEY_SET.has(key) ? (key as ExplorerCatalogLabelKey) : null
}

export function resolveExplorerCatalogLabelKey(node: TreeNode): ExplorerCatalogLabelKey | null {
    const byType = CATALOG_LABEL_BY_NODE_TYPE[node.type]
    if (byType) return byType
    if (node.type !== 'folder') return null
    return normalizeExplorerCatalogLabelKey(node.label)
}

/** 展示用 label；未知目录名原样返回 */
export function resolveExplorerCatalogLabel(node: TreeNode, t: ComposerTranslation): string {
    const key = resolveExplorerCatalogLabelKey(node)
    return key ? t(`explorer.treeCatalog.${key}`) : node.label
}

export function matchesExplorerTreeSearch(
    node: TreeNode,
    normalizedQuery: string,
    t: ComposerTranslation,
): boolean {
    if (node.label.toLowerCase().includes(normalizedQuery)) return true
    const localized = resolveExplorerCatalogLabel(node, t)
    return localized !== node.label && localized.toLowerCase().includes(normalizedQuery)
}
