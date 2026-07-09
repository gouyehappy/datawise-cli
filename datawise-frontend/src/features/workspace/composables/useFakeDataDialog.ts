import {computed, ref} from 'vue'
import {useI18n} from 'vue-i18n'
import type {TablePropertiesResult} from '@/shared/api/types'
import type {TableRow, WorkspaceTab} from '@/core/types'
import {useAuthStore} from '@/features/auth/stores/auth-store'
import {useExplorerStore} from '@/features/explorer/stores/explorer'
import {useLayoutStore} from '@/features/layout/stores/layout'
import {useTeamStore} from '@/features/team/stores/team-store'
import {canDmlConnection} from '@/features/team/services/connection-access.service'
import {
    executeFakeDataForTab,
    exportFakeDataForTab,
    fetchFakeDataProperties,
    previewFakeDataForTab,
} from '@/features/workspace/services/fake-data.actions'
import {FAKE_DATA_DEFAULT_ROWS} from '@/features/workspace/services/fake-data.service'

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
    const previewRows = ref<TableRow[] | null>(null)
    const previewSql = ref<string | null>(null)
    const previewLoading = ref(false)
    const executeError = ref('')
    const seed = ref<number | null>(null)

    function resetDialog() {
        open.value = false
        loading.value = false
        executing.value = false
        tab.value = null
        properties.value = null
        previewRows.value = null
        previewSql.value = null
        executeError.value = ''
    }

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
        previewRows.value = null
        previewSql.value = null
        seed.value = Date.now()
        executeError.value = ''
        open.value = true
        loading.value = true
        try {
            properties.value = await fetchFakeDataProperties(target, explorer.tree)
            const preview = await previewFakeDataForTab({
                tab: target,
                tree: explorer.tree,
                rowCount: FAKE_DATA_DEFAULT_ROWS,
                seed: seed.value ?? undefined,
            })
            previewRows.value = preview.previewRows
            previewSql.value = preview.insertSql
        } catch (error) {
            resetDialog()
            const message = error instanceof Error ? error.message : String(error)
            layout.showToast(t('workspace.fakeData.failedWithDetail', {message}))
        } finally {
            loading.value = false
        }
    }

    async function refreshPreview(rowCount: number) {
        const current = tab.value
        if (!current) return
        executeError.value = ''
        previewLoading.value = true
        try {
            const preview = await previewFakeDataForTab({
                tab: current,
                tree: explorer.tree,
                rowCount,
                seed: seed.value ?? undefined,
            })
            previewRows.value = preview.previewRows
            previewSql.value = preview.insertSql
        } finally {
            previewLoading.value = false
        }
    }

    async function execute(rowCount: number) {
        const current = tab.value
        const props = properties.value
        if (!current || !props) {
            executeError.value = t('workspace.fakeData.failed')
            layout.showToast(executeError.value)
            return
        }
        executeError.value = ''
        executing.value = true
        try {
            const ok = await executeFakeDataForTab({
                tab: current,
                tree: explorer.tree,
                properties: props,
                rowCount,
                seed: seed.value ?? undefined,
                teams: teamStore.teams,
                isGuest: auth.isGuest,
                showToast: (message) => layout.showToast(message),
                t,
            })
            if (ok) {
                resetDialog()
                await onExecuted?.(current)
            } else {
                executeError.value = t('workspace.fakeData.failed')
                layout.showToast(executeError.value)
            }
        } catch (error) {
            const message = error instanceof Error ? error.message : String(error)
            executeError.value = t('workspace.fakeData.failedWithDetail', {message})
            layout.showToast(executeError.value)
        } finally {
            executing.value = false
        }
    }

    function exportSql(rowCount: number) {
        const current = tab.value
        const props = properties.value
        if (!current || !props) return
        void exportFakeDataForTab({
                tab: current,
                tree: explorer.tree,
                properties: props,
                rowCount,
                seed: seed.value ?? undefined,
                showToast: (message) => layout.showToast(message),
                t,
            })
    }

    return {
        open,
        loading,
        executing,
        previewLoading,
        executeError,
        tab,
        properties,
        previewRows,
        previewSql,
        canExecute,
        executeDisabledHint,
        openForTable,
        execute,
        exportSql,
        refreshPreview,
    }
}
