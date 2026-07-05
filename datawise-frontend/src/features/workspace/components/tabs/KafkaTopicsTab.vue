<script setup lang="ts">
import {computed, ref} from 'vue'
import {useI18n} from 'vue-i18n'
import {useExplorerStore} from '@/features/explorer/stores/explorer'
import {useWorkspaceStore} from '@/features/workspace/stores/workspace'
import KafkaTopicsBrowser from '@/features/workspace/components/kafka/KafkaTopicsBrowser.vue'
import type {WorkspaceTab} from '@/core/types'

const props = defineProps<{ tab: WorkspaceTab }>()

const {t} = useI18n()
const explorer = useExplorerStore()
const workspace = useWorkspaceStore()

const selectedTopic = ref<string | null>(null)
const totalCount = ref(0)
const loadedCount = ref(0)
const topicsBrowserRef = ref<InstanceType<typeof KafkaTopicsBrowser> | null>(null)

const connectionId = computed(() => props.tab.connectionId ?? '')

const connectionLabel = computed(() => {
  if (!connectionId.value) return t('explorer.kafkaTopics.noConnection')
  return explorer.findNode(connectionId.value)?.label ?? connectionId.value
})

const statsLabel = computed(() => {
  if (totalCount.value > loadedCount.value) {
    return t('explorer.kafkaTopics.statsWithTotal', {
      loaded: loadedCount.value,
      total: totalCount.value,
    })
  }
  return t('explorer.kafkaTopics.stats', {count: loadedCount.value})
})

function onSelectTopic(topic: string) {
  selectedTopic.value = topic
}

function onOpenTopic(topic: string) {
  if (!connectionId.value) return
  workspace.openKafkaTopic({
    connectionId: connectionId.value,
    connectionName: connectionLabel.value,
    explorerNodeId: connectionId.value,
    topic,
  })
}

function onStats(payload: { total: number; loaded: number }) {
  totalCount.value = payload.total
  loadedCount.value = payload.loaded
}

function refreshTopics() {
  topicsBrowserRef.value?.refresh()
}
</script>

<template>
  <div class="kafka-topics-tab">
    <header class="kafka-topics-tab__head">
      <div class="kafka-topics-tab__title">
        <h2>{{ t('explorer.kafkaTopics.title') }}</h2>
        <p>{{ connectionLabel }}</p>
        <span class="kafka-topics-tab__stats">{{ statsLabel }}</span>
      </div>
      <button class="kafka-topics-tab__refresh" type="button" @click="refreshTopics">
        {{ t('explorer.kafkaBrowser.refresh') }}
      </button>
    </header>

    <div class="kafka-topics-tab__body">
      <KafkaTopicsBrowser
          ref="topicsBrowserRef"
          class="kafka-topics-tab__browser"
          :connection-id="connectionId"
          :selected-topic="selectedTopic"
          @select="onSelectTopic"
          @open="onOpenTopic"
          @stats="onStats"
      />
    </div>

    <footer class="kafka-topics-tab__hint">
      {{ t('explorer.kafkaTopics.openHint') }}
    </footer>
  </div>
</template>

<style scoped>
.kafka-topics-tab {
  display: flex;
  flex-direction: column;
  height: 100%;
  min-height: 0;
  background: var(--dw-bg-editor);
}

.kafka-topics-tab__head {
  display: flex;
  align-items: center;
  gap: 12px;
  min-height: 56px;
  padding: 11px 16px;
  border-bottom: 1px solid var(--dw-border);
  background: var(--dw-bg-panel);
}

.kafka-topics-tab__title {
  flex: 1;
  min-width: 0;
}

.kafka-topics-tab__title h2 {
  margin: 0;
  font-size: 15px;
  font-weight: 600;
}

.kafka-topics-tab__title p {
  margin: 2px 0 0;
  color: var(--dw-text-muted);
  font-size: 12px;
}

.kafka-topics-tab__stats {
  display: inline-block;
  margin-top: 4px;
  padding: 1px 8px;
  border-radius: 999px;
  background: color-mix(in srgb, var(--dw-primary) 12%, transparent);
  color: var(--dw-primary);
  font-size: 11px;
}

.kafka-topics-tab__refresh {
  flex-shrink: 0;
  height: 34px;
  border: 1px solid var(--dw-border);
  border-radius: var(--dw-panel-radius, 8px);
  padding: 0 12px;
  background: var(--dw-bg, var(--dw-bg-panel));
  color: var(--dw-text);
  font-size: 12px;
  cursor: pointer;
}

.kafka-topics-tab__body {
  flex: 1;
  min-height: 0;
  min-width: 0;
}

.kafka-topics-tab__browser {
  height: 100%;
  border-right: none;
}

.kafka-topics-tab__hint {
  flex-shrink: 0;
  padding: 8px 16px;
  border-top: 1px solid var(--dw-border);
  background: var(--dw-bg-panel);
  color: var(--dw-text-muted);
  font-size: 12px;
}
</style>
