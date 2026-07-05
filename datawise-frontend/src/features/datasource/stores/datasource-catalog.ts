import {defineStore} from 'pinia'
import {computed, ref} from 'vue'
import type {ConnectorPluginLoadFailure, DatasourceDefinition} from '@/features/datasource/types/datasource.types'
import {fetchDatasourceCatalogBundle} from '@/features/datasource/services/datasource-catalog.service'

export const useDatasourceCatalogStore = defineStore('datasourceCatalog', () => {
    const items = ref<DatasourceDefinition[]>([])
    const loadedPluginJars = ref<string[]>([])
    const pluginLoadFailures = ref<ConnectorPluginLoadFailure[]>([])
    const loaded = ref(false)
    const loading = ref(false)
    const error = ref<string | null>(null)

    const primaryItems = computed(() => items.value.filter((item) => item.primary))
    const secondaryItems = computed(() => items.value.filter((item) => !item.primary))
    const ids = computed(() => items.value.map((item) => item.id))

    async function ensureLoaded() {
        if (loaded.value || loading.value) return
        loading.value = true
        error.value = null
        try {
            const bundle = await fetchDatasourceCatalogBundle()
            items.value = bundle.datasources
            loadedPluginJars.value = bundle.loadedPluginJars
            pluginLoadFailures.value = bundle.pluginLoadFailures
            loaded.value = true
        } catch (err) {
            error.value = err instanceof Error ? err.message : String(err)
            throw err
        } finally {
            loading.value = false
        }
    }

    function isAvailable(id: string) {
        return items.value.some((item) => item.id === id)
    }

    return {
        items,
        loadedPluginJars,
        pluginLoadFailures,
        loaded,
        loading,
        error,
        primaryItems,
        secondaryItems,
        ids,
        ensureLoaded,
        isAvailable,
    }
})
