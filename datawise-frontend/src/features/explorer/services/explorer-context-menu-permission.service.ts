import type {ContextMenuItem} from '@/core/types'
import {pruneContextMenuDividers} from '@/core/utils/context-menu'
import {
    canAccessFeature,
    canDeleteExplorerNode,
    canManageExplorerConnectionLifecycle,
    canMutateConnectionCatalog,
    isConnectionCatalogStructureType,
} from '@/features/auth/services/feature-permission.service'
import {isGuestSession} from '@/features/auth/services/user-access-policy'
import {
    FeaturePermission,
    type FeaturePermissionKey,
} from '@/features/auth/types/feature-permission.types'
import {isDbTypeMenuId} from '@/features/explorer/constants/explorer-add-menu'
import {MOVE_TARGET_MENU_PREFIX} from '@/features/explorer/services/explorer-move-connection.service'

const EXPLORER_CONTEXT_MENU_PERMISSION_BY_ID: Record<string, FeaturePermissionKey> = {
    open: FeaturePermission.WorkbenchExplorerContextOpen,
    'view-lineage': FeaturePermission.WorkbenchExplorerContextOpen,
    'script-history': FeaturePermission.WorkbenchExplorerContextOpen,
    'schema-er': FeaturePermission.WorkbenchExplorerContextOpen,
    'schema-tables': FeaturePermission.WorkbenchExplorerContextOpen,
    ddl: FeaturePermission.WorkbenchExplorerContextOpen,
    'open-redis-keys': FeaturePermission.WorkbenchExplorerContextOpen,
    'open-redis-browser': FeaturePermission.WorkbenchExplorerContextOpen,
    'open-kafka-topics': FeaturePermission.WorkbenchExplorerContextOpen,
    'open-kafka-consumer-groups': FeaturePermission.WorkbenchExplorerContextOpen,
    'new-ssh-script-record': FeaturePermission.WorkbenchExplorerContextEdit,
    'refresh-ssh-script-records': FeaturePermission.WorkbenchExplorerContextOpen,
    'delete-ssh-script-record': FeaturePermission.WorkbenchExplorerContextEdit,
    'rename-ssh-script-record': FeaturePermission.WorkbenchExplorerContextEdit,
    'new-ssh-terminal': FeaturePermission.WorkbenchExplorerContextConsole,

    console: FeaturePermission.WorkbenchExplorerContextConsole,
    'sql-editor-open': FeaturePermission.WorkbenchExplorerContextConsole,
    'sql-editor-recent': FeaturePermission.WorkbenchExplorerContextConsole,
    'sql-editor-new': FeaturePermission.WorkbenchExplorerContextConsole,
    'sql-editor-console': FeaturePermission.WorkbenchExplorerContextConsole,
    'run-sql-file': FeaturePermission.WorkbenchExplorerContextConsole,
    'edit-view-model': FeaturePermission.WorkbenchExplorerContextConsole,
    'open-redis-command': FeaturePermission.WorkbenchExplorerContextConsole,
    'redis-console': FeaturePermission.WorkbenchExplorerContextConsole,
    'kafka-console': FeaturePermission.WorkbenchExplorerContextConsole,

    'create-database': FeaturePermission.WorkbenchExplorerContextDangerous,
    'create-schema': FeaturePermission.WorkbenchExplorerContextDangerous,
    'delete-database': FeaturePermission.WorkbenchExplorerContextDangerous,

    edit: FeaturePermission.WorkbenchExplorerContextEdit,
    rename: FeaturePermission.WorkbenchExplorerContextEdit,
    'new-subgroup': FeaturePermission.WorkbenchExplorerContextEdit,
    'new-view-model': FeaturePermission.WorkbenchExplorerContextEdit,
    move: FeaturePermission.WorkbenchExplorerContextEdit,
    'move-here': FeaturePermission.WorkbenchExplorerContextEdit,
    'add-connection': FeaturePermission.WorkbenchExplorerContextEdit,

    'export-wizard': FeaturePermission.WorkbenchExplorerContextExport,
    'export-structure': FeaturePermission.WorkbenchExplorerContextExport,
    'export-all': FeaturePermission.WorkbenchExplorerContextExport,
    import: FeaturePermission.WorkbenchExplorerContextExport,
    'migrate-data': FeaturePermission.WorkbenchExplorerContextExport,
    'export-data': FeaturePermission.WorkbenchExplorerContextExport,
    'export-metadoc': FeaturePermission.WorkbenchExplorerContextExport,
    'schema-compare': FeaturePermission.WorkbenchExplorerContextExport,
    'cross-env-compare': FeaturePermission.WorkbenchExplorerContextExport,
    'publish-to-kafka': FeaturePermission.WorkbenchExplorerContextExport,
    'publish-table-data': FeaturePermission.WorkbenchExplorerContextExport,

    'copy-name': FeaturePermission.WorkbenchExplorerContextCopy,
    'copy-structure': FeaturePermission.WorkbenchExplorerContextCopy,
    'copy-data': FeaturePermission.WorkbenchExplorerContextCopy,

    pin: FeaturePermission.WorkbenchExplorerContextPin,

    refresh: FeaturePermission.WorkbenchExplorerContextOpen,

    connect: FeaturePermission.WorkbenchExplorerContextConnection,
    disconnect: FeaturePermission.WorkbenchExplorerContextConnection,
    reconnect: FeaturePermission.WorkbenchExplorerContextConnection,

    delete: FeaturePermission.WorkbenchExplorerContextDangerous,
    truncate: FeaturePermission.WorkbenchExplorerContextDangerous,
    'delete-sql-file': FeaturePermission.WorkbenchExplorerContextDangerous,
    'delete-view-model': FeaturePermission.WorkbenchExplorerContextDangerous,
}

export interface ExplorerContextMenuPermissionContext {
    nodeType?: string
}

function canAccessExplorerContextMenuAction(
    menuId: string,
    context?: ExplorerContextMenuPermissionContext,
): boolean {
    const key = explorerContextMenuFeatureKey(menuId)
    if (!key) return true

    const isGuest = isGuestSession()
    const nodeType = context?.nodeType

    if (key === FeaturePermission.WorkbenchExplorerContextEdit) {
        if (
            isConnectionCatalogStructureType(nodeType)
            || isDbTypeMenuId(menuId)
            || menuId.startsWith(MOVE_TARGET_MENU_PREFIX)
        ) {
            return canMutateConnectionCatalog(isGuest)
        }
    }

    if (key === FeaturePermission.WorkbenchExplorerContextConnection) {
        return canManageExplorerConnectionLifecycle(isGuest)
    }

    if (key === FeaturePermission.WorkbenchExplorerContextDangerous && menuId === 'delete') {
        return canDeleteExplorerNode(nodeType, isGuest)
    }

    return canAccessFeature(key)
}

export function explorerContextMenuFeatureKey(menuId: string): FeaturePermissionKey | null {
    if (menuId.startsWith('divider')) return null
    if (isDbTypeMenuId(menuId)) return FeaturePermission.WorkbenchExplorerContextEdit
    if (menuId.startsWith(MOVE_TARGET_MENU_PREFIX)) return FeaturePermission.WorkbenchExplorerContextEdit
    return EXPLORER_CONTEXT_MENU_PERMISSION_BY_ID[menuId] ?? null
}

export function canRunExplorerContextMenuAction(
    menuId: string,
    context?: ExplorerContextMenuPermissionContext,
): boolean {
    return canAccessExplorerContextMenuAction(menuId, context)
}

export function filterExplorerContextMenuByPermission(
    items: ContextMenuItem[],
    context?: ExplorerContextMenuPermissionContext,
): ContextMenuItem[] {
    const filtered: ContextMenuItem[] = []
    for (const item of items) {
        if (item.divider) {
            if (filtered.length > 0 && !filtered[filtered.length - 1]?.divider) {
                filtered.push(item)
            }
            continue
        }
        if (item.children?.length) {
            const children = filterExplorerContextMenuByPermission(item.children, context)
            if (children.length === 0) continue
            filtered.push({...item, children})
            continue
        }
        if (!canAccessExplorerContextMenuAction(item.id, context)) continue
        filtered.push(item)
    }
    return pruneContextMenuDividers(filtered)
}