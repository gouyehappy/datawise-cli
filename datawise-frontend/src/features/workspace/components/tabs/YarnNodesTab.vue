<script setup lang="ts">
import {computed, onMounted, ref, watch} from 'vue'
import {useI18n} from 'vue-i18n'
import {EmptyState, DwInlineAlert} from '@/core/components'
import {explorerApi} from '@/api'
import type {YarnNodeSummary} from '@/features/explorer/services/yarn-applications.service'
import {formatYarnMemory} from '@/features/explorer/services/yarn-applications.service'
import {useExplorerStore} from '@/features/explorer/stores/explorer'
import type {WorkspaceTab} from '@/core/types'

const props = defineProps<{ tab: WorkspaceTab }>()

const {t} = useI18n()
const explorer = useExplorerStore()

const nodes = ref<YarnNodeSummary[]>([])
const loading = ref(false)
const error = ref<string | null>(null)

const connectionId = computed(() => props.tab.connectionId ?? '')
const connectionLabel = computed(() => {
  if (!connectionId.value) return t('explorer.yarnNodes.noConnection')
  return explorer.findNode(connectionId.value)?.label ?? connectionId.value
})

async function loadNodes() {
  if (!connectionId.value) return
  loading.value = true
  error.value = null
  try {
    const result = await explorerApi.fetchYarnNodes(connectionId.value, {limit: 500})
    nodes.value = result.nodes
  } catch (err) {
    error.value = err instanceof Error ? err.message : t('explorer.yarnNodes.loadFailed')
    nodes.value = []
  } finally {
    loading.value = false
  }
}

onMounted(loadNodes)
watch(connectionId, loadNodes)
</script>

<template>
  <div class="yarn-nodes-tab dw-workbench-page">
    <header class="dw-workbench-page__head">
      <div class="dw-workbench-page__title">
        <h2>{{ t('explorer.yarnNodes.title') }}</h2>
        <p>{{ connectionLabel }}</p>
      </div>
      <div class="dw-workbench-page__actions">
        <button class="dw-text-btn" type="button" @click="loadNodes">{{ t('explorer.yarnNodes.refresh') }}</button>
      </div>
    </header>
    <p v-if="loading" class="yarn-nodes-tab__status dw-workbench-status">{{ t('explorer.yarnNodes.loading') }}</p>
    <DwInlineAlert v-else-if="error" class="yarn-nodes-tab__status dw-workbench-status" :message="error"/>
    <div v-else-if="nodes.length" class="yarn-nodes-tab__table-wrap">
      <table>
        <thead>
          <tr>
            <th>{{ t('explorer.yarnNodes.columns.id') }}</th>
            <th>{{ t('explorer.yarnNodes.columns.state') }}</th>
            <th>{{ t('explorer.yarnNodes.columns.health') }}</th>
            <th>{{ t('explorer.yarnNodes.columns.containers') }}</th>
            <th>{{ t('explorer.yarnNodes.columns.usedMemory') }}</th>
            <th>{{ t('explorer.yarnNodes.columns.availMemory') }}</th>
            <th>{{ t('explorer.yarnNodes.columns.vcores') }}</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="node in nodes" :key="node.id ?? node.state ?? Math.random()">
            <td>{{ node.id ?? 'ù? }}</td>
            <td>{{ node.state ?? 'ù? }}</td>
            <td>{{ node.nodeHealthStatus ?? 'ù? }}</td>
            <td>{{ node.numContainers }}</td>
            <td>{{ formatYarnMemory(node.usedMemoryMb) }}</td>
            <td>{{ formatYarnMemory(node.availMemoryMb) }}</td>
            <td>{{ node.usedVirtualCores }} / {{ node.availableVirtualCores }}</td>
          </tr>
        </tbody>
      </table>
    </div>
    <EmptyState v-else :title="t('explorer.yarnNodes.empty')" />
  </div>
</template>

<style scoped>
.yarn-nodes-tab {
  min-width: 0;
}

.yarn-nodes-tab__table-wrap {
  flex: 1;
  overflow: auto;
  padding: var(--dw-wb-content-pad-y) var(--dw-wb-content-pad-x);
}

.yarn-nodes-tab__table-wrap table {
  width: 100%;
  border-collapse: collapse;
  font-size: var(--dw-text-sm);
}

.yarn-nodes-tab__table-wrap th,
.yarn-nodes-tab__table-wrap td {
  padding: var(--dw-pad-control);
  border-bottom: 1px solid var(--dw-border);
  text-align: left;
}

.yarn-nodes-tab__status {
  margin: 0;
}
</style>
