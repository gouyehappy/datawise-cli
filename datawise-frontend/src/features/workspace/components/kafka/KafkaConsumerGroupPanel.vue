<script setup lang="ts">
import {computed, onMounted, ref, watch} from 'vue'
import {useI18n} from 'vue-i18n'
import {DwButton, EmptyState} from '@/core/components'
import {explorerApi} from '@/api'
import type {
  KafkaConsumerGroupMetrics,
  KafkaConsumerGroupSummary,
} from '@/features/explorer/services/kafka-topic.service'

const props = defineProps<{
  connectionId: string
  topic?: string
  showTopicFilter?: boolean
}>()

const {t} = useI18n()

const groupInput = ref('')
const groupFilter = ref('')
const topicInput = ref(props.topic ?? '')
const groups = ref<KafkaConsumerGroupSummary[]>([])
const metrics = ref<KafkaConsumerGroupMetrics | null>(null)
const loadingGroups = ref(false)
const loadingMetrics = ref(false)
const error = ref<string | null>(null)

const filteredGroups = computed(() => {
  const keyword = groupFilter.value.trim().toLowerCase()
  if (!keyword) return groups.value
  return groups.value.filter((group) => group.groupId.toLowerCase().includes(keyword))
})

const effectiveTopic = computed(() => (props.showTopicFilter ? topicInput.value : props.topic ?? '').trim())

const emptyHintTopic = computed(() => effectiveTopic.value || t('explorer.kafkaConsumerGroup.anyTopic'))

const stateClass = computed(() => {
  const state = metrics.value?.state?.toLowerCase() ?? ''
  if (state === 'stable') return 'is-stable'
  if (state === 'empty' || state === 'dead') return 'is-muted'
  return 'is-warn'
})

function formatOffset(value: number) {
  return value < 0 ? '—' : String(value)
}

async function loadGroups() {
  if (!props.connectionId) return
  loadingGroups.value = true
  error.value = null
  try {
    const result = await explorerApi.fetchKafkaConsumerGroups(props.connectionId, {limit: 300})
    groups.value = result.groups
  } catch (err) {
    error.value = err instanceof Error ? err.message : t('explorer.kafkaConsumerGroup.loadGroupsFailed')
    groups.value = []
  } finally {
    loadingGroups.value = false
  }
}

async function loadMetrics() {
  const groupId = groupInput.value.trim()
  if (!props.connectionId || !groupId) {
    metrics.value = null
    return
  }
  loadingMetrics.value = true
  error.value = null
  try {
    metrics.value = await explorerApi.fetchKafkaConsumerGroupMetrics(
        props.connectionId,
        groupId,
        {topic: effectiveTopic.value || undefined},
    )
  } catch (err) {
    metrics.value = null
    error.value = err instanceof Error ? err.message : t('explorer.kafkaConsumerGroup.loadMetricsFailed')
  } finally {
    loadingMetrics.value = false
  }
}

function selectGroup(groupId: string) {
  groupInput.value = groupId
  void loadMetrics()
}

watch(
    () => [props.connectionId, props.topic] as const,
    ([, topic]) => {
      groupInput.value = ''
      metrics.value = null
      error.value = null
      if (topic !== undefined) topicInput.value = topic
      void loadGroups()
    },
)

watch(
    () => groupInput.value,
    (value, previous) => {
      if (value.trim() === previous.trim()) return
      if (!value.trim()) {
        metrics.value = null
        return
      }
    },
)

onMounted(() => {
  void loadGroups()
})

defineExpose({refresh: loadMetrics})
</script>

<template>
  <div class="kafka-consumer-group-panel">
    <div class="kafka-consumer-group-panel__toolbar">
      <label
          v-if="showTopicFilter"
          class="kafka-consumer-group-panel__field"
      >
        <span>{{ t('explorer.kafkaConsumerGroup.topic') }}</span>
        <input
            v-model="topicInput"
            class="kafka-consumer-group-panel__input"
            type="text"
            spellcheck="false"
            :placeholder="t('explorer.kafkaConsumerGroup.topicPlaceholder')"
        >
      </label>

      <label class="kafka-consumer-group-panel__field">
        <span>{{ t('explorer.kafkaConsumerGroup.group') }}</span>
        <input
            v-model="groupInput"
            class="kafka-consumer-group-panel__input"
            type="text"
            spellcheck="false"
            list="kafka-consumer-group-options"
            :placeholder="t('explorer.kafkaConsumerGroup.groupPlaceholder')"
            @keydown.enter.prevent="loadMetrics"
        >
      </label>

      <label class="kafka-consumer-group-panel__field kafka-consumer-group-panel__field--filter">
        <span>{{ t('explorer.kafkaConsumerGroup.filter') }}</span>
        <input
            v-model="groupFilter"
            class="kafka-consumer-group-panel__input"
            type="search"
            spellcheck="false"
            :placeholder="t('explorer.kafkaConsumerGroup.filterPlaceholder')"
        >
      </label>

      <DwButton
          variant="secondary"
          size="sm"
          :loading="loadingMetrics"
          :disabled="!groupInput.trim() || loadingMetrics"
          @click="loadMetrics"
      >
        {{ loadingMetrics ? t('explorer.kafkaConsumerGroup.loading') : t('explorer.kafkaConsumerGroup.viewMetrics') }}
      </DwButton>

      <DwButton
          variant="secondary"
          size="sm"
          :loading="loadingGroups"
          @click="loadGroups"
      >
        {{ t('explorer.kafkaConsumerGroup.reloadGroups') }}
      </DwButton>
    </div>

    <datalist id="kafka-consumer-group-options">
      <option v-for="group in filteredGroups" :key="group.groupId" :value="group.groupId" />
    </datalist>

    <div v-if="filteredGroups.length" class="kafka-consumer-group-panel__chips">
      <button
          v-for="group in filteredGroups.slice(0, 8)"
          :key="group.groupId"
          type="button"
          class="kafka-consumer-group-panel__chip"
          :class="{ 'is-active': groupInput === group.groupId }"
          @click="selectGroup(group.groupId)"
      >
        {{ group.groupId }}
        <span class="kafka-consumer-group-panel__chip-state">{{ group.state }}</span>
      </button>
    </div>

    <p v-if="error" class="kafka-consumer-group-panel__error">{{ error }}</p>

    <EmptyState
        v-else-if="!metrics && !loadingMetrics"
        embedded
        bordered
        :title="t('explorer.kafkaConsumerGroup.emptyTitle')"
        :description="t('explorer.kafkaConsumerGroup.emptyHint', {topic: emptyHintTopic})"
    />

    <div v-else-if="metrics" class="kafka-consumer-group-panel__summary">
      <span class="kafka-consumer-group-panel__badge" :class="stateClass">{{ metrics.state }}</span>
      <span class="kafka-consumer-group-panel__meta">
        {{ t('explorer.kafkaConsumerGroup.members', {count: metrics.memberCount}) }}
      </span>
      <span class="kafka-consumer-group-panel__meta">
        {{ t('explorer.kafkaConsumerGroup.totalLag', {count: metrics.totalLag}) }}
      </span>
    </div>

    <div v-if="metrics?.partitions.length" class="kafka-consumer-group-panel__table-wrap">
      <table class="kafka-consumer-group-panel__table">
        <thead>
          <tr>
            <th>{{ t('explorer.kafkaConsumerGroup.colPartition') }}</th>
            <th>{{ t('explorer.kafkaConsumerGroup.colCommitted') }}</th>
            <th>{{ t('explorer.kafkaConsumerGroup.colEnd') }}</th>
            <th>{{ t('explorer.kafkaConsumerGroup.colLag') }}</th>
            <th>{{ t('explorer.kafkaConsumerGroup.colMember') }}</th>
          </tr>
        </thead>
        <tbody>
          <tr
              v-for="row in metrics.partitions"
              :key="`${row.topic}-${row.partition}`"
              :class="{ 'is-hot': row.lag > 0 }"
          >
            <td>#{{ row.partition }}</td>
            <td>{{ formatOffset(row.committedOffset) }}</td>
            <td>{{ formatOffset(row.endOffset) }}</td>
            <td>{{ row.lag }}</td>
            <td class="kafka-consumer-group-panel__member">{{ row.memberId || '—' }}</td>
          </tr>
        </tbody>
      </table>
    </div>

    <EmptyState
        v-else-if="metrics && !metrics.partitions.length"
        embedded
        bordered
        :title="t('explorer.kafkaConsumerGroup.noPartitionsTitle')"
        :description="t('explorer.kafkaConsumerGroup.noPartitionsHint', {topic: emptyHintTopic})"
    />
  </div>
</template>

<style scoped>
.kafka-consumer-group-panel {
  display: flex;
  flex-direction: column;
  gap: 8px;
  height: 100%;
  min-height: 0;
  overflow: hidden;
}

.kafka-consumer-group-panel__toolbar {
  display: flex;
  flex-wrap: wrap;
  align-items: end;
  gap: 8px;
  flex-shrink: 0;
}

.kafka-consumer-group-panel__field {
  display: flex;
  flex-direction: column;
  gap: 4px;
  min-width: 0;
  flex: 1 1 180px;
  font-size: 11px;
  color: var(--dw-text-muted);
}

.kafka-consumer-group-panel__field--filter {
  flex: 0 1 160px;
}

.kafka-consumer-group-panel__input {
  border: 1px solid var(--dw-border);
  border-radius: 6px;
  padding: 7px 10px;
  background: var(--dw-bg-panel);
  color: var(--dw-text);
  font-size: 12px;
}

.kafka-consumer-group-panel__chips {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  flex-shrink: 0;
}

.kafka-consumer-group-panel__chip {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  border: 1px solid var(--dw-border);
  border-radius: 999px;
  padding: 3px 10px;
  background: transparent;
  color: var(--dw-text);
  font-size: 11px;
  cursor: pointer;
}

.kafka-consumer-group-panel__chip.is-active {
  border-color: var(--dw-primary);
  color: var(--dw-primary);
  background: color-mix(in srgb, var(--dw-primary) 10%, transparent);
}

.kafka-consumer-group-panel__chip-state {
  color: var(--dw-text-muted);
  font-size: 10px;
}

.kafka-consumer-group-panel__error {
  margin: 0;
  color: var(--dw-danger);
  font-size: 12px;
}

.kafka-consumer-group-panel__summary {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
  flex-shrink: 0;
}

.kafka-consumer-group-panel__badge {
  padding: 1px 8px;
  border-radius: 999px;
  font-size: 10px;
  font-weight: 600;
}

.kafka-consumer-group-panel__badge.is-stable {
  background: color-mix(in srgb, #16a34a 12%, transparent);
  color: #16a34a;
}

.kafka-consumer-group-panel__badge.is-warn {
  background: color-mix(in srgb, #d97706 12%, transparent);
  color: #d97706;
}

.kafka-consumer-group-panel__badge.is-muted {
  background: color-mix(in srgb, var(--dw-text-muted) 12%, transparent);
  color: var(--dw-text-muted);
}

.kafka-consumer-group-panel__meta {
  font-size: 11px;
  color: var(--dw-text-muted);
}

.kafka-consumer-group-panel__table-wrap {
  flex: 1;
  min-height: 0;
  overflow: auto;
  border: 1px solid var(--dw-border);
  border-radius: 6px;
  background: var(--dw-bg-editor);
}

.kafka-consumer-group-panel__table {
  width: 100%;
  border-collapse: collapse;
  font-size: 11px;
}

.kafka-consumer-group-panel__table th,
.kafka-consumer-group-panel__table td {
  padding: 7px 10px;
  border-bottom: 1px solid var(--dw-border);
  text-align: left;
  white-space: nowrap;
}

.kafka-consumer-group-panel__table th {
  position: sticky;
  top: 0;
  background: var(--dw-bg-panel);
  color: var(--dw-text-muted);
  font-weight: 600;
}

.kafka-consumer-group-panel__table tr.is-hot td:nth-child(4) {
  color: #d97706;
  font-weight: 600;
}

.kafka-consumer-group-panel__member {
  max-width: 180px;
  overflow: hidden;
  text-overflow: ellipsis;
  font-family: var(--dw-font-mono, ui-monospace, monospace);
}
</style>
