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
  <div class="kafka-consumer-groups-tab dw-workbench-page">
    <header class="dw-workbench-page__head">
      <div class="dw-workbench-page__title">
        <h2>{{ t('explorer.kafkaConsumerGroups.title') }}</h2>
        <p>{{ connectionLabel }}</p>
      </div>
      <div class="dw-workbench-page__actions">
        <button class="dw-text-btn" type="button" @click="refreshMetrics">
          {{ t('explorer.kafkaConsumerGroup.reloadGroups') }}
        </button>
      </div>
    </header>

    <div class="kafka-consumer-groups-tab__body dw-workbench-page__body">
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
  min-width: 0;
}

.kafka-consumer-groups-tab__body {
  flex: 1;
  min-height: 0;
  padding: var(--dw-wb-content-pad-y) var(--dw-wb-content-pad-x);
}

.kafka-consumer-groups-tab__panel {
  height: 100%;
}
</style>
