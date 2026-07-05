<script setup lang="ts">
import {computed, ref} from 'vue'
import {useI18n} from 'vue-i18n'
import {useExplorerStore} from '@/features/explorer/stores/explorer'
import KafkaConsumerGroupPanel from '@/features/workspace/components/kafka/KafkaConsumerGroupPanel.vue'
import type {WorkspaceTab} from '@/core/types'

const props = defineProps<{ tab: WorkspaceTab }>()

const {t} = useI18n()
const explorer = useExplorerStore()

const consumerGroupPanelRef = ref<InstanceType<typeof KafkaConsumerGroupPanel> | null>(null)
const topicFilter = ref(props.tab.kafkaTopic ?? '')

const connectionId = computed(() => props.tab.connectionId ?? '')

const connectionLabel = computed(() => {
  if (!connectionId.value) return t('explorer.kafkaConsumerGroups.noConnection')
  return explorer.findNode(connectionId.value)?.label ?? connectionId.value
})

function refreshMetrics() {
  consumerGroupPanelRef.value?.refresh()
}
</script>

<template>
  <div class="kafka-consumer-groups-tab">
    <header class="kafka-consumer-groups-tab__head">
      <div class="kafka-consumer-groups-tab__title">
        <h2>{{ t('explorer.kafkaConsumerGroups.title') }}</h2>
        <p>{{ connectionLabel }}</p>
      </div>
      <button class="kafka-consumer-groups-tab__refresh" type="button" @click="refreshMetrics">
        {{ t('explorer.kafkaConsumerGroup.reloadGroups') }}
      </button>
    </header>

    <div class="kafka-consumer-groups-tab__body">
      <KafkaConsumerGroupPanel
          ref="consumerGroupPanelRef"
          class="kafka-consumer-groups-tab__panel"
          :connection-id="connectionId"
          :topic="topicFilter"
          show-topic-filter
      />
    </div>
  </div>
</template>

<style scoped>
.kafka-consumer-groups-tab {
  display: flex;
  flex-direction: column;
  height: 100%;
  min-height: 0;
  background: var(--dw-bg-editor);
}

.kafka-consumer-groups-tab__head {
  display: flex;
  align-items: center;
  gap: 12px;
  min-height: 56px;
  padding: 11px 16px;
  border-bottom: 1px solid var(--dw-border);
  background: var(--dw-bg-panel);
}

.kafka-consumer-groups-tab__title {
  flex: 1;
  min-width: 0;
}

.kafka-consumer-groups-tab__title h2 {
  margin: 0;
  font-size: 15px;
  font-weight: 600;
}

.kafka-consumer-groups-tab__title p {
  margin: 2px 0 0;
  color: var(--dw-text-muted);
  font-size: 12px;
}

.kafka-consumer-groups-tab__refresh {
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

.kafka-consumer-groups-tab__body {
  flex: 1;
  min-height: 0;
  padding: 12px 16px 16px;
}

.kafka-consumer-groups-tab__panel {
  height: 100%;
}
</style>
