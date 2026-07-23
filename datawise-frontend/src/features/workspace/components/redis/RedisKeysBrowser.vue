<script setup lang="ts">
import {computed, onMounted, ref, watch} from 'vue'
import {useI18n} from 'vue-i18n'
import {DwButton, EmptyState} from '@/core/components'
import {explorerApi} from '@/api'
import {
    derivePrefixPatterns,
    filterRedisKeys,
    groupRedisKeysByPrefix,
    type RedisKeyPrefixGroup,
} from '@/features/explorer/services/redis-key-prefix.service'
import {
    normalizeRedisScanPattern,
    REDIS_KEYS_PAGE_SIZE,
} from '@/features/explorer/services/redis-keys-scan.service'

const props = defineProps<{
    connectionId: string
    database?: number
    selectedKey?: string | null
    /** 嵌入圆角卡片内时去掉外层底色与硬边框 */
    embedded?: boolean
}>()

const emit = defineEmits<{
    select: [key: string]
    open: [key: string]
    stats: [payload: { dbSize: number | null; loaded: number }]
}>()

const {t} = useI18n()

const patternInput = ref('*')
const localFilter = ref('')
const keys = ref<string[]>([])
const cursor = ref<string | null>(null)
const hasMore = ref(false)
const dbSize = ref<number | null>(null)
const loading = ref(false)
const loadingMore = ref(false)
const error = ref<string | null>(null)
const activePrefix = ref<string | null>(null)
const collapsedPrefixes = ref<Set<string>>(new Set())

const REDIS_PREFIX_NAV_LIMIT = 6

const filteredKeys = computed(() => filterRedisKeys(keys.value, localFilter.value))

const prefixGroups = computed((): RedisKeyPrefixGroup[] => {
    const groups = groupRedisKeysByPrefix(filteredKeys.value)
    if (!activePrefix.value) return groups
    return groups.filter((group) => group.prefix === activePrefix.value)
})

const dynamicPresets = computed(() => derivePrefixPatterns(keys.value, 6))

/** Already sorted by count desc in groupRedisKeysByPrefix */
const prefixNav = computed(() => groupRedisKeysByPrefix(keys.value))

const prefixNavExpanded = ref(false)

const visiblePrefixNav = computed(() => {
    const groups = prefixNav.value
    if (prefixNavExpanded.value || groups.length <= REDIS_PREFIX_NAV_LIMIT) return groups
    const top = groups.slice(0, REDIS_PREFIX_NAV_LIMIT)
    if (activePrefix.value && !top.some((group) => group.prefix === activePrefix.value)) {
        const active = groups.find((group) => group.prefix === activePrefix.value)
        if (active) return [...top.slice(0, REDIS_PREFIX_NAV_LIMIT - 1), active]
    }
    return top
})

const statusText = computed(() => {
    if (loading.value) return t('explorer.redisBrowser.loading')
    if (error.value) return error.value
    const loaded = keys.value.length
    const shown = filteredKeys.value.length
    const total = dbSize.value
    if (localFilter.value.trim()) {
        return t('explorer.redisBrowser.statusFiltered', {shown, loaded})
    }
    if (total != null) {
        return t('explorer.redisBrowser.statusWithDbSize', {loaded, total})
    }
    return t('explorer.redisBrowser.status', {count: loaded})
})

function emitStats() {
    emit('stats', {dbSize: dbSize.value, loaded: keys.value.length})
}

async function scanKeys(reset: boolean) {
    if (!props.connectionId) return
    if (reset) {
        loading.value = true
        cursor.value = null
        keys.value = []
        hasMore.value = false
        error.value = null
        activePrefix.value = null
        collapsedPrefixes.value = new Set()
        prefixNavExpanded.value = false
    } else {
        loadingMore.value = true
    }

    try {
        const result = await explorerApi.fetchRedisKeysScan(props.connectionId, {
            pattern: normalizeRedisScanPattern(patternInput.value),
            cursor: reset ? undefined : cursor.value ?? undefined,
            count: REDIS_KEYS_PAGE_SIZE,
            database: props.database,
        })
        if (reset) {
            keys.value = [...result.keys]
        } else {
            keys.value = [...keys.value, ...result.keys]
        }
        cursor.value = result.cursor
        hasMore.value = result.hasMore
        dbSize.value = result.dbSize
        emitStats()
    } catch (err) {
        error.value = err instanceof Error ? err.message : String(err)
    } finally {
        loading.value = false
        loadingMore.value = false
    }
}

function onSearch() {
    void scanKeys(true)
}

function onPresetClick(pattern: string) {
    patternInput.value = pattern
    activePrefix.value = null
    void scanKeys(true)
}

function onPrefixNavClick(group: RedisKeyPrefixGroup) {
    if (activePrefix.value === group.prefix) {
        activePrefix.value = null
        return
    }
    activePrefix.value = group.prefix
}

function toggleGroup(prefix: string) {
    const next = new Set(collapsedPrefixes.value)
    if (next.has(prefix)) next.delete(prefix)
    else next.add(prefix)
    collapsedPrefixes.value = next
}

function isGroupCollapsed(prefix: string) {
    return collapsedPrefixes.value.has(prefix)
}

function onKeyClick(key: string) {
    emit('select', key)
}

function onKeyDblClick(key: string) {
    emit('open', key)
}

async function copyKeyName(key: string, event: Event) {
    event.stopPropagation()
    try {
        await navigator.clipboard.writeText(key)
    } catch {
        // ignore clipboard failures
    }
}

function prefixLabel(group: RedisKeyPrefixGroup) {
    return group.prefix === '__no_prefix__' ? t('explorer.redisBrowser.noPrefix') : group.label
}

watch(
    () => [props.connectionId, props.database] as const,
    () => {
        patternInput.value = '*'
        localFilter.value = ''
        void scanKeys(true)
    },
)

onMounted(() => {
    void scanKeys(true)
})

defineExpose({refresh: () => scanKeys(true)})
</script>

<template>
  <aside class="redis-keys-browser" :class="{ 'is-embedded': embedded }">
    <div class="redis-keys-browser__toolbar">
      <form class="redis-keys-browser__search" @submit.prevent="onSearch">
        <input
            v-model="patternInput"
            class="dw-side-browser__field redis-keys-browser__pattern"
            type="text"
            spellcheck="false"
            :placeholder="t('explorer.redisBrowser.patternPlaceholder')"
            :disabled="loading"
        />
        <DwButton
            variant="primary"
            size="sm"
            class="dw-side-browser__action"
            type="submit"
            :disabled="loading || !connectionId"
            :title="t('explorer.redisBrowser.searchHint')"
        >
          {{ t('explorer.redisBrowser.search') }}
        </DwButton>
        <button
            class="dw-icon-btn dw-icon-btn--sm"
            type="button"
            :title="t('explorer.redisBrowser.refresh')"
            :disabled="loading || !connectionId"
            @click="scanKeys(true)"
        >
          ↻
        </button>
      </form>
      <div class="redis-keys-browser__filter-row">
        <input
            v-model="localFilter"
            class="dw-side-browser__field redis-keys-browser__filter"
            type="search"
            spellcheck="false"
            :placeholder="t('explorer.redisBrowser.filterPlaceholder')"
            :disabled="loading || !keys.length"
        />
        <p class="redis-keys-browser__status">{{ statusText }}</p>
      </div>
    </div>

    <div
        v-if="dynamicPresets.length || prefixNav.length > 1"
        class="dw-side-browser__filters"
    >
      <div v-if="dynamicPresets.length" class="dw-side-browser__rail">
        <span class="dw-side-browser__rail-label">{{ t('explorer.redisBrowser.presetsLabel') }}</span>
        <div class="dw-side-browser__chips">
          <button
              class="dw-side-browser__chip"
              type="button"
              :class="{ 'is-active': patternInput === '*' && !activePrefix }"
              :disabled="loading"
              @click="onPresetClick('*')"
          >
            {{ t('explorer.redisBrowser.presetAll') }}
          </button>
          <button
              v-for="pattern in dynamicPresets"
              :key="pattern"
              class="dw-side-browser__chip"
              type="button"
              :class="{ 'is-active': patternInput === pattern }"
              :disabled="loading"
              @click="onPresetClick(pattern)"
          >
            {{ pattern }}
          </button>
        </div>
      </div>

      <div v-if="prefixNav.length > 1" class="dw-side-browser__rail">
        <span class="dw-side-browser__rail-label">{{ t('explorer.redisBrowser.groupsLabel') }}</span>
        <div class="dw-side-browser__chips">
          <button
              class="dw-side-browser__chip"
              type="button"
              :class="{ 'is-active': !activePrefix }"
              @click="activePrefix = null"
          >
            {{ t('explorer.redisBrowser.allGroups') }}
          </button>
          <button
              v-for="group in visiblePrefixNav"
              :key="group.prefix"
              class="dw-side-browser__chip"
              type="button"
              :class="{ 'is-active': activePrefix === group.prefix }"
              @click="onPrefixNavClick(group)"
          >
            {{ prefixLabel(group) }}
            <span class="dw-side-browser__chip-count">{{ group.keys.length }}</span>
          </button>
          <button
              v-if="prefixNav.length > REDIS_PREFIX_NAV_LIMIT"
              class="dw-side-browser__chip dw-side-browser__chip--more"
              type="button"
              @click="prefixNavExpanded = !prefixNavExpanded"
          >
            {{ prefixNavExpanded
              ? t('explorer.redisBrowser.collapseGroups')
              : t('explorer.redisBrowser.moreGroups', {count: prefixNav.length - REDIS_PREFIX_NAV_LIMIT}) }}
          </button>
        </div>
      </div>
    </div>

    <div class="redis-keys-browser__list" role="listbox">
      <EmptyState
          v-if="!loading && !filteredKeys.length && !error"
          embedded
          bordered
          :title="t('explorer.redisBrowser.empty')"
      />

      <section
          v-for="group in prefixGroups"
          :key="group.prefix"
          class="redis-keys-browser__group"
      >
        <button
            v-if="!activePrefix && prefixGroups.length > 1"
            class="redis-keys-browser__group-head"
            type="button"
            @click="toggleGroup(group.prefix)"
        >
          <span>{{ prefixLabel(group) }}</span>
          <span class="redis-keys-browser__group-meta">
            {{ group.keys.length }}
            <span class="redis-keys-browser__twistie">{{ isGroupCollapsed(group.prefix) ? '▸' : '▾' }}</span>
          </span>
        </button>

        <ul v-show="activePrefix || !isGroupCollapsed(group.prefix)" class="redis-keys-browser__items">
          <li
              v-for="key in group.keys"
              :key="key"
              class="redis-keys-browser__item"
              :class="{ 'is-selected': selectedKey === key }"
              role="option"
              :aria-selected="selectedKey === key"
              @click="onKeyClick(key)"
              @dblclick="onKeyDblClick(key)"
          >
            <span class="redis-keys-browser__key" :title="key">{{ key }}</span>
            <button
                class="redis-keys-browser__copy"
                type="button"
                :title="t('explorer.redisBrowser.copyKey')"
                @click="copyKeyName(key, $event)"
            >
              ⧉
            </button>
          </li>
        </ul>
      </section>
    </div>

    <footer v-if="hasMore" class="redis-keys-browser__footer">
      <button
          class="redis-keys-browser__more"
          type="button"
          :disabled="loading || loadingMore"
          @click="scanKeys(false)"
      >
        {{ loadingMore ? t('explorer.redisBrowser.loadingMore') : t('explorer.redisBrowser.loadMore') }}
      </button>
    </footer>
  </aside>
</template>

<style scoped>
.redis-keys-browser {
  display: flex;
  flex-direction: column;
  min-width: 0;
  min-height: 0;
  background: var(--dw-bg-panel);
}

.redis-keys-browser.is-embedded {
  background: transparent;
}

.redis-keys-browser.is-embedded .redis-keys-browser__toolbar {
  padding-left: var(--dw-space-6);
  padding-right: var(--dw-space-6);
}

.redis-keys-browser.is-embedded .redis-keys-browser__list {
  padding: var(--dw-space-2) var(--dw-space-6) var(--dw-space-4);
}

.redis-keys-browser.is-embedded .redis-keys-browser__footer {
  padding: var(--dw-space-4) var(--dw-space-6) var(--dw-space-6);
}

.redis-keys-browser__toolbar {
  display: flex;
  flex-direction: column;
  gap: var(--dw-gap-sm);
  padding: var(--dw-space-5) var(--dw-space-6) var(--dw-space-4);
}

.redis-keys-browser__search,
.redis-keys-browser__filter-row {
  display: flex;
  align-items: center;
  gap: var(--dw-gap-sm);
  min-width: 0;
}

.redis-keys-browser__status {
  margin: 0;
  flex-shrink: 0;
  max-width: 42%;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: var(--dw-text-xs);
  color: var(--dw-text-muted);
}

.redis-keys-browser__list {
  flex: 1;
  min-height: 0;
  overflow: auto;
  padding: var(--dw-space-3) var(--dw-space-6) var(--dw-space-5);
}

.redis-keys-browser__group + .redis-keys-browser__group {
  margin-top: var(--dw-space-2);
}

.redis-keys-browser__group-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  width: 100%;
  padding: var(--dw-space-2) var(--dw-space-3);
  border: none;
  border-radius: var(--dw-control-radius-sm);
  background: color-mix(in srgb, var(--dw-bg-muted) 70%, transparent);
  color: var(--dw-text-secondary);
  font-size: var(--dw-text-xs);
  font-weight: 600;
  cursor: pointer;
}

.redis-keys-browser__group-meta {
  display: inline-flex;
  gap: var(--dw-gap-sm);
  align-items: center;
  color: var(--dw-text-muted);
  font-weight: 400;
  font-variant-numeric: tabular-nums;
}

.redis-keys-browser__items {
  margin: var(--dw-space-1) 0 0;
  padding: 0;
  list-style: none;
}

.redis-keys-browser__item {
  display: flex;
  align-items: center;
  gap: var(--dw-gap-sm);
  padding: var(--dw-space-2) var(--dw-space-3);
  border-radius: var(--dw-control-radius-sm);
  cursor: pointer;
}

.redis-keys-browser__item:hover,
.redis-keys-browser__item.is-selected {
  background: color-mix(in srgb, var(--dw-primary) 10%, transparent);
}

.redis-keys-browser.is-embedded .redis-keys-browser__item.is-selected {
  background: color-mix(in srgb, var(--dw-primary) 14%, transparent);
}

.redis-keys-browser__key {
  flex: 1;
  min-width: 0;
  font-family: var(--dw-mono, var(--dw-font-mono));
  font-size: var(--dw-text-sm);
  word-break: break-all;
}

.redis-keys-browser__copy {
  flex-shrink: 0;
  padding: 0 var(--dw-space-2);
  border: none;
  background: transparent;
  color: var(--dw-text-muted);
  opacity: 0;
  cursor: pointer;
}

.redis-keys-browser__item:hover .redis-keys-browser__copy,
.redis-keys-browser__item.is-selected .redis-keys-browser__copy {
  opacity: 1;
}

.redis-keys-browser__footer {
  padding: var(--dw-space-4) var(--dw-space-6) var(--dw-space-5);
  border-top: 1px solid color-mix(in srgb, var(--dw-border) 55%, transparent);
}

.redis-keys-browser__more {
  width: 100%;
  height: var(--dw-control-h-sm);
  border: 1px solid var(--dw-border);
  border-radius: var(--dw-control-radius-sm);
  background: var(--dw-bg);
  color: var(--dw-text-secondary);
  font-size: var(--dw-text-sm);
  cursor: pointer;
}

.redis-keys-browser__more:hover:not(:disabled) {
  color: var(--dw-text);
  background: var(--dw-bg-hover);
}

.redis-keys-browser__more:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
</style>

