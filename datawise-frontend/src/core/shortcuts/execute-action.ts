import type {ShortcutActionId} from '@/core/shortcuts/types'
import {
    focusExplorerSearchInput,
    getConsoleShortcutHandlers,
} from '@/core/shortcuts/action-registry'
import {
    runExplorerDeleteSelectedNode,
    runExplorerEditSelectedNode,
    runExplorerOpenSelectedNode,
} from '@/features/explorer/services/explorer-node-shortcuts.service'
import {runExplorerDatabaseShortcut} from '@/features/explorer/services/explorer-database-shortcuts.service'
import {
    runExplorerLocate,
    runExplorerRefresh,
    runToggleAllComments,
    runToggleColumnComment,
    runToggleTableComment,
} from '@/features/explorer/services/explorer-toolbar.actions'
import {useLayoutStore} from '@/features/layout/stores/layout'
import {useWorkspaceStore} from '@/features/workspace/stores/workspace'
import {useGlobalObjectSearch} from '@/features/layout/composables/useGlobalObjectSearch'

function isSqlShortcutTab(type: string | undefined): boolean {
    return type === 'console' || type === 'view_model_editor'
}

export function executeShortcutAction(actionId: ShortcutActionId) {
    const layout = useLayoutStore()
    const workspace = useWorkspaceStore()
    const {toggleGlobalObjectSearch} = useGlobalObjectSearch()
    const consoleHandlers = getConsoleShortcutHandlers()

    switch (actionId) {
        case 'explorer.search':
            focusExplorerSearchInput()
            return
        case 'explorer.refresh':
            void runExplorerRefresh()
            return
        case 'explorer.locate':
            void runExplorerLocate()
            return
        case 'explorer.openNode':
            runExplorerOpenSelectedNode()
            return
        case 'explorer.editNode':
            runExplorerEditSelectedNode()
            return
        case 'explorer.deleteNode':
            runExplorerDeleteSelectedNode()
            return
        case 'explorer.openDatabaseSql':
            runExplorerDatabaseShortcut('open')
            return
        case 'explorer.openRecentDatabaseSql':
            runExplorerDatabaseShortcut('recent')
            return
        case 'explorer.newDatabaseSql':
            runExplorerDatabaseShortcut('new')
            return
        case 'explorer.openDatabaseConsole':
            runExplorerDatabaseShortcut('console')
            return
        case 'explorer.toggleColumnComment':
            runToggleColumnComment()
            return
        case 'explorer.toggleTableComment':
            runToggleTableComment()
            return
        case 'explorer.toggleAllComments':
            runToggleAllComments()
            return
        case 'workspace.newConsole':
            workspace.openConsole()
            return
        case 'workspace.runSql':
            if (isSqlShortcutTab(workspace.activeTab?.type)) consoleHandlers.onRun?.()
            return
        case 'workspace.saveConsole':
            if (isSqlShortcutTab(workspace.activeTab?.type)) consoleHandlers.onSave?.()
            return
        case 'workspace.aiPrompt':
            if (isSqlShortcutTab(workspace.activeTab?.type)) consoleHandlers.onAiPrompt?.()
            return
        case 'app.openSettings':
            layout.openSettingsModule('basic')
            return
        case 'app.toggleTerminal':
            layout.toggleTerminalPanel()
            return
        case 'app.toggleNotifications':
            layout.activeShortcutPanel = null
            layout.showNotificationDrawer = !layout.showNotificationDrawer
            return
        case 'app.globalObjectSearch':
            toggleGlobalObjectSearch()
            return
        default:
            return
    }
}
