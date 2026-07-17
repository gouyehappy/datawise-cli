<script setup lang="ts">
import {computed, ref, watch} from 'vue'
import {useI18n} from 'vue-i18n'
import {useExplorerStore} from '@/features/explorer/stores/explorer'
import {useWorkspaceStore} from '@/features/workspace/stores/workspace'
import KafkaTopicsBrowser from '@/features/workspace/components/kafka/KafkaTopicsBrowser.vue'
import KafkaMessagesPanel from '@/features/workspace/components/kafka/KafkaMessagesPanel.vue'
import KafkaProducerPanel from '@/features/workspace/components/kafka/KafkaProducerPanel.vue'
import type {WorkspaceTab} from '@/core/types'

const props = defineProps<{ tab: WorkspaceTab }>()

const {t} = useI18n()
const explorer = useExplorerStore()
const workspace = useWorkspaceStore()

const selectedTopic = ref<string | null>(props.tab.kafkaTopic ?? null)
const totalCount = ref(0)
const loadedCount = ref(0)
const topicsBrowserRef = ref<InstanceType<typeof KafkaTopicsBrowser> | null>(null)
const messagesPanelRef = ref<InstanceType<typeof KafkaMessagesPanel> | null>(null)
const producerPanelRef = ref<InstanceType<typeof KafkaProducerPanel> | null>(null)
const producerCollapsed = ref(false)

const connectionId = computed(() => props.tab.connectionId ?? '')

const connectionLabel = computed(() => {
  if (!connectionId.value) return t('explorer.kafkaConsole.noConnection')
  return explorer.findNode(connectionId.value)?.label ?? connectionId.value
})

const statsLabel = computed(() => {
  if (totalCount.value > loadedCount.value) {
    return t('explorer.kafkaConsole.statsWithTotal', {
      loaded: loadedCount.value,
      total: totalCount.value,
    })
  }
  return t('explorer.kafkaConsole.stats', {count: loadedCount.value})
})

function onSelectTopic(topic: string) {
  selectedTopic.value = topic
  workspace.updateTabContext(props.tab.id, {kafkaTopic: topic})
}

function onStats(payload: { total: number; loaded: number }) {
  totalCount.value = payload.total
  loadedCount.value = payload.loaded
}

function refreshTopics() {
  topicsBrowserRef.value?.refresh()
}

function onProduced() {
  messagesPanelRef.value?.refresh()
}

function onUseInProducer(payload: { key: string; value: string; partition: number }) {
  producerPanelRef.value?.applySeed(payload)
  producerCollapsed.value = false
}

watch(
    () => props.tab.kafkaTopic,
    (topic) => {
      if (topic) selectedTopic.value = topic
    },
)

watch(connectionId, () => {
  selectedTopic.value = null
  totalCount.value = 0
  loadedCount.value = 0
})
</script>

<template>
  <div class="kafka-topics-workbench">
    <header class="kafka-topics-workbench__head">
      <div class="kafka-topics-workbench__title">
        <h2>{{ t('explorer.kafkaConsole.title') }}</h2>
        <p>{{ connectionLabel }}</p>
        <span class="kafka-topics-workbench__stats">{{ statsLabel }}</span>
      </div>
      <button class="dw-text-btn" type="button" @click="refreshTopics">
        {{ t('explorer.kafkaBrowser.refresh') }}
      </button>
    </header>

    <div class="kafka-topics-workbench__body">
      <div class="kafka-topics-workbench__left">
        <section class="kafka-topics-workbench__topics-card">
          <header class="kafka-topics-workbench__topics-head">
            <h3>{{ t('explorer.kafkaTopics.title') }}</h3>
          </header>
          <KafkaTopicsBrowser
              ref="topicsBrowserRef"
              class="kafka-topics-workbench__topics"
              :connection-id="connectionId"
              :selected-topic="selectedTopic"
              embedded
              @select="onSelectTopic"
              @stats="onStats"
          />
        </section>
      </div>

      <div class="kafka-topics-workbench__right">
        <KafkaMessagesPanel
            v-if="selectedTopic"
            ref="messagesPanelRef"
            class="kafka-topics-workbench__messages"
            :connection-id="connectionId"
            :topic="selectedTopic"
            @use-in-producer="onUseInProducer"
        />

        <div v-else class="kafka-topics-workbench__placeholder">
          <h3>{{ t('explorer.kafkaConsole.emptyTitle') }}</h3>
          <p>{{ t('explorer.kafkaConsole.emptyHint') }}</p>
          <ul class="kafka-topics-workbench__tips">
            <li>{{ t('explorer.kafkaConsole.emptyTipBrowse') }}</li>
            <li>{{ t('explorer.kafkaConsole.emptyTipPeek') }}</li>
            <li>{{ t('explorer.kafkaConsole.emptyTipProduce') }}</li>
          </ul>
        </div>

        <section
            v-if="selectedTopic"
            class="kafka-topics-workbench__producer-wrap"
            :class="{ 'is-collapsed': producerCollapsed }"
        >
          <header class="kafka-topics-workbench__producer-head">
            <h3>{{ t('explorer.kafkaConsole.producerTitle') }}</h3>
            <button
                class="kafka-topics-workbench__producer-toggle"
                type="button"
                @click="producerCollapsed = !producerCollapsed"
            >
              {{ producerCollapsed ? t('explorer.kafkaConsole.showProducer') : t('explorer.kafkaConsole.hideProducer') }}
            </button>
          </header>

          <KafkaProducerPanel
              v-show="!producerCollapsed"
              ref="producerPanelRef"
              class="kafka-topics-workbench__producer"
              :connection-id="connectionId"
              :topic="selectedTopic"
              @produced="onProduced"
          />
        </section>
      </div>
    </div>
  </div>
</template>

<style scoped>
.kafka-topics-workbench {
  display: flex;
  flex-direction: column;
  height: 100%;
  min-height: 0;
  background: var(--dw-bg-editor);
}

.kafka-topics-workbench__head {
  display: flex;
  align-items: center;
  gap: var(--dw-space-6);
  min-height: 56px;
  padding: var(--dw-space-5) var(--dw-space-8);
  border-bottom: 1px solid var(--dw-border);
  background: var(--dw-bg-panel);
}

.kafka-topics-workbench__title {
  flex: 1;
  min-width: 0;
}

.kafka-topics-workbench__title h2 {
  margin: 0;
  font-size: var(--dw-text-lg);
  font-weight: 600;
}

.kafka-topics-workbench__title p {
  margin: var(--dw-space-1) 0 0;
  color: var(--dw-text-muted);
  font-size: var(--dw-text-sm);
}

.kafka-topics-workbench__stats {
  display: inline-block;
  margin-top: var(--dw-space-2);
  padding: 1px var(--dw-space-4);
  border-radius: var(--dw-radius-pill);
  background: color-mix(in srgb, var(--dw-primary) 12%, transparent);
  color: var(--dw-primary);
  font-size: var(--dw-text-xs);
}


.kafka-topics-workbench__body {
  display: grid;
  grid-template-columns: minmax(280px, 34%) minmax(0, 1fr);
  column-gap: var(--dw-gap-md);
  flex: 1;
  min-height: 0;
}

.kafka-topics-workbench__left {
  display: flex;
  flex-direction: column;
  min-width: 0;
  min-height: 0;
  padding: var(--dw-space-5) 0 var(--dw-space-5) var(--dw-space-5);
}

.kafka-topics-workbench__topics-card {
  display: flex;
  flex-direction: column;
  flex: 1;
  min-height: 0;
  border: 1px solid var(--dw-border);
  border-radius: var(--dw-control-radius);
  background: var(--dw-bg-panel);
  overflow: hidden;
}

.kafka-topics-workbench__topics-head {
  flex-shrink: 0;
  padding: var(--dw-space-6) var(--dw-space-6) 0;
}

.kafka-topics-workbench__topics-head h3 {
  margin: 0;
  font-size: var(--dw-text-md);
  font-weight: 600;
}

.kafka-topics-workbench__topics {
  flex: 1;
  min-height: 0;
}

.kafka-topics-workbench__right {
  display: flex;
  flex-direction: column;
  min-width: 0;
  min-height: 0;
  padding: var(--dw-space-5) var(--dw-space-5) var(--dw-space-5) 0;
  gap: var(--dw-gap-md);
}

.kafka-topics-workbench__messages {
  flex: 1;
  min-height: 120px;
}

.kafka-topics-workbench__placeholder {
  flex: 1;
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  min-height: 120px;
  padding: var(--dw-space-10);
  border: 1px dashed var(--dw-border);
  border-radius: var(--dw-control-radius);
  text-align: center;
  color: var(--dw-text-muted);
}

.kafka-topics-workbench__placeholder h3 {
  margin: 0 0 var(--dw-space-4);
  color: var(--dw-text);
  font-size: var(--dw-text-xl);
}

.kafka-topics-workbench__placeholder p {
  margin: 0;
  font-size: var(--dw-text-sm);
}

.kafka-topics-workbench__tips {
  margin: var(--dw-space-5) 0 0;
  padding-left: 18px;
  text-align: left;
  font-size: var(--dw-text-sm);
  line-height: var(--dw-leading-loose);
}

.kafka-topics-workbench__producer-wrap {
  display: flex;
  flex-direction: column;
  flex-shrink: 0;
  min-height: 180px;
  max-height: 42%;
  border: 1px solid var(--dw-border);
  border-radius: var(--dw-control-radius);
  background: var(--dw-bg-panel);
  overflow: hidden;
}

.kafka-topics-workbench__producer-wrap.is-collapsed {
  min-height: auto;
  max-height: none;
  flex: 0 0 auto;
}

.kafka-topics-workbench__producer-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--dw-gap);
  padding: var(--dw-space-3) var(--dw-space-5);
  border-bottom: 1px solid var(--dw-border);
  background: color-mix(in srgb, var(--dw-bg-editor) 70%, transparent);
}

.kafka-topics-workbench__producer-head h3 {
  margin: 0;
  font-size: var(--dw-text-sm);
  font-weight: 600;
}

.kafka-topics-workbench__producer-toggle {
  border: none;
  background: transparent;
  color: var(--dw-primary);
  font-size: var(--dw-text-xs);
  cursor: pointer;
}

.kafka-topics-workbench__producer {
  flex: 1;
  min-height: 0;
  overflow: hidden;
  display: flex;
  flex-direction: column;
  padding: var(--dw-space-4) var(--dw-space-5) var(--dw-space-5);
}

@media (max-width: 900px) {
  .kafka-topics-workbench__body {
    grid-template-columns: 1fr;
    grid-template-rows: minmax(220px, 38%) minmax(0, 1fr);
    column-gap: 0;
    row-gap: var(--dw-gap-md);
  }

  .kafka-topics-workbench__left {
    padding: var(--dw-space-5) var(--dw-space-5) 0;
  }

  .kafka-topics-workbench__right {
    padding: 0 var(--dw-space-5) var(--dw-space-5);
  }
}
</style>
