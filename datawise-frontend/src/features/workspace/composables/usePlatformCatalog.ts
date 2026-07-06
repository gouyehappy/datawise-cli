import {onMounted, ref, watch} from 'vue'
import type {WorkspaceTab} from '@/core/types'
import {
    loadPlatformCatalogRows,
    type PlatformCatalogRow,
} from '@/features/platform/services/platform-catalog.service'

export function usePlatformCatalog(tab: WorkspaceTab) {
    const rows = ref<PlatformCatalogRow[]>([])
    const loading = ref(false)
    const error = ref<string | null>(null)

    async function reload() {
        const feature = tab.platformFeature
        if (!feature || !tab.connectionId || !tab.database) {
            rows.value = []
            return
        }
        loading.value = true
        error.value = null
        try {
            rows.value = await loadPlatformCatalogRows(feature, tab.connectionId, tab.database)
        } catch (err) {
            error.value = err instanceof Error ? err.message : String(err)
            rows.value = []
        } finally {
            loading.value = false
        }
    }

    onMounted(() => {
        void reload()
    })

    watch(
        () => [tab.platformFeature, tab.connectionId, tab.database] as const,
        () => {
            void reload()
        },
    )

    return {rows, loading, error, reload}
}
