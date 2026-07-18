<script setup lang="ts">
import {computed, onMounted, ref} from 'vue'
import {useI18n} from 'vue-i18n'
import DbTypeIcon from '@/core/components/DbTypeIcon.vue'
import SearchInput from '@/core/components/SearchInput.vue'
import {EmptyState} from '@/core/components'
import {DwIcon} from '@/core/icons'
import ConnectorMarketCard from '@/features/plugin/components/ConnectorMarketCard.vue'
import type {ConnectorMarketEntry} from '@/features/datasource/types/datasource.types'
import {
    fetchConnectorMarketBundle,
    filterConnectorMarketEntries,
    summarizeConnectorMarket,
} from '@/features/datasource/services/connector-market.service'
import {connectorMarketAccentVars} from '@/features/datasource/services/connector-market-theme.service'
import type {DbType} from '@/core/types'
import {usePluginStore} from '@/features/plugin/stores/plugin-store'

type AvailabilityFilter = 'all' | 'ready' | 'pending'

const props = withDefaults(defineProps<{
    compact?: boolean
    standalone?: boolean
}>(), {
    compact: false,
    standalone: false,
})

const {t} = useI18n()
const pluginStore = usePluginStore()
const loading = ref(false)
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

const heroSpotlight = computed(() =>
    entries.value.filter((entry) => entry.available && entry.primary).slice(0, 7),
)

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
</script>

<template>
  <div
      class="connector-market"
      :class="{
        'connector-market--compact': compact,
        'connector-market--page': standalone,
      }"
  >
    <header v-if="standalone" class="connector-market-hero">
      <div class="connector-market-hero__mesh" aria-hidden="true"/>
      <div v-if="heroSpotlight.length" class="connector-market-hero__orbit" aria-hidden="true">
        <div
            v-for="(entry, index) in heroSpotlight"
            :key="entry.id"
            class="connector-market-hero__orb"
            :style="{...connectorMarketAccentVars(entry.id), '--cm-orb-i': index}"
        >
          <DbTypeIcon :db-type="entry.id as DbType" :size="18"/>
        </div>
      </div>

      <div class="connector-market-hero__inner">
        <div class="connector-market-hero__top">
          <button class="connector-market-hero__back" type="button" @click="pluginStore.openPluginCenter()">
            <DwIcon name="chevron-left" :size="14" :stroke-width="2"/>
            {{ t('plugin.connectorMarket.backToCenter') }}
          </button>
          <button
              class="dw-text-btn"
              type="button"
              :disabled="loading"
              @click="loadMarket()"
          >
            <DwIcon name="refresh" :size="14" :stroke-width="1.8"/>
            {{ t('plugin.connectorMarket.refresh') }}
          </button>
        </div>

        <div class="connector-market-hero__copy">
          <p class="connector-market-hero__eyebrow">{{ t('plugin.connectorMarket.eyebrow') }}</p>
          <h1 class="connector-market-hero__title">{{ t('plugin.connectorMarket.title') }}</h1>
          <p class="connector-market-hero__sub">{{ t('plugin.connectorMarket.subtitle') }}</p>
          <div class="connector-market-hero__stats">
            <span class="connector-market-stat">
              <span class="connector-market-stat__dot connector-market-stat__dot--ready" aria-hidden="true"/>
              <span>{{ t('plugin.connectorMarket.availableCount', {count: summary.available}) }}</span>
            </span>
            <span class="connector-market-stat">
              <span class="connector-market-stat__dot connector-market-stat__dot--pending" aria-hidden="true"/>
              <span>{{ t('plugin.connectorMarket.pendingCount', {count: summary.pending}) }}</span>
            </span>
            <span class="connector-market-stat">
              <span class="connector-market-stat__dot connector-market-stat__dot--total" aria-hidden="true"/>
              <span>{{ t('plugin.connectorMarket.totalCount', {count: summary.total}) }}</span>
            </span>
            <span v-if="manifestSummary" class="connector-market-stat">
              <span>{{ t('plugin.connectorMarket.manifestSummary', {
                count: manifestSummary.pluginCount,
                channel: manifestSummary.channel || t('plugin.connectorMarket.manifestChannelLocal'),
              }) }}</span>
            </span>
          </div>
        </div>

        <div v-if="!loading && !error" class="connector-market-hero__aside">
          <div
              class="connector-market-ring"
              :style="{'--cm-pct': readinessPercent, ...connectorMarketAccentVars('generic')}"
              role="img"
              :aria-label="t('plugin.connectorMarket.readinessLabel', {percent: readinessPercent})"
          >
            <span class="connector-market-ring__value">{{ readinessPercent }}%</span>
          </div>
          <span class="connector-market-ring__label">
            {{ t('plugin.connectorMarket.readinessLabel', {percent: readinessPercent}) }}
          </span>
        </div>
      </div>
    </header>

    <div v-else class="connector-market__head">
      <div>
        <h3 class="connector-market__title">{{ t('plugin.connectorMarket.title') }}</h3>
        <p class="connector-market__sub">{{ t('plugin.connectorMarket.subtitle') }}</p>
      </div>
    </div>

    <div
        v-if="showPendingBanner"
        class="connector-market-pending-banner"
    >
      <div class="connector-market-pending-banner__copy">
        <DwIcon name="alert-triangle" :size="18" :stroke-width="1.6"/>
        <div>
          <strong>{{ t('plugin.connectorMarket.pendingBannerTitle', {count: summary.pending}) }}</strong>
          <p>{{ t('plugin.connectorMarket.pendingBannerHint') }}</p>
        </div>
      </div>
      <button class="dw-text-btn dw-text-btn--accent" type="button" @click="focusPending">
        {{ t('plugin.connectorMarket.pendingBannerAction') }}
      </button>
    </div>

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
          <h2 class="connector-market-section__title">
            {{ standalone ? t('plugin.connectorMarket.featured') : t('plugin.connectorMarket.primary') }}
          </h2>
          <p v-if="standalone" class="connector-market-section__hint">
            {{ t('plugin.connectorMarket.featuredHint') }}
          </p>
        </div>
        <div class="connector-market-bento">
          <ConnectorMarketCard
              v-for="(entry, index) in primaryEntries"
              :key="entry.id"
              :entry="entry"
              :index="index"
              :lead="index === 0 && standalone"
              :standalone="standalone"
              @installed="loadMarket"
          />
        </div>
      </section>

      <section v-if="secondaryEntries.length" class="connector-market-section">
        <div class="connector-market-section__head">
          <h2 class="connector-market-section__title">
            {{ standalone ? t('plugin.connectorMarket.catalog') : t('plugin.connectorMarket.more') }}
          </h2>
        </div>
        <div class="connector-market-mosaic">
          <ConnectorMarketCard
              v-for="(entry, index) in secondaryEntries"
              :key="entry.id"
              :entry="entry"
              :index="index + primaryEntries.length"
              dense
              :standalone="standalone"
              @installed="loadMarket"
          />
        </div>
      </section>
    </div>

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
