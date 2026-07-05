import {useExplorerStore} from '@/features/explorer/stores/explorer'
import {useLayoutStore} from '@/features/layout/stores/layout'
import {useWorkspaceStore} from '@/features/workspace/stores/workspace'
import {t} from '@/i18n'

export async function runExplorerRefresh() {
    const explorer = useExplorerStore()
    await explorer.refreshTree()
}

export async function runExplorerLocateActiveTab(): Promise<boolean> {
    const explorer = useExplorerStore()
    const workspace = useWorkspaceStore()
    const layout = useLayoutStore()
    const tab = workspace.activeTab

    const node = await explorer.locateActiveTabNode(tab)
    if (!node) {
        layout.showToast(t('explorer.locateActiveTabFailed'))
        return false
    }

    if (tab?.id && node.id !== tab.explorerNodeId) {
        workspace.updateTabContext(tab.id, {explorerNodeId: node.id})
    }

    layout.showToast(t('explorer.locateDone', {name: node.label}))
    return true
}

export async function runExplorerLocateSelected(): Promise<boolean> {
    const explorer = useExplorerStore()
    const layout = useLayoutStore()

    const node = await explorer.locateSelectedNode()
    if (!node) {
        layout.showToast(t('explorer.locateSelectedFailed'))
        return false
    }

    layout.showToast(t('explorer.locateDone', {name: node.label}))
    return true
}

/** 优先定位当前 Tab 到连接树（表 / 脚本文件），否则定位到树中已选节点 */
export async function runExplorerLocate(): Promise<boolean> {
    const workspace = useWorkspaceStore()
    const tab = workspace.activeTab
    if (tab && (tab.type === 'console' || tab.type === 'table') && tab.connectionId) {
        return runExplorerLocateActiveTab()
    }
    return runExplorerLocateSelected()
}

export function runToggleColumnComment() {
    const explorer = useExplorerStore()
    explorer.showColumnComment = !explorer.showColumnComment
}

export function runToggleTableComment() {
    const explorer = useExplorerStore()
    explorer.showTableComment = !explorer.showTableComment
}

export function runToggleAllComments() {
    const explorer = useExplorerStore()
    explorer.toggleAllComments()
}
