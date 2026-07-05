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

const filteredKeys = computed(() => filterRedisKeys(keys.value, localFilter.value))

const prefixGroups = computed((): RedisKeyPrefixGroup[] => {
    const groups = groupRedisKeysByPrefix(filteredKeys.value)
    if (!activePrefix.value) return groups
    return groups.filter((group) => group.prefix === activePrefix.value)
})

const dynamicPresets = computed(() => derivePrefixPatterns(keys.value, 6))

const prefixNav = computed(() => groupRedisKeysByPrefix(keys.value))

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
  <aside class="redis-keys-browser">
    <div class="redis-keys-browser__toolbar">
      <form class="redis-keys-browser__search" @submit.prevent="onSearch">
        <input
            v-model="patternInput"
            class="redis-keys-browser__pattern"
            type="text"
            spellcheck="false"
            :placeholder="t('explorer.redisBrowser.patternPlaceholder')"
            :disabled="loading"
        />
        <DwButton
            variant="primary"
            class="redis-keys-browser__search-btn"
            type="submit"
            :disabled="loading || !connectionId"
            :title="t('explorer.redisBrowser.searchHint')"
        >
          {{ t('explorer.redisBrowser.search') }}
        </DwButton>
        <button
            class="redis-keys-browser__icon-btn"
            type="button"
            :title="t('explorer.redisBrowser.refresh')"
            :disabled="loading || !connectionId"
            @click="scanKeys(true)"
        >
          ↻
        </button>
      </form>
      <input
          v-model="localFilter"
          class="redis-keys-browser__filter"
          type="search"
          spellcheck="false"
          :placeholder="t('explorer.redisBrowser.filterPlaceholder')"
          :disabled="loading || !keys.length"
      />
      <p class="redis-keys-browser__status">{{ statusText }}</p>
    </div>

    <div v-if="dynamicPresets.length" class="redis-keys-browser__presets">
      <button
          class="redis-keys-browser__preset"
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
          class="redis-keys-browser__preset"
          type="button"
          :class="{ 'is-active': patternInput === pattern }"
          :disabled="loading"
          @click="onPresetClick(pattern)"
      >
        {{ pattern }}
      </button>
    </div>

    <div v-if="prefixNav.length > 1" class="redis-keys-browser__prefix-nav">
      <button
          class="redis-keys-browser__prefix-chip"
          type="button"
          :class="{ 'is-active': !activePrefix }"
          @click="activePrefix = null"
      >
        {{ t('explorer.redisBrowser.allGroups') }}
      </button>
      <button
          v-for="group in prefixNav"
          :key="group.prefix"
          class="redis-keys-browser__prefix-chip"
          type="button"
          :class="{ 'is-active': activePrefix === group.prefix }"
          @click="onPrefixNavClick(group)"
      >
        {{ prefixLabel(group) }}
        <span class="redis-keys-browser__prefix-count">{{ group.keys.length }}</span>
      </button>
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

    <footer class="redis-keys-browser__footer">
      <button
          class="redis-keys-browser__more"
          type="button"
          :disabled="!hasMore || loading || loadingMore"
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

.redis-keys-browser__toolbar {
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding: 10px 12px;
  border-bottom: 1px solid var(--dw-border);
}

.redis-keys-browser__search {
  display: flex;
  gap: 6px;
}

.redis-keys-browser__pattern,
.redis-keys-browser__filter {
  min-width: 0;
  border: 1px solid var(--dw-border);
  border-radius: 6px;
  padding: 6px 8px;
  background: var(--dw-bg-editor);
  color: var(--dw-text);
  font-size: 12px;
}

.redis-keys-browser__pattern {
  flex: 1;
}

.redis-keys-browser__search-btn {
  flex-shrink: 0;
  min-width: 56px;
}

.redis-keys-browser__icon-btn {
  flex-shrink: 0;
  width: 30px;
  border: 1px solid var(--dw-border);
  border-radius: 6px;
  background: var(--dw-bg-editor);
  color: var(--dw-text);
  font-size: 14px;
  cursor: pointer;
}

.redis-keys-browser__status {
  margin: 0;
  color: var(--dw-text-muted);
  font-size: 11px;
}

.redis-keys-browser__presets,
.redis-keys-browser__prefix-nav {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  padding: 8px 12px;
  border-bottom: 1px solid var(--dw-border);
}

.redis-keys-browser__preset,
.redis-keys-browser__prefix-chip {
  border: 1px solid var(--dw-border);
  border-radius: 999px;
  padding: 2px 8px;
  background: transparent;
  color: var(--dw-text-muted);
  font-size: 11px;
  cursor: pointer;
}

.redis-keys-browser__preset.is-active,
.redis-keys-browser__prefix-chip.is-active {
  border-color: var(--dw-primary);
  color: var(--dw-primary);
  background: color-mix(in srgb, var(--dw-primary) 10%, transparent);
}

.redis-keys-browser__prefix-count {
  margin-left: 4px;
  opacity: 0.7;
}

.redis-keys-browser__list {
  flex: 1;
  min-height: 0;
  overflow: auto;
}

.redis-keys-browser__group-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  width: 100%;
  padding: 6px 12px;
  border: none;
  border-bottom: 1px solid color-mix(in srgb, var(--dw-border) 60%, transparent);
  background: color-mix(in srgb, var(--dw-bg-editor) 80%, transparent);
  color: var(--dw-text-muted);
  font-size: 11px;
  font-weight: 600;
  cursor: pointer;
}

.redis-keys-browser__group-meta {
  display: inline-flex;
  align-items: center;
  gap: 4px;
}

.redis-keys-browser__items {
  margin: 0;
  padding: 0;
  list-style: none;
}

.redis-keys-browser__item {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 6px 8px 6px 18px;
  cursor: pointer;
  border-bottom: 1px solid color-mix(in srgb, var(--dw-border) 40%, transparent);
}

.redis-keys-browser__item:hover,
.redis-keys-browser__item.is-selected {
  background: color-mix(in srgb, var(--dw-primary) 12%, transparent);
}

.redis-keys-browser__key {
  flex: 1;
  min-width: 0;
  font-family: var(--dw-font-mono, ui-monospace, monospace);
  font-size: 11px;
  line-height: 1.4;
  word-break: break-all;
}

.redis-keys-browser__copy {
  flex-shrink: 0;
  border: none;
  border-radius: 4px;
  padding: 2px 4px;
  background: transparent;
  color: var(--dw-text-muted);
  font-size: 11px;
  cursor: pointer;
  opacity: 0;
}

.redis-keys-browser__item:hover .redis-keys-browser__copy,
.redis-keys-browser__item.is-selected .redis-keys-browser__copy {
  opacity: 1;
}

.redis-keys-browser__footer {
  padding: 8px 12px;
  border-top: 1px solid var(--dw-border);
}

.redis-keys-browser__more {
  width: 100%;
  border: 1px solid var(--dw-border);
  border-radius: 6px;
  padding: 6px 10px;
  background: var(--dw-bg-editor);
  color: var(--dw-text);
  font-size: 12px;
  cursor: pointer;
}

.redis-keys-browser__more:disabled,
.redis-keys-browser__search-btn:disabled,
.redis-keys-browser__preset:disabled,
.redis-keys-browser__icon-btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}
</style>

