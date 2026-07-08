import {computed, ref} from 'vue'
import {useI18n} from 'vue-i18n'
import type {TablePropertiesResult} from '@/shared/api/types'
import type {WorkspaceTab} from '@/core/types'
import {useAuthStore} from '@/features/auth/stores/auth-store'
import {useExplorerStore} from '@/features/explorer/stores/explorer'
import {useLayoutStore} from '@/features/layout/stores/layout'
import {useTeamStore} from '@/features/team/stores/team-store'
import {canDmlConnection} from '@/features/team/services/connection-access.service'
import {
    executeFakeDataForTab,
    exportFakeDataForTab,
    fetchFakeDataProperties,
} from '@/features/workspace/services/fake-data.actions'

export function useFakeDataDialog(onExecuted?: (tab: WorkspaceTab) => void | Promise<void>) {
    const {t} = useI18n()
    const layout = useLayoutStore()
    const explorer = useExplorerStore()
    const teamStore = useTeamStore()
    const auth = useAuthStore()

    const open = ref(false)
    const loading = ref(false)
    const executing = ref(false)
    const tab = ref<WorkspaceTab | null>(null)
    const properties = ref<TablePropertiesResult | null>(null)

    const canExecute = computed(() => {
        const current = tab.value
        if (!current?.connectionId || auth.isGuest) return false
        return canDmlConnection(current.connectionId, teamStore.teams)
    })

    const executeDisabledHint = computed(() => {
        if (auth.isGuest) return t('auth.guestReadOnlyHint')
        if (!canExecute.value) return t('workspace.fakeData.writeDenied')
        return undefined
    })

    async function openForTable(target: WorkspaceTab) {
        if (target.type !== 'table' || !target.tableName?.trim()) {
            layout.showToast(t('workspace.fakeData.failed'))
            return
        }
        tab.value = target
        properties.value = null
        open.value = true
        loading.value = true
        try {
            properties.value = await fetchFakeDataProperties(target, explorer.tree)
        } catch (error) {
            open.value = false
            tab.value = null
            const message = error instanceof Error ? error.message : String(error)
            layout.showToast(t('workspace.fakeData.failedWithDetail', {message}))
        } finally {
            loading.value = false
        }
    }

    async function execute(rowCount: number) {
        const current = tab.value
        const props = properties.value
        if (!current || !props) return
        executing.value = true
        try {
            const ok = await executeFakeDataForTab({
                tab: current,
                tree: explorer.tree,
                properties: props,
                rowCount,
                teams: teamStore.teams,
                isGuest: auth.isGuest,
                showToast: (message) => layout.showToast(message),
                t,
            })
            if (ok) {
                open.value = false
                await onExecuted?.(current)
            }
        } catch (error) {
            const message = error instanceof Error ? error.message : String(error)
            layout.showToast(t('workspace.fakeData.failedWithDetail', {message}))
        } finally {
            executing.value = false
        }
    }

    function exportSql(rowCount: number) {
        const current = tab.value
        const props = properties.value
        if (!current || !props) return
        exportFakeDataForTab({
            tab: current,
            tree: explorer.tree,
            properties: props,
            rowCount,
            showToast: (message) => layout.showToast(message),
            t,
        })
    }

    return {
        open,
        loading,
        executing,
        tab,
        properties,
        canExecute,
        executeDisabledHint,
        openForTable,
        execute,
        exportSql,
    }
}
