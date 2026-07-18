<script setup lang="ts">
import {computed, reactive, ref, watch} from 'vue'
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
    buildDataCatalogFacetOptions,
    canJumpLineage,
    discoveryHitRowKey,
    filterDiscoveryHitsByFacets,
    hasActiveDataCatalogFacets,
    pickLineageJumpTarget,
    toggleFacetValue,
    type DataCatalogFacets,
    type DiscoveryFacetKind,
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
const facets = reactive<DataCatalogFacets>({
    kinds: [],
    connectionIds: [],
    owners: [],
})
const selectedKeys = ref<string[]>([])
const lineageOpen = ref(false)
const lineageLoading = ref(false)
const lineageCandidates = ref<LineageImpactItem[]>([])
const lineageSource = ref<DiscoveryHit | null>(null)

let searchSeq = 0

const facetOptions = computed(() => buildDataCatalogFacetOptions(hits.value))
const filteredHits = computed(() => filterDiscoveryHitsByFacets(hits.value, facets))
const facetsActive = computed(() => hasActiveDataCatalogFacets(facets))
const showFacets = computed(() => hits.value.length > 0)

const rows = computed(() =>
    filteredHits.value.map((hit) => ({
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
        : facetsActive.value
            ? t('discovery.emptyFacets')
            : t('discovery.empty'),
    noMatch: facetsActive.value ? t('discovery.emptyFacets') : t('discovery.empty'),
    loading: t('discovery.loading'),
}))

const selectedHit = computed(() => {
    const key = selectedKeys.value.length === 1 ? selectedKeys.value[0] : null
    if (!key) return null
    return rows.value.find((row) => row.id === key)?._hit ?? null
})

const canOpen = computed(() => Boolean(selectedHit.value))
const canLineage = computed(() => canJumpLineage(selectedHit.value))

function resetFacets() {
    facets.kinds = []
    facets.connectionIds = []
    facets.owners = []
}

function toggleKind(kind: DiscoveryFacetKind) {
    facets.kinds = toggleFacetValue(facets.kinds, kind)
    selectedKeys.value = []
}

function toggleConnection(connectionId: string) {
    facets.connectionIds = toggleFacetValue(facets.connectionIds, connectionId)
    selectedKeys.value = []
}

function toggleOwner(owner: string) {
    facets.owners = toggleFacetValue(facets.owners, owner)
    selectedKeys.value = []
}

function clearFacets() {
    resetFacets()
    selectedKeys.value = []
}

function kindLabel(kind: string) {
    const key = `discovery.kinds.${kind}`
    return t(key) !== key ? t(key) : kind
}

async function runSearch(raw: string) {
    const q = raw.trim()
    if (q.length < 2) {
        hits.value = []
        resetFacets()
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
        resetFacets()
        selectedKeys.value = []
    } catch (err) {
        if (seq !== searchSeq) return
        error.value = err instanceof Error ? err.message : String(err)
        hits.value = []
        resetFacets()
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

    <section v-if="showFacets" class="data-catalog__facets" aria-label="Facets">
      <div v-if="facetOptions.kinds.length" class="data-catalog__facet-row">
        <span class="data-catalog__facet-label">{{ t('discovery.facets.kind') }}</span>
        <button
            v-for="option in facetOptions.kinds"
            :key="'kind:' + option.value"
            type="button"
            class="data-catalog__chip"
            :class="{ 'is-active': facets.kinds.includes(option.value as DiscoveryFacetKind) }"
            @click="toggleKind(option.value as DiscoveryFacetKind)"
        >
          {{ kindLabel(option.value) }}
          <span class="data-catalog__chip-count">{{ option.count }}</span>
        </button>
      </div>
      <div v-if="facetOptions.connections.length" class="data-catalog__facet-row">
        <span class="data-catalog__facet-label">{{ t('discovery.facets.connection') }}</span>
        <button
            v-for="option in facetOptions.connections"
            :key="'conn:' + option.value"
            type="button"
            class="data-catalog__chip"
            :class="{ 'is-active': facets.connectionIds.includes(option.value) }"
            @click="toggleConnection(option.value)"
        >
          {{ option.label }}
          <span class="data-catalog__chip-count">{{ option.count }}</span>
        </button>
      </div>
      <div v-if="facetOptions.owners.length" class="data-catalog__facet-row">
        <span class="data-catalog__facet-label">{{ t('discovery.facets.owner') }}</span>
        <button
            v-for="option in facetOptions.owners"
            :key="'owner:' + option.value"
            type="button"
            class="data-catalog__chip"
            :class="{ 'is-active': facets.owners.includes(option.value) }"
            @click="toggleOwner(option.value)"
        >
          {{ option.label }}
          <span class="data-catalog__chip-count">{{ option.count }}</span>
        </button>
      </div>
      <button
          v-if="facetsActive"
          type="button"
          class="dw-text-btn data-catalog__clear-facets"
          @click="clearFacets"
      >
        {{ t('discovery.facets.clear') }}
      </button>
    </section>

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

.data-catalog__facets {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.data-catalog__facet-row {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 6px;
}

.data-catalog__facet-label {
  min-width: 4.5rem;
  color: var(--dw-text-muted, #6b7280);
  font-size: 0.75rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.03em;
}

.data-catalog__chip {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  border: 1px solid var(--dw-border, #d1d5db);
  border-radius: 999px;
  background: var(--dw-surface, #fff);
  color: var(--dw-text, #111827);
  font-size: 0.8rem;
  line-height: 1;
  padding: 5px 10px;
  cursor: pointer;
}

.data-catalog__chip:hover {
  border-color: var(--dw-accent, #2563eb);
}

.data-catalog__chip.is-active {
  border-color: var(--dw-accent, #2563eb);
  background: color-mix(in srgb, var(--dw-accent, #2563eb) 12%, transparent);
  color: var(--dw-accent, #2563eb);
}

.data-catalog__chip-count {
  color: var(--dw-text-muted, #6b7280);
  font-variant-numeric: tabular-nums;
}

.data-catalog__chip.is-active .data-catalog__chip-count {
  color: inherit;
  opacity: 0.8;
}

.data-catalog__clear-facets {
  align-self: flex-start;
  font-size: 0.8rem;
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
