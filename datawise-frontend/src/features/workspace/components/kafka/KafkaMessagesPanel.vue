<script setup lang="ts">
import {computed, ref, watch} from 'vue'
import {useI18n} from 'vue-i18n'
import {DwButton, DwInlineAlert, EmptyState} from '@/core/components'
import {explorerApi} from '@/api'
import {useLayoutStore} from '@/features/layout/stores/layout'
import type {KafkaMessage, KafkaTopicDetail} from '@/features/explorer/services/kafka-topic.service'
import {
  formatMessageTimestamp,
  isStructuredMessageValue,
  summarizeMessageValue,
  tryFormatMessageValue,
} from '@/features/explorer/services/kafka-message-format.service'

const props = defineProps<{
  connectionId: string
  topic: string
}>()

const emit = defineEmits<{
  useInProducer: [payload: { key: string; value: string; partition: number }]
}>()

const {t} = useI18n()
const layout = useLayoutStore()

const detail = ref<KafkaTopicDetail | null>(null)
const messages = ref<KafkaMessage[]>([])
const loading = ref(false)
const messagesLoading = ref(false)
const error = ref<string | null>(null)
const partition = ref<number | null>(null)
const fromBeginning = ref(false)
const selectedIndex = ref<number | null>(null)

const partitionOptions = computed(() => detail.value?.partitions ?? [])

const selectedMessage = computed(() => {
  if (selectedIndex.value == null) return null
  return messages.value[selectedIndex.value] ?? null
})

const selectedValue = computed(() =>
    selectedMessage.value ? tryFormatMessageValue(selectedMessage.value.value) : '',
)

const selectedValueIsJson = computed(() =>
    selectedMessage.value ? isStructuredMessageValue(selectedMessage.value.value) : false,
)

const offsetLabel = computed(() => {
  if (!selectedMessage.value) return '—'
  return `@${selectedMessage.value.offset}`
})

const partitionLabel = computed(() => {
  if (!selectedMessage.value) return '—'
  return `#${selectedMessage.value.partition}`
})

const timeLabel = computed(() => {
  if (!selectedMessage.value) return '—'
  return formatMessageTimestamp(selectedMessage.value.timestamp)
})

const isBusy = computed(() => loading.value || messagesLoading.value)

async function loadMessages() {
  if (!props.connectionId || !props.topic) return
  messagesLoading.value = true
  error.value = null
  try {
    const result = await explorerApi.fetchKafkaMessages(props.connectionId, props.topic, {
      partition: partition.value ?? undefined,
      limit: 50,
      fromBeginning: fromBeginning.value,
    })
    messages.value = result.messages
    selectedIndex.value = result.messages.length ? 0 : null
  } catch (err) {
    error.value = err instanceof Error ? err.message : t('explorer.kafkaMessages.loadFailed')
    messages.value = []
    selectedIndex.value = null
  } finally {
    messagesLoading.value = false
  }
}

async function loadData() {
  if (!props.connectionId || !props.topic) return
  loading.value = true
  error.value = null
  try {
    const [detailResult, messagesResult] = await Promise.all([
      explorerApi.fetchKafkaTopicDetail(props.connectionId, props.topic),
      explorerApi.fetchKafkaMessages(props.connectionId, props.topic, {
        partition: partition.value ?? undefined,
        limit: 50,
        fromBeginning: fromBeginning.value,
      }),
    ])
    detail.value = detailResult
    messages.value = messagesResult.messages
    selectedIndex.value = messagesResult.messages.length ? 0 : null
  } catch (err) {
    error.value = err instanceof Error ? err.message : t('explorer.kafkaMessages.loadFailed')
    detail.value = null
    messages.value = []
    selectedIndex.value = null
  } finally {
    loading.value = false
  }
}

function selectMessage(index: number) {
  selectedIndex.value = index
}

async function copyText(text: string, toastKey: 'copyValue' | 'copyKey' = 'copyValue') {
  if (!text) return
  try {
    await navigator.clipboard.writeText(text)
    layout.showSuccessToast(t(`explorer.kafkaMessages.${toastKey}Done`))
  } catch {
    // ignore clipboard failures
  }
}

function useSelectedInProducer() {
  if (!selectedMessage.value) return
  emit('useInProducer', {
    key: selectedMessage.value.key ?? '',
    value: selectedMessage.value.value ?? '',
    partition: selectedMessage.value.partition,
  })
}

watch(
    () => [props.connectionId, props.topic] as const,
    () => {
      detail.value = null
      partition.value = null
      fromBeginning.value = false
      void loadData()
    },
    {immediate: true},
)

watch(
    () => [partition.value, fromBeginning.value] as const,
    () => {
      if (!props.connectionId || !props.topic || loading.value) return
      void loadMessages()
    },
)

defineExpose({refresh: loadData})
</script>

<template>
  <section class="kafka-topic-detail-panel">
    <header class="kafka-topic-detail-panel__head">
      <div class="kafka-topic-detail-panel__title">
        <div class="kafka-topic-detail-panel__title-row">
          <h3>{{ t('explorer.kafkaMessages.title') }}</h3>
          <span v-if="detail" class="kafka-topic-detail-panel__badge">
            {{ t('explorer.kafkaMessages.partitionsBadge', {count: detail.partitionCount}) }}
          </span>
          <span v-if="detail" class="kafka-topic-detail-panel__badge is-muted">
            RF {{ detail.replicationFactor }}
          </span>
        </div>
        <p class="kafka-topic-detail-panel__topic">{{ topic }}</p>
      </div>

      <div class="kafka-topic-detail-panel__head-actions">
        <DwButton variant="secondary" size="sm" :loading="isBusy" :disabled="isBusy" @click="loadData">
          {{ isBusy ? t('explorer.kafkaMessages.loading') : t('explorer.kafkaMessages.refresh') }}
        </DwButton>
      </div>
    </header>

    <div class="kafka-topic-detail-panel__consume-bar">
      <div class="kafka-topic-detail-panel__consume-controls">
        <label class="kafka-topic-detail-panel__inline-field">
          <span>{{ t('explorer.kafkaMessages.partition') }}</span>
          <select v-model="partition" class="kafka-topic-detail-panel__select" :disabled="isBusy">
            <option :value="null">{{ t('explorer.kafkaMessages.allPartitions') }}</option>
            <option
                v-for="item in partitionOptions"
                :key="item.partition"
                :value="item.partition"
            >
              #{{ item.partition }}
            </option>
          </select>
        </label>

        <button
            class="kafka-topic-detail-panel__toggle-chip"
            type="button"
            :class="{ 'is-active': fromBeginning }"
            :disabled="isBusy"
            @click="fromBeginning = !fromBeginning"
        >
          {{ t('explorer.kafkaMessages.fromBeginning') }}
        </button>
      </div>

      <div class="kafka-topic-detail-panel__message-actions">
        <DwButton
            variant="secondary"
            size="sm"
            :disabled="!selectedMessage"
            @click="copyText(selectedMessage?.key ?? '', 'copyKey')"
        >
          {{ t('explorer.kafkaMessages.copyKey') }}
        </DwButton>

        <DwButton variant="secondary" size="sm" :disabled="!selectedMessage" @click="copyText(selectedValue)">
          {{ t('explorer.kafkaMessages.copyValue') }}
        </DwButton>

        <DwButton variant="secondary" size="sm" :disabled="!selectedMessage" @click="useSelectedInProducer">
          {{ t('explorer.kafkaMessages.reuseInProducer') }}
        </DwButton>
      </div>
    </div>

    <div class="kafka-topic-detail-panel__body">
      <DwInlineAlert v-if="error" :message="error"/>

      <EmptyState
          v-else-if="isBusy && !messages.length"
          embedded
          bordered
          :title="t('explorer.kafkaMessages.loading')"
      />

      <EmptyState
          v-else-if="!messages.length"
          embedded
          bordered
          :title="t('explorer.kafkaMessages.empty')"
          :description="t('explorer.kafkaMessages.emptyHint')"
      />

      <template v-else>
      <div class="kafka-topic-detail-panel__meta">
        <div class="kafka-topic-detail-panel__field">
          <span>{{ t('explorer.kafkaMessages.colPartition') }}</span>
          <strong>{{ partitionLabel }}</strong>
        </div>
        <div class="kafka-topic-detail-panel__field">
          <span>{{ t('explorer.kafkaMessages.colOffset') }}</span>
          <strong>{{ offsetLabel }}</strong>
        </div>
        <div class="kafka-topic-detail-panel__field">
          <span>{{ t('explorer.kafkaMessages.colTimestamp') }}</span>
          <strong>{{ timeLabel }}</strong>
        </div>
        <div class="kafka-topic-detail-panel__field">
          <span>{{ t('explorer.kafkaMessages.colKey') }}</span>
          <strong class="kafka-topic-detail-panel__key-value">
            {{ selectedMessage?.key || t('explorer.kafkaMessages.noKey') }}
          </strong>
        </div>
      </div>

      <div class="kafka-topic-detail-panel__list" role="listbox">
        <button
            v-for="(message, index) in messages"
            :key="`${message.partition}-${message.offset}-${index}`"
            type="button"
            class="kafka-topic-detail-panel__row"
            :class="{ 'is-selected': selectedIndex === index }"
            role="option"
            :aria-selected="selectedIndex === index"
            @click="selectMessage(index)"
        >
          <span class="kafka-topic-detail-panel__row-meta">
            P{{ message.partition }} · @{{ message.offset }}
          </span>
          <span class="kafka-topic-detail-panel__row-time">{{ formatMessageTimestamp(message.timestamp) }}</span>
          <span class="kafka-topic-detail-panel__row-preview">
            {{ summarizeMessageValue(message.value, 96) }}
          </span>
        </button>
      </div>

      <dl
          v-if="selectedMessage?.headers && Object.keys(selectedMessage.headers).length"
          class="kafka-topic-detail-panel__headers"
      >
        <dt>{{ t('explorer.kafkaMessages.headers') }}</dt>
        <dd>
          <div
              v-for="(headerValue, headerKey) in selectedMessage.headers"
              :key="headerKey"
              class="kafka-topic-detail-panel__header-line"
          >
            <code>{{ headerKey }}</code>: <span>{{ headerValue }}</span>
          </div>
        </dd>
      </dl>

      <section class="kafka-topic-detail-panel__value-section">
        <header class="kafka-topic-detail-panel__value-head">
          <span class="kafka-topic-detail-panel__value-label">{{ t('explorer.kafkaMessages.colValue') }}</span>
          <span v-if="selectedValueIsJson" class="kafka-topic-detail-panel__value-badge">JSON</span>
        </header>
        <pre class="kafka-topic-detail-panel__preview">{{ selectedValue || t('explorer.kafkaMessages.emptyValue') }}</pre>
      </section>
      </template>
    </div>
  </section>
</template>

<style scoped>
.kafka-topic-detail-panel {
  display: flex;
  flex-direction: column;
  flex: 1;
  min-height: 0;
  overflow: hidden;
  border: 1px solid var(--dw-border);
  border-radius: var(--dw-control-radius);
  background: var(--dw-bg-panel);
  padding: var(--dw-space-6);
}

.kafka-topic-detail-panel__head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: var(--dw-space-6);
  flex-shrink: 0;
}

.kafka-topic-detail-panel__title {
  flex: 1;
  min-width: 0;
}

.kafka-topic-detail-panel__head-actions {
  display: flex;
  flex-wrap: wrap;
  justify-content: flex-end;
  gap: var(--dw-gap-sm);
  flex-shrink: 0;
}

.kafka-topic-detail-panel__consume-bar {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: var(--dw-gap);
  margin-top: var(--dw-space-5);
  padding: var(--dw-pad-control);
  border: 1px solid var(--dw-border);
  border-radius: var(--dw-control-radius-sm);
  background: var(--dw-bg-editor);
  flex-shrink: 0;
}

.kafka-topic-detail-panel__consume-controls,
.kafka-topic-detail-panel__message-actions {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: var(--dw-gap-sm);
}

.kafka-topic-detail-panel__inline-field {
  display: inline-flex;
  align-items: center;
  gap: var(--dw-gap-sm);
  font-size: var(--dw-text-xs);
  color: var(--dw-text-muted);
}

.kafka-topic-detail-panel__select {
  min-width: 0;
  border: 1px solid var(--dw-border);
  border-radius: var(--dw-radius-pill);
  padding: var(--dw-space-1) var(--dw-space-5);
  background: var(--dw-bg-panel);
  color: var(--dw-text);
  font-size: var(--dw-text-xs);
  cursor: pointer;
}

.kafka-topic-detail-panel__select:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.kafka-topic-detail-panel__toggle-chip {
  border: 1px solid var(--dw-border);
  border-radius: var(--dw-radius-pill);
  padding: var(--dw-space-1) var(--dw-space-5);
  background: transparent;
  color: var(--dw-text-muted);
  font-size: var(--dw-text-xs);
  line-height: var(--dw-leading);
  cursor: pointer;
  transition: border-color 0.15s ease, color 0.15s ease, background 0.15s ease;
}

.kafka-topic-detail-panel__toggle-chip:hover:not(:disabled) {
  border-color: color-mix(in srgb, var(--dw-primary) 30%, var(--dw-border));
  color: var(--dw-text);
}

.kafka-topic-detail-panel__toggle-chip.is-active {
  border-color: var(--dw-primary);
  color: var(--dw-primary);
  background: color-mix(in srgb, var(--dw-primary) 10%, transparent);
}

.kafka-topic-detail-panel__toggle-chip:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.kafka-topic-detail-panel__title-row {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: var(--dw-gap);
}

.kafka-topic-detail-panel__head h3 {
  margin: 0;
  font-size: var(--dw-text-md);
  font-weight: 600;
}

.kafka-topic-detail-panel__badge {
  padding: 1px var(--dw-space-4);
  border-radius: var(--dw-radius-pill);
  font-size: var(--dw-text-xs);
  font-weight: 600;
  background: color-mix(in srgb, var(--dw-primary) 15%, transparent);
  color: var(--dw-primary);
}

.kafka-topic-detail-panel__badge.is-muted {
  background: color-mix(in srgb, var(--dw-text-muted) 15%, transparent);
  color: var(--dw-text-muted);
}

.kafka-topic-detail-panel__topic {
  margin: var(--dw-space-2) 0 0;
  color: var(--dw-text-muted);
  font-family: var(--dw-font-mono);
  font-size: var(--dw-text-xs);
  word-break: break-all;
}

.kafka-topic-detail-panel__body {
  display: flex;
  flex-direction: column;
  flex: 1;
  min-height: 0;
  margin-top: var(--dw-space-4);
  gap: var(--dw-gap);
  overflow: auto;
}

.kafka-topic-detail-panel__meta {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(120px, 1fr));
  gap: var(--dw-gap);
  padding: var(--dw-pad-control);
  border: 1px solid var(--dw-border);
  border-radius: var(--dw-control-radius-sm);
  background: color-mix(in srgb, var(--dw-bg-editor) 80%, transparent);
}

.kafka-topic-detail-panel__field {
  display: flex;
  flex-direction: column;
  gap: var(--dw-space-1);
  font-size: var(--dw-text-xs);
  color: var(--dw-text-muted);
}

.kafka-topic-detail-panel__field strong {
  color: var(--dw-text);
  font-size: var(--dw-text-sm);
  font-weight: 500;
}

.kafka-topic-detail-panel__key-value {
  font-family: var(--dw-font-mono);
  word-break: break-all;
}

.kafka-topic-detail-panel__list {
  flex-shrink: 0;
  max-height: 150px;
  overflow: auto;
  border: 1px solid var(--dw-border);
  border-radius: var(--dw-control-radius-sm);
  background: var(--dw-bg-editor);
}

.kafka-topic-detail-panel__row {
  display: flex;
  flex-wrap: wrap;
  gap: var(--dw-space-2) var(--dw-space-4);
  align-items: baseline;
  width: 100%;
  padding: var(--dw-space-3) var(--dw-space-5);
  border: none;
  border-bottom: 1px solid var(--dw-border);
  background: transparent;
  text-align: left;
  cursor: pointer;
  font-size: var(--dw-text-xs);
}

.kafka-topic-detail-panel__row:last-child {
  border-bottom: none;
}

.kafka-topic-detail-panel__row:hover,
.kafka-topic-detail-panel__row.is-selected {
  background: color-mix(in srgb, var(--dw-primary) 10%, transparent);
}

.kafka-topic-detail-panel__row-meta {
  font-family: var(--dw-font-mono);
  color: var(--dw-text);
}

.kafka-topic-detail-panel__row-time {
  color: var(--dw-text-muted);
}

.kafka-topic-detail-panel__row-preview {
  flex: 1 1 100%;
  color: var(--dw-text-secondary);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.kafka-topic-detail-panel__headers {
  display: grid;
  grid-template-columns: minmax(72px, auto) minmax(0, 1fr);
  gap: var(--dw-gap-sm) var(--dw-gap-md);
  font-size: var(--dw-text-xs);
}

.kafka-topic-detail-panel__headers dt {
  color: var(--dw-text-muted);
}

.kafka-topic-detail-panel__headers dd {
  margin: 0;
}

.kafka-topic-detail-panel__header-line + .kafka-topic-detail-panel__header-line {
  margin-top: var(--dw-space-2);
}

.kafka-topic-detail-panel__value-section {
  display: flex;
  flex-direction: column;
  flex: 1 1 auto;
  min-height: 0;
  gap: var(--dw-gap-sm);
}

.kafka-topic-detail-panel__value-head {
  display: flex;
  align-items: center;
  gap: var(--dw-gap);
}

.kafka-topic-detail-panel__value-label {
  font-size: var(--dw-text-xs);
  font-weight: 600;
  color: var(--dw-text-muted);
  text-transform: uppercase;
  letter-spacing: 0.04em;
}

.kafka-topic-detail-panel__value-badge {
  padding: 1px var(--dw-space-4);
  border-radius: var(--dw-radius-pill);
  background: color-mix(in srgb, var(--dw-link) 12%, transparent);
  color: var(--dw-link);
  font-size: var(--dw-text-xs);
  font-weight: 600;
}

.kafka-topic-detail-panel__preview {
  flex: 1 1 auto;
  min-height: 120px;
  margin: 0;
  padding: var(--dw-space-6);
  overflow: auto;
  border: 1px solid var(--dw-border);
  border-radius: var(--dw-control-radius-sm);
  background: var(--dw-bg-editor);
  font-family: var(--dw-font-mono);
  font-size: var(--dw-text-sm);
  line-height: var(--dw-leading-loose);
  white-space: pre-wrap;
  word-break: break-word;
  tab-size: 2;
}
</style>
