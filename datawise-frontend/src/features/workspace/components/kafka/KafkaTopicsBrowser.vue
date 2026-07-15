<script setup lang="ts">
import {computed, onMounted, ref, watch} from 'vue'
import {useI18n} from 'vue-i18n'
import {DwButton, EmptyState} from '@/core/components'
import {explorerApi} from '@/api'
import {
    deriveTopicPrefixPatterns,
    filterKafkaTopics,
    groupKafkaTopicsByPrefix,
    KAFKA_TOPICS_PAGE_SIZE,
    normalizeKafkaTopicPattern,
    type KafkaTopicPrefixGroup,
} from '@/features/explorer/services/kafka-topic-prefix.service'

const props = defineProps<{
  connectionId: string
  selectedTopic?: string | null
  /** 嵌入圆角卡片内时去掉外层底色与硬边框 */
  embedded?: boolean
}>()

const emit = defineEmits<{
  select: [topic: string]
  stats: [payload: { total: number; loaded: number }]
}>()

const {t} = useI18n()

const patternInput = ref('')
const localFilter = ref('')
const topics = ref<string[]>([])
const totalCount = ref(0)
const fetchLimit = ref(KAFKA_TOPICS_PAGE_SIZE)
const loading = ref(false)
const loadingMore = ref(false)
const error = ref<string | null>(null)
const activePrefix = ref<string | null>(null)
const collapsedPrefixes = ref<Set<string>>(new Set())

const filteredTopics = computed(() => filterKafkaTopics(topics.value, localFilter.value))

const prefixGroups = computed((): KafkaTopicPrefixGroup[] => {
  const groups = groupKafkaTopicsByPrefix(filteredTopics.value)
  if (!activePrefix.value) return groups
  return groups.filter((group) => group.prefix === activePrefix.value)
})

const dynamicPresets = computed(() => deriveTopicPrefixPatterns(topics.value, 6))

const prefixNav = computed(() => groupKafkaTopicsByPrefix(topics.value))

const hasMore = computed(() => totalCount.value > topics.value.length)

const statusText = computed(() => {
  if (loading.value) return t('explorer.kafkaBrowser.loading')
  if (error.value) return error.value
  const loaded = topics.value.length
  const shown = filteredTopics.value.length
  const total = totalCount.value
  if (localFilter.value.trim()) {
    return t('explorer.kafkaBrowser.statusFiltered', {shown, loaded})
  }
  if (total > loaded) {
    return t('explorer.kafkaBrowser.statusWithTotal', {loaded, total})
  }
  return t('explorer.kafkaBrowser.status', {count: loaded})
})

async function loadTopics(reset: boolean) {
  if (!props.connectionId || loading.value || loadingMore.value) return
  if (reset) {
    loading.value = true
    fetchLimit.value = KAFKA_TOPICS_PAGE_SIZE
    error.value = null
    activePrefix.value = null
    collapsedPrefixes.value = new Set()
  } else {
    loadingMore.value = true
    fetchLimit.value = Math.min(
        totalCount.value || fetchLimit.value + KAFKA_TOPICS_PAGE_SIZE,
        fetchLimit.value + KAFKA_TOPICS_PAGE_SIZE,
    )
  }

  try {
    const result = await explorerApi.fetchKafkaTopics(props.connectionId, {
      pattern: normalizeKafkaTopicPattern(patternInput.value) === '*'
          ? undefined
          : normalizeKafkaTopicPattern(patternInput.value),
      limit: fetchLimit.value,
    })
    topics.value = result.topics
    totalCount.value = result.totalCount
    emit('stats', {total: result.totalCount, loaded: result.topics.length})
  } catch (err) {
    error.value = err instanceof Error ? err.message : t('explorer.kafkaBrowser.loadFailed')
  } finally {
    loading.value = false
    loadingMore.value = false
  }
}

function onSearch() {
  void loadTopics(true)
}

function onPresetClick(pattern: string) {
  if (pattern === '*') {
    patternInput.value = ''
  } else {
    patternInput.value = pattern.endsWith('*') ? pattern.slice(0, -1) : pattern
  }
  activePrefix.value = null
  void loadTopics(true)
}

function onPrefixNavClick(group: KafkaTopicPrefixGroup) {
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

function prefixLabel(group: KafkaTopicPrefixGroup) {
  return group.prefix === '__no_prefix__' ? t('explorer.kafkaBrowser.noPrefix') : group.label
}

function onTopicClick(topic: string) {
  emit('select', topic)
}

async function copyTopicName(topic: string, event: Event) {
  event.stopPropagation()
  try {
    await navigator.clipboard.writeText(topic)
  } catch {
    // ignore clipboard failures
  }
}

watch(() => props.connectionId, () => {
  patternInput.value = ''
  localFilter.value = ''
  topics.value = []
  totalCount.value = 0
  void loadTopics(true)
})

onMounted(() => {
  void loadTopics(true)
})

defineExpose({refresh: () => loadTopics(true)})
</script>

<template>
  <aside class="kafka-topics-browser" :class="{ 'is-embedded': embedded }">
    <div class="kafka-topics-browser__toolbar">
      <form class="kafka-topics-browser__search" @submit.prevent="onSearch">
        <input
            v-model="patternInput"
            class="kafka-topics-browser__pattern"
            type="text"
            spellcheck="false"
            :placeholder="t('explorer.kafkaBrowser.patternPlaceholder')"
            :disabled="loading"
        >
        <DwButton
            variant="primary"
            class="kafka-topics-browser__search-btn"
            type="submit"
            :disabled="loading || !connectionId"
            :title="t('explorer.kafkaBrowser.searchHint')"
        >
          {{ t('explorer.kafkaBrowser.search') }}
        </DwButton>
        <button
            class="kafka-topics-browser__icon-btn"
            type="button"
            :title="t('explorer.kafkaBrowser.refresh')"
            :disabled="loading || !connectionId"
            @click="loadTopics(true)"
        >
          ↻
        </button>
      </form>
      <input
          v-model="localFilter"
          class="kafka-topics-browser__filter"
          type="search"
          spellcheck="false"
          :placeholder="t('explorer.kafkaBrowser.filterPlaceholder')"
          :disabled="loading || !topics.length"
      >
      <p class="kafka-topics-browser__status">{{ statusText }}</p>
    </div>

    <div v-if="dynamicPresets.length" class="kafka-topics-browser__presets">
      <button
          class="kafka-topics-browser__preset"
          type="button"
          :class="{ 'is-active': !patternInput && !activePrefix }"
          :disabled="loading"
          @click="onPresetClick('*')"
      >
        {{ t('explorer.kafkaBrowser.presetAll') }}
      </button>
      <button
          v-for="pattern in dynamicPresets"
          :key="pattern"
          class="kafka-topics-browser__preset"
          type="button"
          :class="{ 'is-active': patternInput && normalizeKafkaTopicPattern(patternInput) === pattern }"
          :disabled="loading"
          @click="onPresetClick(pattern)"
      >
        {{ pattern }}
      </button>
    </div>

    <div v-if="prefixNav.length > 1" class="kafka-topics-browser__prefix-nav">
      <button
          class="kafka-topics-browser__prefix-chip"
          type="button"
          :class="{ 'is-active': !activePrefix }"
          @click="activePrefix = null"
      >
        {{ t('explorer.kafkaBrowser.allGroups') }}
      </button>
      <button
          v-for="group in prefixNav"
          :key="group.prefix"
          class="kafka-topics-browser__prefix-chip"
          type="button"
          :class="{ 'is-active': activePrefix === group.prefix }"
          @click="onPrefixNavClick(group)"
      >
        {{ prefixLabel(group) }}
        <span class="kafka-topics-browser__prefix-count">{{ group.topics.length }}</span>
      </button>
    </div>

    <div class="kafka-topics-browser__list" role="listbox">
      <EmptyState
          v-if="!loading && !filteredTopics.length && !error"
          embedded
          bordered
          :title="t('explorer.kafkaBrowser.empty')"
      />

      <section
          v-for="group in prefixGroups"
          :key="group.prefix"
          class="kafka-topics-browser__group"
      >
        <button
            v-if="!activePrefix && prefixGroups.length > 1"
            class="kafka-topics-browser__group-head"
            type="button"
            @click="toggleGroup(group.prefix)"
        >
          <span>{{ prefixLabel(group) }}</span>
          <span class="kafka-topics-browser__group-meta">
            {{ group.topics.length }}
            <span class="kafka-topics-browser__twistie">{{ isGroupCollapsed(group.prefix) ? '▸' : '▾' }}</span>
          </span>
        </button>

        <ul v-show="activePrefix || !isGroupCollapsed(group.prefix)" class="kafka-topics-browser__items">
          <li
              v-for="topic in group.topics"
              :key="topic"
              class="kafka-topics-browser__item"
              :class="{ 'is-selected': selectedTopic === topic }"
              role="option"
              :aria-selected="selectedTopic === topic"
              @click="onTopicClick(topic)"
          >
            <span class="kafka-topics-browser__topic" :title="topic">{{ topic }}</span>
            <button
                class="kafka-topics-browser__copy"
                type="button"
                :title="t('explorer.kafkaBrowser.copyTopic')"
                @click="copyTopicName(topic, $event)"
            >
              ⧉
            </button>
          </li>
        </ul>
      </section>
    </div>

    <footer v-if="hasMore" class="kafka-topics-browser__footer">
      <button
          class="kafka-topics-browser__more"
          type="button"
          :disabled="loading || loadingMore"
          @click="loadTopics(false)"
      >
        {{ loadingMore ? t('explorer.kafkaBrowser.loadingMore') : t('explorer.kafkaBrowser.loadMore') }}
      </button>
    </footer>
  </aside>
</template>

<style scoped>
.kafka-topics-browser {
  display: flex;
  flex-direction: column;
  min-width: 0;
  min-height: 0;
  background: var(--dw-bg-panel);
}

.kafka-topics-browser.is-embedded {
  background: transparent;
}

.kafka-topics-browser.is-embedded .kafka-topics-browser__toolbar {
  padding: 0 var(--dw-space-6) var(--dw-space-4);
  border-bottom: none;
}

.kafka-topics-browser.is-embedded .kafka-topics-browser__presets,
.kafka-topics-browser.is-embedded .kafka-topics-browser__prefix-nav {
  padding: 0 var(--dw-space-6);
}

.kafka-topics-browser.is-embedded .kafka-topics-browser__list {
  padding: var(--dw-space-2) var(--dw-space-6) var(--dw-space-4);
}

.kafka-topics-browser.is-embedded .kafka-topics-browser__footer {
  padding: var(--dw-space-4) var(--dw-space-6) var(--dw-space-6);
  border-top: none;
  background: color-mix(in srgb, var(--dw-bg-editor) 50%, transparent);
}

.kafka-topics-browser__toolbar {
  display: flex;
  flex-direction: column;
  gap: var(--dw-gap);
  padding: var(--dw-space-6);
  border-bottom: 1px solid var(--dw-border);
}

.kafka-topics-browser__search {
  display: flex;
  gap: var(--dw-gap-sm);
}

.kafka-topics-browser__pattern,
.kafka-topics-browser__filter {
  flex: 1;
  min-width: 0;
  padding: var(--dw-pad-tight);
  border: 1px solid var(--dw-border);
  border-radius: var(--dw-control-radius-sm);
  background: var(--dw-bg);
  font-size: var(--dw-text-sm);
}

.kafka-topics-browser__search-btn {
  flex-shrink: 0;
  padding-inline: 10px;
}

.kafka-topics-browser__icon-btn {
  flex-shrink: 0;
  width: 32px;
  border: 1px solid var(--dw-border);
  border-radius: var(--dw-control-radius-sm);
  background: var(--dw-bg);
  cursor: pointer;
}

.kafka-topics-browser__status {
  margin: 0;
  font-size: var(--dw-text-xs);
  color: var(--dw-text-muted);
}

.kafka-topics-browser__presets,
.kafka-topics-browser__prefix-nav {
  display: flex;
  flex-wrap: wrap;
  gap: var(--dw-gap-sm);
  padding: var(--dw-space-4) var(--dw-space-6) 0;
}

.kafka-topics-browser__preset,
.kafka-topics-browser__prefix-chip {
  padding: var(--dw-space-1) var(--dw-space-4);
  border: 1px solid var(--dw-border);
  border-radius: var(--dw-radius-pill);
  background: var(--dw-bg);
  font-size: var(--dw-text-xs);
  cursor: pointer;
}

.kafka-topics-browser__preset.is-active,
.kafka-topics-browser__prefix-chip.is-active {
  border-color: var(--dw-primary);
  color: var(--dw-primary);
  background: color-mix(in srgb, var(--dw-primary) 8%, var(--dw-bg));
}

.kafka-topics-browser__prefix-count {
  margin-left: var(--dw-space-2);
  opacity: 0.7;
}

.kafka-topics-browser__list {
  flex: 1;
  overflow: auto;
  padding: var(--dw-space-4) var(--dw-space-6) var(--dw-space-6);
}

.kafka-topics-browser__group + .kafka-topics-browser__group {
  margin-top: var(--dw-space-4);
}

.kafka-topics-browser__group-head {
  display: flex;
  justify-content: space-between;
  width: 100%;
  padding: var(--dw-pad-tight);
  border: none;
  border-radius: var(--dw-control-radius-sm);
  background: var(--dw-bg-muted);
  font-size: var(--dw-text-sm);
  font-weight: 600;
  cursor: pointer;
}

.kafka-topics-browser__group-meta {
  display: inline-flex;
  gap: var(--dw-gap-sm);
  align-items: center;
  color: var(--dw-text-muted);
  font-weight: 400;
}

.kafka-topics-browser__items {
  margin: var(--dw-space-2) 0 0;
  padding: 0;
  list-style: none;
}

.kafka-topics-browser__item {
  display: flex;
  align-items: center;
  gap: var(--dw-gap-sm);
  padding: var(--dw-pad-tight);
  border-radius: var(--dw-control-radius-sm);
  cursor: pointer;
}

.kafka-topics-browser__item:hover,
.kafka-topics-browser__item.is-selected {
  background: color-mix(in srgb, var(--dw-primary) 10%, transparent);
}

.kafka-topics-browser.is-embedded .kafka-topics-browser__item.is-selected {
  background: color-mix(in srgb, var(--dw-primary) 14%, transparent);
}

.kafka-topics-browser__topic {
  flex: 1;
  min-width: 0;
  font-family: var(--dw-mono);
  font-size: var(--dw-text-sm);
  word-break: break-all;
}

.kafka-topics-browser__copy {
  flex-shrink: 0;
  padding: 0 var(--dw-space-2);
  border: none;
  background: transparent;
  color: var(--dw-text-muted);
  opacity: 0;
  cursor: pointer;
}

.kafka-topics-browser__item:hover .kafka-topics-browser__copy,
.kafka-topics-browser__item.is-selected .kafka-topics-browser__copy {
  opacity: 1;
}

.kafka-topics-browser__footer {
  padding: var(--dw-space-4) var(--dw-space-6) var(--dw-space-6);
  border-top: 1px solid var(--dw-border);
}

.kafka-topics-browser__more {
  width: 100%;
  padding: var(--dw-space-4);
  border: 1px solid var(--dw-border);
  border-radius: var(--dw-control-radius-sm);
  background: var(--dw-bg);
  font-size: var(--dw-text-sm);
  cursor: pointer;
}

.kafka-topics-browser__more:disabled,
.kafka-topics-browser__icon-btn:disabled,
.kafka-topics-browser__preset:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
</style>
