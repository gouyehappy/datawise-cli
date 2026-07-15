<script setup lang="ts">
import {computed, ref} from 'vue'
import {useI18n} from 'vue-i18n'
import {useExplorerStore} from '@/features/explorer/stores/explorer'
import KafkaMessagesPanel from '@/features/workspace/components/kafka/KafkaMessagesPanel.vue'
import KafkaProducerPanel from '@/features/workspace/components/kafka/KafkaProducerPanel.vue'
import type {WorkspaceTab} from '@/core/types'

const props = defineProps<{ tab: WorkspaceTab }>()

const {t} = useI18n()
const explorer = useExplorerStore()

const messagesPanelRef = ref<InstanceType<typeof KafkaMessagesPanel> | null>(null)
const producerPanelRef = ref<InstanceType<typeof KafkaProducerPanel> | null>(null)

const connectionId = computed(() => props.tab.connectionId ?? '')
const topic = computed(() => props.tab.kafkaTopic ?? '')

const connectionLabel = computed(() => {
  if (!connectionId.value) return t('explorer.kafkaTopic.noConnection')
  return explorer.findNode(connectionId.value)?.label ?? connectionId.value
})

function onProduced() {
  messagesPanelRef.value?.refresh()
}

function onUseInProducer(payload: { key: string; value: string; partition: number }) {
  producerPanelRef.value?.applySeed(payload)
}
</script>

<template>
  <div class="kafka-topic-tab">
    <header class="kafka-topic-tab__head">
      <div class="kafka-topic-tab__title">
        <h2>{{ topic || t('explorer.kafkaTopic.title') }}</h2>
        <p>{{ connectionLabel }}</p>
      </div>
    </header>

    <div v-if="topic" class="kafka-topic-tab__body">
      <KafkaMessagesPanel
          ref="messagesPanelRef"
          class="kafka-topic-tab__messages"
          :connection-id="connectionId"
          :topic="topic"
          @use-in-producer="onUseInProducer"
      />

      <section class="kafka-topic-tab__producer">
        <header class="kafka-topic-tab__producer-head">
          <h3>{{ t('explorer.kafkaTopic.producerTitle') }}</h3>
        </header>
        <KafkaProducerPanel
            ref="producerPanelRef"
            class="kafka-topic-tab__producer-panel"
            :connection-id="connectionId"
            :topic="topic"
            @produced="onProduced"
        />
      </section>
    </div>

    <div v-else class="kafka-topic-tab__empty">
      <p>{{ t('explorer.kafkaTopic.emptyHint') }}</p>
    </div>
  </div>
</template>

<style scoped>
.kafka-topic-tab {
  display: flex;
  flex-direction: column;
  height: 100%;
  min-height: 0;
  background: var(--dw-bg-editor);
}

.kafka-topic-tab__head {
  flex-shrink: 0;
  padding: var(--dw-space-5) var(--dw-space-8);
  border-bottom: 1px solid var(--dw-border);
  background: var(--dw-bg-panel);
}

.kafka-topic-tab__title h2 {
  margin: 0;
  font-size: var(--dw-text-lg);
  font-weight: 600;
  word-break: break-all;
}

.kafka-topic-tab__title p {
  margin: var(--dw-space-1) 0 0;
  color: var(--dw-text-muted);
  font-size: var(--dw-text-sm);
}

.kafka-topic-tab__body {
  display: flex;
  flex-direction: column;
  flex: 1;
  min-height: 0;
  padding: var(--dw-space-5);
  gap: var(--dw-gap-md);
}

.kafka-topic-tab__messages {
  flex: 1;
  min-height: 0;
  overflow: hidden;
}

.kafka-topic-tab__producer {
  display: flex;
  flex-direction: column;
  flex-shrink: 0;
  min-height: 200px;
  max-height: 42%;
  border: 1px solid var(--dw-border);
  border-radius: var(--dw-control-radius);
  background: var(--dw-bg-panel);
  overflow: hidden;
}

.kafka-topic-tab__producer-head {
  padding: var(--dw-space-3) var(--dw-space-5);
  border-bottom: 1px solid var(--dw-border);
  background: color-mix(in srgb, var(--dw-bg-editor) 70%, transparent);
}

.kafka-topic-tab__producer-head h3 {
  margin: 0;
  font-size: var(--dw-text-sm);
  font-weight: 600;
}

.kafka-topic-tab__producer-panel {
  flex: 1;
  min-height: 0;
  overflow: hidden;
  display: flex;
  flex-direction: column;
  padding: var(--dw-space-4) var(--dw-space-5) var(--dw-space-5);
}

.kafka-topic-tab__empty {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--dw-text-muted);
  font-size: var(--dw-text-md);
}
</style>
