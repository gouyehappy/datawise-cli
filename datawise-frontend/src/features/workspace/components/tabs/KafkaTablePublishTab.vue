<script setup lang="ts">
import {computed} from 'vue'
import {useI18n} from 'vue-i18n'
import type {WorkspaceTab} from '@/core/types'
import {useExplorerStore} from '@/features/explorer/stores/explorer'
import KafkaTablePublishPanel from '@/features/workspace/components/kafka/KafkaTablePublishPanel.vue'
import type {KafkaTablePublishContext} from '@/features/explorer/services/kafka-table-publish.service'

const props = defineProps<{ tab: WorkspaceTab }>()

const {t} = useI18n()
const explorer = useExplorerStore()

const kafkaConnectionId = computed(() => props.tab.connectionId ?? '')
const lockKafkaConnection = computed(() => props.tab.kafkaPublishLockConnection === true)

const connectionLabel = computed(() => {
  if (!kafkaConnectionId.value) return ''
  return explorer.findNode(kafkaConnectionId.value)?.label ?? kafkaConnectionId.value
})

const presetSource = computed<KafkaTablePublishContext | null>(() => {
  const sourceConnectionId = props.tab.kafkaPublishSourceConnectionId
  const database = props.tab.database
  const tableName = props.tab.tableName
  if (!sourceConnectionId || !database || !tableName) return null
  const sourceConnectionLabel = explorer.findNode(sourceConnectionId)?.label ?? sourceConnectionId
  return {
    sourceConnectionId,
    sourceConnectionLabel,
    sourceDatabase: database,
    tableName,
  }
})

const subtitle = computed(() => {
  if (presetSource.value) {
    return `${presetSource.value.sourceConnectionLabel} · ${presetSource.value.sourceDatabase}.${presetSource.value.tableName}`
  }
  return connectionLabel.value || t('explorer.kafkaTablePublish.noConnection')
})
</script>

<template>
  <div class="kafka-table-publish-tab">
    <header class="kafka-table-publish-tab__head">
      <div class="kafka-table-publish-tab__title">
        <h2>{{ t('explorer.kafkaTablePublish.title') }}</h2>
        <p>{{ subtitle }}</p>
      </div>
    </header>

    <div class="kafka-table-publish-tab__body">
      <section class="kafka-table-publish-tab__panel">
        <header class="kafka-table-publish-tab__panel-head">
          <h3>{{ t('explorer.kafkaTablePublish.panelTitle') }}</h3>
        </header>
        <KafkaTablePublishPanel
            :kafka-connection-id="kafkaConnectionId || undefined"
            :lock-kafka-connection="lockKafkaConnection"
            :preset-source="presetSource"
        />
      </section>
    </div>
  </div>
</template>

<style scoped>
.kafka-table-publish-tab {
  display: flex;
  flex-direction: column;
  height: 100%;
  min-height: 0;
  background: var(--dw-bg-editor);
}

.kafka-table-publish-tab__head {
  flex-shrink: 0;
  padding: var(--dw-space-5) var(--dw-space-8);
  border-bottom: 1px solid var(--dw-border);
  background: var(--dw-bg-panel);
}

.kafka-table-publish-tab__title h2 {
  margin: 0;
  font-size: var(--dw-text-lg);
  font-weight: 600;
}

.kafka-table-publish-tab__title p {
  margin: var(--dw-space-1) 0 0;
  color: var(--dw-text-muted);
  font-size: var(--dw-text-sm);
}

.kafka-table-publish-tab__body {
  flex: 1;
  min-height: 0;
  padding: var(--dw-space-5);
  overflow: auto;
}

.kafka-table-publish-tab__panel {
  display: flex;
  flex-direction: column;
  width: min(100%, 640px);
  border: 1px solid var(--dw-border);
  border-radius: var(--dw-control-radius);
  background: var(--dw-bg-panel);
}

.kafka-table-publish-tab__panel-head {
  padding: var(--dw-space-3) var(--dw-space-5);
  border-bottom: 1px solid var(--dw-border);
  background: color-mix(in srgb, var(--dw-bg-editor) 70%, transparent);
}

.kafka-table-publish-tab__panel-head h3 {
  margin: 0;
  font-size: var(--dw-text-sm);
  font-weight: 600;
}
</style>
