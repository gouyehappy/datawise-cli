<script setup lang="ts">
import {computed, onMounted, ref} from 'vue'
import {useI18n} from 'vue-i18n'
import {datasourcesApi} from '@/api'
import SearchInput from '@/core/components/SearchInput.vue'
import {DwButton, DwSelect, EmptyState, ModuleHeroSettingsMenu, type ModuleHeroMenuItem} from '@/core/components'
import {DwIcon} from '@/core/icons'
import ConnectorMarketCard from '@/features/plugin/components/ConnectorMarketCard.vue'
import type {ConnectorMarketEntry} from '@/features/datasource/types/datasource.types'
import {
    fetchConnectorMarketBundle,
    filterConnectorMarketEntries,
    summarizeConnectorMarket,
} from '@/features/datasource/services/connector-market.service'
import {
    defaultConnectorMarketOrder,
    mergeConnectorMarketOrder,
    moveConnectorInOrder,
    readMarketCustomOrder,
    readMarketSortMode,
    resolveConnectorCardSize,
    sortConnectorMarketEntries,
    writeMarketCustomOrder,
    writeMarketSortMode,
    type ConnectorMarketSortMode,
} from '@/features/datasource/services/connector-market-layout.service'
import {useLayoutStore} from '@/features/layout/stores/layout'
import {useAuthStore} from '@/features/auth/stores/auth-store'
import {CORE_CONNECTOR_IDS} from '@/features/settings/services/runtime-format.service'
import type {SelectOption} from '@/core/components/select.types'

type AvailabilityFilter = 'all' | 'ready' | 'pending'

const props = withDefaults(defineProps<{
    compact?: boolean
    standalone?: boolean
}>(), {
    compact: false,
    standalone: false,
})

const {t} = useI18n()
const layout = useLayoutStore()
const auth = useAuthStore()
const loading = ref(false)
const reloading = ref(false)
const installingCore = ref(false)
const cleaningRedundant = ref(false)
const error = ref<string | null>(null)
const search = ref('')
const availability = ref<AvailabilityFilter>('all')
const entries = ref<ConnectorMarketEntry[]>([])
const loadedPluginJars = ref<string[]>([])
const manifestSummary = ref<{schemaVersion: number; updatedAt?: string; channel?: string; pluginCount: number} | null>(null)
const runtimeExpanded = ref(false)
const sortMode = ref<ConnectorMarketSortMode>(readMarketSortMode())
const customOrder = ref<string[]>(readMarketCustomOrder())
const draggingId = ref<string | null>(null)
const dropTargetId = ref<string | null>(null)

onMounted(() => {
    void loadMarket()
})

async function loadMarket() {
    loading.value = true
    error.value = null
    try {
        const bundle = await fetchConnectorMarketBundle()
        entries.value = bundle.connectors
        loadedPluginJars.value = bundle.loadedPluginJars
        manifestSummary.value = bundle.manifest ?? null
        customOrder.value = mergeConnectorMarketOrder(customOrder.value, bundle.connectors)
    } catch (err) {
        error.value = err instanceof Error ? err.message : String(err)
    } finally {
        loading.value = false
    }
}

const summary = computed(() => summarizeConnectorMarket(entries.value))

const readinessPercent = computed(() => {
    if (!summary.value.total) return 0
    return Math.round((summary.value.available / summary.value.total) * 100)
})

const filteredEntries = computed(() => {
    let list = filterConnectorMarketEntries(entries.value, search.value)
    if (availability.value === 'ready') {
        list = list.filter((entry) => entry.available)
    } else if (availability.value === 'pending') {
        list = list.filter((entry) => !entry.available)
    }
    return sortConnectorMarketEntries(list, sortMode.value, customOrder.value)
})

const boardTiles = computed(() =>
    filteredEntries.value.map((entry, index) => ({
        entry,
        size: resolveConnectorCardSize(entry, index, {standalone: props.standalone}),
    })),
)

const showPendingBanner = computed(
    () => props.standalone
        && !loading.value
        && !error.value
        && summary.value.pending > 0
        && availability.value !== 'pending',
)

const filterOptions: AvailabilityFilter[] = ['all', 'ready', 'pending']

const sortOptions = computed<SelectOption[]>(() => [
    {value: 'featured', label: t('plugin.connectorMarket.sort.featured')},
    {value: 'name', label: t('plugin.connectorMarket.sort.name')},
    {value: 'status', label: t('plugin.connectorMarket.sort.status')},
    {value: 'custom', label: t('plugin.connectorMarket.sort.custom')},
])

const reorderable = computed(() => props.standalone && !loading.value && !error.value)

function filterLabel(key: AvailabilityFilter): string {
    return t(`plugin.connectorMarket.filter.${key}`)
}

function onSortModeChange(mode: string) {
    const next = mode as ConnectorMarketSortMode
    sortMode.value = next
    writeMarketSortMode(next)
    if (next === 'custom' && customOrder.value.length === 0) {
        customOrder.value = defaultConnectorMarketOrder(entries.value)
        writeMarketCustomOrder(customOrder.value)
    }
}

function focusPending() {
    availability.value = 'pending'
    search.value = ''
}

function onCardDragStart(id: string) {
    draggingId.value = id
    if (sortMode.value !== 'custom') {
        sortMode.value = 'custom'
        writeMarketSortMode('custom')
        customOrder.value = mergeConnectorMarketOrder(
            customOrder.value.length ? customOrder.value : defaultConnectorMarketOrder(entries.value),
            entries.value,
        )
        writeMarketCustomOrder(customOrder.value)
    }
}

function onCardDragOver(id: string) {
    if (!draggingId.value || draggingId.value === id) return
    dropTargetId.value = id
}

function onCardDrop(toId: string) {
    const fromId = draggingId.value
    dropTargetId.value = null
    draggingId.value = null
    if (!fromId || fromId === toId) return
    const next = moveConnectorInOrder(
        mergeConnectorMarketOrder(customOrder.value, entries.value),
        fromId,
        toId,
    )
    customOrder.value = next
    writeMarketCustomOrder(next)
    sortMode.value = 'custom'
    writeMarketSortMode('custom')
}

function onCardDragEnd() {
    draggingId.value = null
    dropTargetId.value = null
}

async function reloadPlugins() {
    if (reloading.value || loading.value) return
    reloading.value = true
    try {
        const result = await datasourcesApi.reloadPlugins()
        layout.showSuccessToast(t('plugin.connectorMarket.reloadSuccess', {
            jars: result.loadedJarCount,
            connectors: result.loadedConnectorIds?.length ?? 0,
        }))
        if (result.failures?.length) {
            layout.showWarningToast(t('plugin.connectorMarket.reloadPartial', {
                count: result.failures.length,
            }))
        }
        await loadMarket()
    } catch (err) {
        layout.showErrorToast(err instanceof Error ? err.message : t('plugin.connectorMarket.reloadFailed'))
    } finally {
        reloading.value = false
    }
}

async function installCoreConnectors() {
    if (!auth.isAdmin || installingCore.value || loading.value) return
    const pendingCore = entries.value
        .filter((entry) =>
            (CORE_CONNECTOR_IDS as readonly string[]).includes(entry.id)
            && !entry.available
            && entry.downloadUrl?.trim(),
        )
        .map((entry) => entry.id)
    if (!pendingCore.length) {
        layout.showToast(t('plugin.connectorMarket.installCoreSuccess', {count: 0}))
        return
    }
    installingCore.value = true
    try {
        const result = await datasourcesApi.installFromMarketBatch(pendingCore)
        const ok = result.results.filter((item) => item.jarName).length
        layout.showSuccessToast(t('plugin.connectorMarket.installCoreSuccess', {count: ok}))
        await loadMarket()
    } catch (err) {
        layout.showErrorToast(
            err instanceof Error ? err.message : t('plugin.connectorMarket.installCoreFailed'),
        )
    } finally {
        installingCore.value = false
    }
}

async function cleanupRedundantPlugins() {
    if (!auth.isAdmin || cleaningRedundant.value || loading.value) return
    cleaningRedundant.value = true
    try {
        const result = await datasourcesApi.cleanupRedundantPlugins()
        layout.showSuccessToast(t('plugin.connectorMarket.cleanupRedundantSuccess', {
            count: result.deletedCount,
        }))
        await loadMarket()
    } catch (err) {
        layout.showErrorToast(
            err instanceof Error ? err.message : t('plugin.connectorMarket.cleanupRedundantFailed'),
        )
    } finally {
        cleaningRedundant.value = false
    }
}

const heroMenuItems = computed<ModuleHeroMenuItem[]>(() => {
    const items: ModuleHeroMenuItem[] = [
        {
            id: 'refresh',
            label: t('plugin.connectorMarket.refresh'),
            icon: 'refresh',
            disabled: loading.value || reloading.value,
        },
        {
            id: 'reload',
            label: reloading.value
                ? t('plugin.connectorMarket.reloading')
                : t('plugin.connectorMarket.reloadPlugins'),
            icon: 'run',
            disabled: loading.value || reloading.value,
        },
    ]
    if (auth.isAdmin) {
        items.push(
            {
                id: 'install-core',
                label: installingCore.value
                    ? t('plugin.connectorMarket.installingCore')
                    : t('plugin.connectorMarket.installCore'),
                icon: 'plugins',
                disabled: loading.value || reloading.value || installingCore.value,
                dividerBefore: true,
            },
            {
                id: 'cleanup',
                label: cleaningRedundant.value
                    ? t('plugin.connectorMarket.cleaningRedundant')
                    : t('plugin.connectorMarket.cleanupRedundant'),
                icon: 'delete',
                disabled: loading.value || reloading.value || cleaningRedundant.value,
            },
        )
    }
    return items
})

function onHeroMenuSelect(id: string) {
    if (id === 'refresh') {
        void loadMarket()
        return
    }
    if (id === 'reload') {
        void reloadPlugins()
        return
    }
    if (id === 'install-core') {
        void installCoreConnectors()
        return
    }
    if (id === 'cleanup') {
        void cleanupRedundantPlugins()
    }
}
</script>

<template>
  <div
      class="connector-market"
      :class="{
        'connector-market--compact': compact,
        'connector-market--page': standalone,
      }"
  >
    <header v-if="standalone" class="mp-hero mp-hero--glow mp-hero--with-settings connector-market-hero">
      <div class="mp-hero__glow" aria-hidden="true"/>
      <div class="mp-hero__settings">
        <ModuleHeroSettingsMenu
            :ariaLabel="t('plugin.connectorMarket.settingsMenu.aria')"
            :items="heroMenuItems"
            :active="reloading || installingCore || cleaningRedundant"
            @select="onHeroMenuSelect"
        />
      </div>
      <div class="mp-hero__inner">
        <div class="mp-hero__copy">
          <p class="mp-hero__eyebrow">{{ t('plugin.connectorMarket.eyebrow') }}</p>
          <h1 class="mp-hero__title">{{ t('plugin.connectorMarket.title') }}</h1>
          <p class="mp-hero__sub">{{ t('plugin.connectorMarket.subtitle') }}</p>
        </div>
      </div>
    </header>

    <div v-else class="connector-market__head">
      <div>
        <h3 class="connector-market__title">{{ t('plugin.connectorMarket.title') }}</h3>
        <p class="connector-market__sub">{{ t('plugin.connectorMarket.subtitle') }}</p>
      </div>
    </div>

    <section
        v-if="standalone && !loading && !error"
        class="connector-market-status"
        aria-label="connector market status"
    >
      <div class="connector-market-status__item">
        <span class="connector-market-status__label">{{ t('plugin.connectorMarket.filter.ready') }}</span>
        <strong class="connector-market-status__value">{{ summary.available }}</strong>
      </div>
      <div class="connector-market-status__item">
        <span class="connector-market-status__label">{{ t('plugin.connectorMarket.filter.pending') }}</span>
        <strong class="connector-market-status__value">{{ summary.pending }}</strong>
      </div>
      <div class="connector-market-status__item">
        <span class="connector-market-status__label">{{ t('plugin.connectorMarket.filter.all') }}</span>
        <strong class="connector-market-status__value">{{ summary.total }}</strong>
      </div>
      <div class="connector-market-status__item connector-market-status__item--readiness">
        <div class="connector-market-status__readiness-row">
          <span class="connector-market-status__label">{{ t('plugin.connectorMarket.readinessShort') }}</span>
          <strong class="connector-market-status__value connector-market-status__value--inline">{{ readinessPercent }}%</strong>
        </div>
        <div class="connector-market-status__bar" aria-hidden="true">
          <span :style="{width: `${readinessPercent}%`}"/>
        </div>
        <span v-if="manifestSummary" class="connector-market-status__meta">
          {{ t('plugin.connectorMarket.manifestSummary', {
            count: manifestSummary.pluginCount,
            channel: manifestSummary.channel || t('plugin.connectorMarket.manifestChannelLocal'),
          }) }}
        </span>
      </div>
    </section>

    <div
        v-if="showPendingBanner"
        class="connector-market-pending-alert"
        role="status"
    >
      <div class="connector-market-pending-alert__copy">
        <strong>{{ t('plugin.connectorMarket.pendingBannerTitle', {count: summary.pending}) }}</strong>
        <p>{{ t('plugin.connectorMarket.pendingBannerHint') }}</p>
      </div>
      <DwButton size="sm" @click="focusPending">
        {{ t('plugin.connectorMarket.pendingBannerAction') }}
      </DwButton>
    </div>

    <section class="connector-market-library" :class="{'connector-market-library--embed': !standalone}">
      <header v-if="standalone" class="connector-market-library__head">
        <div>
          <h2>{{ t('plugin.connectorMarket.libraryTitle') }}</h2>
          <p>{{ t('plugin.connectorMarket.libraryHint') }}</p>
        </div>
      </header>

      <div class="connector-market-toolbar">
        <div v-if="standalone" class="dw-segment connector-market-filters" role="tablist">
          <button
              v-for="option in filterOptions"
              :key="option"
              class="dw-segment__btn"
              :class="{'is-active': availability === option}"
              type="button"
              role="tab"
              :aria-selected="availability === option"
              @click="availability = option"
          >
            {{ filterLabel(option) }}
            <span v-if="option === 'ready'" class="connector-market-filters__count">{{ summary.available }}</span>
            <span v-else-if="option === 'pending'" class="connector-market-filters__count">{{ summary.pending }}</span>
          </button>
        </div>
        <SearchInput
            v-model="search"
            class="connector-market-toolbar__search"
            size="sm"
            :placeholder="t('plugin.connectorMarket.searchPlaceholder')"
        />
        <DwSelect
            v-if="standalone"
            class="connector-market-toolbar__sort"
            size="sm"
            v-model="sortMode"
            :options="sortOptions"
            :aria-label="t('plugin.connectorMarket.sort.label')"
            @update:model-value="onSortModeChange"
        />
        <span v-if="standalone && !loading && !error" class="connector-market-toolbar__count">
          {{ t('plugin.connectorMarket.matchCount', {count: filteredEntries.length}) }}
        </span>
      </div>

      <p v-if="standalone && reorderable && !loading && !error" class="connector-market-reorder-hint">
        {{ t('plugin.connectorMarket.reorderHint') }}
      </p>

      <div v-if="loading" class="connector-market-skeleton" aria-busy="true">
        <div
            v-for="n in 6"
            :key="n"
            class="connector-market-skeleton__card"
            :class="`connector-market-skeleton__card--${n === 1 ? 'hero' : n % 3 === 0 ? 'tall' : 'standard'}`"
        />
      </div>

      <EmptyState
          v-else-if="error"
          embedded
          :title="t('plugin.connectorMarket.loadFailed')"
          :hint="error"
      />

      <EmptyState
          v-else-if="!boardTiles.length"
          embedded
          :title="t('plugin.connectorMarket.empty')"
          :hint="t('plugin.connectorMarket.emptyHint')"
      />

      <div
          v-else
          class="connector-market-board"
          :class="{'connector-market-board--dragging': !!draggingId}"
      >
        <ConnectorMarketCard
            v-for="(tile, index) in boardTiles"
            :key="tile.entry.id"
            :entry="tile.entry"
            :index="index"
            :size="tile.size"
            :standalone="standalone"
            :reorderable="reorderable"
            :dragging="draggingId === tile.entry.id"
            :drop-target="dropTargetId === tile.entry.id"
            @installed="loadMarket"
            @drag-start="onCardDragStart"
            @drag-over="onCardDragOver"
            @drop="onCardDrop"
            @drag-end="onCardDragEnd"
        />
      </div>
    </section>

    <footer v-if="standalone && !loading" class="connector-market-runtime">
      <button
          class="connector-market-runtime__toggle"
          type="button"
          :aria-expanded="runtimeExpanded"
          @click="runtimeExpanded = !runtimeExpanded"
      >
        <DwIcon name="connectors" :size="14" :stroke-width="1.6"/>
        <span>
          {{
            loadedPluginJars.length
                ? t('plugin.connectorMarket.loadedJars', {count: loadedPluginJars.length})
                : t('plugin.connectorMarket.noRuntimeJars')
          }}
        </span>
        <DwIcon
            name="chevron-left"
            class="connector-market-runtime__chevron"
            :class="{'is-open': runtimeExpanded}"
            :size="14"
            :stroke-width="2"
        />
      </button>
      <ul v-if="runtimeExpanded && loadedPluginJars.length" class="connector-market-runtime__list">
        <li v-for="jar in loadedPluginJars" :key="jar">{{ jar }}</li>
      </ul>
      <p v-else-if="runtimeExpanded" class="connector-market-runtime__empty">
        {{ t('plugin.connectorMarket.noRuntimeJarsHint') }}
      </p>
    </footer>
  </div>
</template>

<style scoped>
.connector-market__head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: var(--dw-space-6);
  margin-bottom: var(--dw-space-6);
}

.connector-market__title {
  margin: 0;
  font-size: var(--dw-text-lg);
  font-weight: 600;
}

.connector-market__sub {
  margin: var(--dw-space-2) 0 0;
  font-size: var(--dw-text-sm);
  color: var(--dw-text-muted);
}
</style>
