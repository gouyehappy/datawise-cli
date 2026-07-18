<script setup lang="ts">
import {computed, ref, watch} from 'vue'
import {useI18n} from 'vue-i18n'
import DwDataGrid from '@/core/components/DwDataGrid.vue'
import SearchInput from '@/core/components/SearchInput.vue'
import {AppModal, ModalActions} from '@/core/components'
import {DwIcon} from '@/core/icons'
import type {DwDataGridColumn, DwDataGridLabels} from '@/core/components/dw-data-grid.types'
import type {WorkspaceTab} from '@/core/types'
import {platformApi} from '@/api'
import {lineageApi} from '@/api/modules/lineage'
import type {DiscoveryHit} from '@/features/platform/types/platform.types'
import type {LineageImpactItem} from '@/features/lineage/types/lineage.types'
import {
    canJumpLineage,
    discoveryHitRowKey,
    pickLineageJumpTarget,
} from '@/features/discovery/services/data-catalog.service'
import {activateGlobalObjectSearchEntry} from '@/features/explorer/services/global-object-search.actions'
import {discoveryHitsToSearchEntries} from '@/features/explorer/services/global-object-discovery.service'
import {useDebouncedRef} from '@/core/utils/debounced-ref'
import {useLayoutStore} from '@/features/layout/stores/layout'
import {useWorkspaceStore} from '@/features/workspace/stores/workspace'

defineProps<{ tab: WorkspaceTab }>()

const {t} = useI18n()
const layout = useLayoutStore()
const workspace = useWorkspaceStore()

const query = ref('')
const debouncedQuery = useDebouncedRef(query, 220)
const loading = ref(false)
const error = ref('')
const hits = ref<DiscoveryHit[]>([])
const selectedKeys = ref<string[]>([])
const lineageOpen = ref(false)
const lineageLoading = ref(false)
const lineageCandidates = ref<LineageImpactItem[]>([])
const lineageSource = ref<DiscoveryHit | null>(null)

let searchSeq = 0

const rows = computed(() =>
    hits.value.map((hit) => ({
        id: discoveryHitRowKey(hit),
        kind: hit.kind,
        name: hit.name,
        qualifiedLabel: hit.qualifiedLabel,
        connectionLabel: hit.connectionLabel,
        database: hit.database,
        owner: hit.owner ?? '',
        subtitle: hit.subtitle ?? '',
        score: hit.score,
        _hit: hit,
    })),
)

const columns = computed<DwDataGridColumn<(typeof rows.value)[number]>[]>(() => [
    {key: 'kind', label: t('discovery.columns.kind'), mono: true},
    {key: 'name', label: t('discovery.columns.name'), mono: true},
    {key: 'qualifiedLabel', label: t('discovery.columns.qualified')},
    {key: 'connectionLabel', label: t('discovery.columns.connection')},
    {key: 'database', label: t('discovery.columns.database')},
    {key: 'owner', label: t('discovery.columns.owner')},
    {key: 'subtitle', label: t('discovery.columns.subtitle')},
    {key: 'score', label: t('discovery.columns.score'), align: 'right'},
])

const gridLabels = computed<Partial<DwDataGridLabels>>(() => ({
    empty: debouncedQuery.value.trim().length < 2
        ? t('discovery.emptyHint')
        : t('discovery.empty'),
    noMatch: t('discovery.empty'),
    loading: t('discovery.loading'),
}))

const selectedHit = computed(() => {
    const key = selectedKeys.value.length === 1 ? selectedKeys.value[0] : null
    if (!key) return null
    return rows.value.find((row) => row.id === key)?._hit ?? null
})

const canOpen = computed(() => Boolean(selectedHit.value))
const canLineage = computed(() => canJumpLineage(selectedHit.value))

async function runSearch(raw: string) {
    const q = raw.trim()
    if (q.length < 2) {
        hits.value = []
        error.value = ''
        return
    }
    const seq = ++searchSeq
    loading.value = true
    error.value = ''
    try {
        const result = await platformApi.searchDiscovery(q, 80)
        if (seq !== searchSeq) return
        hits.value = result
        selectedKeys.value = []
    } catch (err) {
        if (seq !== searchSeq) return
        error.value = err instanceof Error ? err.message : String(err)
        hits.value = []
    } finally {
        if (seq === searchSeq) loading.value = false
    }
}

watch(debouncedQuery, (value) => {
    void runSearch(value)
})

async function openSelected() {
    const hit = selectedHit.value
    if (!hit) return
    const [entry] = discoveryHitsToSearchEntries([hit])
    if (!entry) return
    await activateGlobalObjectSearchEntry(entry)
}

async function openLineageForHit(hit: DiscoveryHit) {
    if (!canJumpLineage(hit)) return
    lineageLoading.value = true
    lineageSource.value = hit
    try {
        const impact = await lineageApi.getImpact({
            connectionId: hit.connectionId,
            instanceName: hit.database,
            name: hit.name,
        })
        const auto = pickLineageJumpTarget(impact.downstream, hit.name)
        if (auto) {
            workspace.openViewModelLineage({
                viewModelName: auto.modelName,
                connectionId: hit.connectionId,
                database: hit.database,
            })
            return
        }
        if (!impact.downstream.length) {
            layout.showWarningToast(t('discovery.lineageEmpty'))
            return
        }
        lineageCandidates.value = [...impact.downstream]
        lineageOpen.value = true
    } catch (err) {
        layout.showErrorToast(err instanceof Error ? err.message : String(err))
    } finally {
        lineageLoading.value = false
    }
}

async function openLineageSelected() {
    const hit = selectedHit.value
    if (!hit) return
    await openLineageForHit(hit)
}

function chooseLineageTarget(item: LineageImpactItem) {
    const hit = lineageSource.value
    if (!hit) return
    lineageOpen.value = false
    workspace.openViewModelLineage({
        viewModelName: item.modelName,
        connectionId: hit.connectionId,
        database: hit.database,
    })
}
</script>

<template>
  <div class="data-catalog">
    <header class="data-catalog__header">
      <div>
        <h2 class="data-catalog__title">{{ t('discovery.tabTitle') }}</h2>
        <p class="data-catalog__sub">{{ t('discovery.subtitle') }}</p>
      </div>
      <div class="data-catalog__search">
        <SearchInput
            v-model="query"
            :placeholder="t('discovery.searchPlaceholder')"
        />
      </div>
    </header>

    <DwDataGrid
        v-model:selected-keys="selectedKeys"
        :rows="rows"
        :columns="columns"
        row-key="id"
        :loading="loading || lineageLoading"
        :error="error"
        :labels="gridLabels"
        :show-search="false"
        :column-filter="false"
    >
      <template #toolbar-actions>
        <button type="button" :disabled="!canOpen || loading" @click="openSelected">
          <DwIcon name="table" size="sm" :stroke-width="1.35"/>
          {{ t('discovery.open') }}
        </button>
        <button type="button" :disabled="!canLineage || loading || lineageLoading" @click="openLineageSelected">
          <DwIcon name="explain" size="sm" :stroke-width="1.35"/>
          {{ t('discovery.openLineage') }}
        </button>
      </template>
    </DwDataGrid>

    <AppModal
        :open="lineageOpen"
        :title="t('discovery.lineagePickTitle')"
        width="420px"
        @close="lineageOpen = false"
    >
      <p class="data-catalog__hint">{{ t('discovery.lineagePickHint') }}</p>
      <ul class="data-catalog__lineage-list">
        <li v-for="item in lineageCandidates" :key="item.modelName + item.fileName">
          <button type="button" class="dw-text-btn" @click="chooseLineageTarget(item)">
            {{ item.modelName }}
            <span v-if="item.staleSidecar" class="data-catalog__stale">{{ t('discovery.lineageStale') }}</span>
          </button>
        </li>
      </ul>
      <template #footer>
        <ModalActions>
          <button type="button" class="dw-btn" @click="lineageOpen = false">
            {{ t('common.cancel') }}
          </button>
        </ModalActions>
      </template>
    </AppModal>
  </div>
</template>

<style scoped>
.data-catalog {
  display: flex;
  flex-direction: column;
  gap: 12px;
  height: 100%;
  min-height: 0;
  padding: 12px 16px 16px;
}

.data-catalog__header {
  display: flex;
  flex-wrap: wrap;
  align-items: flex-end;
  justify-content: space-between;
  gap: 12px;
}

.data-catalog__title {
  margin: 0;
  font-size: 1.1rem;
  font-weight: 600;
}

.data-catalog__sub {
  margin: 4px 0 0;
  color: var(--dw-text-muted, #6b7280);
  font-size: 0.85rem;
}

.data-catalog__search {
  min-width: min(360px, 100%);
  flex: 1;
  max-width: 420px;
}

.data-catalog__hint {
  margin: 0 0 12px;
  color: var(--dw-text-muted, #6b7280);
  font-size: 0.85rem;
}

.data-catalog__lineage-list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.data-catalog__stale {
  margin-left: 8px;
  color: var(--dw-warning, #b45309);
  font-size: 0.75rem;
}
</style>
