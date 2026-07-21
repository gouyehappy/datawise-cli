<script setup lang="ts">
import {computed, onMounted, ref} from 'vue'
import {useI18n} from 'vue-i18n'
import {datasourcesApi} from '@/api'
import SearchInput from '@/core/components/SearchInput.vue'
import {DwButton, EmptyState} from '@/core/components'
import {DwIcon} from '@/core/icons'
import ConnectorMarketCard from '@/features/plugin/components/ConnectorMarketCard.vue'
import type {ConnectorMarketEntry} from '@/features/datasource/types/datasource.types'
import {
    fetchConnectorMarketBundle,
    filterConnectorMarketEntries,
    summarizeConnectorMarket,
} from '@/features/datasource/services/connector-market.service'
import {useLayoutStore} from '@/features/layout/stores/layout'
import {useAuthStore} from '@/features/auth/stores/auth-store'
import {CORE_CONNECTOR_IDS} from '@/features/settings/services/runtime-format.service'

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
    return list
})

const primaryEntries = computed(() => filteredEntries.value.filter((entry) => entry.primary))
const secondaryEntries = computed(() => filteredEntries.value.filter((entry) => !entry.primary))

const showPendingBanner = computed(
    () => props.standalone
        && !loading.value
        && !error.value
        && summary.value.pending > 0
        && availability.value !== 'pending',
)

const filterOptions: AvailabilityFilter[] = ['all', 'ready', 'pending']

function filterLabel(key: AvailabilityFilter): string {
    return t(`plugin.connectorMarket.filter.${key}`)
}

function focusPending() {
    availability.value = 'pending'
    search.value = ''
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
</script>

<template>
  <div
      class="connector-market"
      :class="{
        'connector-market--compact': compact,
        'connector-market--page': standalone,
      }"
  >
    <header v-if="standalone" class="mp-hero mp-hero--compact connector-market-hero">
      <div class="mp-hero__inner">
        <div class="mp-hero__copy">
          <h1 class="mp-hero__title">{{ t('plugin.connectorMarket.title') }}</h1>
          <p class="mp-hero__sub">{{ t('plugin.connectorMarket.subtitle') }}</p>
        </div>
        <div class="mp-hero__actions connector-market-hero__actions">
          <DwButton
              size="sm"
              variant="secondary"
              :disabled="loading || reloading"
              :loading="reloading"
              @click="reloadPlugins()"
          >
            <DwIcon name="run" :size="14" :stroke-width="1.8"/>
            {{ reloading ? t('plugin.connectorMarket.reloading') : t('plugin.connectorMarket.reloadPlugins') }}
          </DwButton>
          <DwButton
              v-if="auth.isAdmin"
              size="sm"
              :disabled="loading || reloading || installingCore"
              :loading="installingCore"
              @click="installCoreConnectors()"
          >
            <DwIcon name="plugins" :size="14" :stroke-width="1.8"/>
            {{ installingCore ? t('plugin.connectorMarket.installingCore') : t('plugin.connectorMarket.installCore') }}
          </DwButton>
          <DwButton
              v-if="auth.isAdmin"
              size="sm"
              variant="ghost"
              :title="t('plugin.connectorMarket.cleanupRedundantHint')"
              :disabled="loading || reloading || cleaningRedundant"
              :loading="cleaningRedundant"
              @click="cleanupRedundantPlugins()"
          >
            <DwIcon name="delete" :size="14" :stroke-width="1.8"/>
            {{ cleaningRedundant ? t('plugin.connectorMarket.cleaningRedundant') : t('plugin.connectorMarket.cleanupRedundant') }}
          </DwButton>
          <DwButton
              size="sm"
              variant="secondary"
              :disabled="loading || reloading"
              @click="loadMarket()"
          >
            <DwIcon name="refresh" :size="14" :stroke-width="1.8"/>
            {{ t('plugin.connectorMarket.refresh') }}
          </DwButton>
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
      <div class="connector-market-status__item">
        <span class="connector-market-status__label">{{ t('plugin.connectorMarket.readinessShort') }}</span>
        <strong class="connector-market-status__value">{{ readinessPercent }}%</strong>
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

      <div class="connector-market-toolbar" :class="{'connector-market-toolbar--embed': !standalone}">
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
        <span v-if="standalone && !loading && !error" class="connector-market-toolbar__count">
          {{ t('plugin.connectorMarket.matchCount', {count: filteredEntries.length}) }}
        </span>
      </div>

      <div v-if="loading" class="connector-market-skeleton" aria-busy="true">
        <div v-for="n in 6" :key="n" class="connector-market-skeleton__card"/>
      </div>

      <EmptyState
          v-else-if="error"
          embedded
          :title="t('plugin.connectorMarket.loadFailed')"
          :hint="error"
      />

      <EmptyState
          v-else-if="!filteredEntries.length"
          embedded
          :title="t('plugin.connectorMarket.empty')"
          :hint="t('plugin.connectorMarket.emptyHint')"
      />

      <div v-else class="connector-market-body">
        <section v-if="primaryEntries.length" class="connector-market-section">
          <div class="connector-market-section__head">
            <h3 class="connector-market-section__title">
              {{ standalone ? t('plugin.connectorMarket.featured') : t('plugin.connectorMarket.primary') }}
              <span class="connector-market-section__count">{{ primaryEntries.length }}</span>
            </h3>
            <p v-if="standalone" class="connector-market-section__hint">
              {{ t('plugin.connectorMarket.featuredHint') }}
            </p>
          </div>
          <div class="connector-market-grid">
            <ConnectorMarketCard
                v-for="(entry, index) in primaryEntries"
                :key="entry.id"
                :entry="entry"
                :index="index"
                :standalone="standalone"
                @installed="loadMarket"
            />
          </div>
        </section>

        <section v-if="secondaryEntries.length" class="connector-market-section">
          <div class="connector-market-section__head">
            <h3 class="connector-market-section__title">
              {{ standalone ? t('plugin.connectorMarket.catalog') : t('plugin.connectorMarket.more') }}
              <span class="connector-market-section__count">{{ secondaryEntries.length }}</span>
            </h3>
          </div>
          <div class="connector-market-grid">
            <ConnectorMarketCard
                v-for="(entry, index) in secondaryEntries"
                :key="entry.id"
                :entry="entry"
                :index="index + primaryEntries.length"
                :standalone="standalone"
                @installed="loadMarket"
            />
          </div>
        </section>
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
.connector-market--page {
  display: flex;
  flex-direction: column;
  gap: 0;
  min-width: 0;
}

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

.connector-market-toolbar--embed {
  margin-bottom: var(--dw-space-6);
}
</style>
