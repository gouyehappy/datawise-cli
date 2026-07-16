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
  <div class="yarn-nodes-tab">
    <header class="yarn-nodes-tab__head">
      <div>
        <h2>{{ t('explorer.yarnNodes.title') }}</h2>
        <p>{{ connectionLabel }}</p>
      </div>
      <button type="button" @click="loadNodes">{{ t('explorer.yarnNodes.refresh') }}</button>
    </header>
    <p v-if="loading" class="yarn-nodes-tab__status">{{ t('explorer.yarnNodes.loading') }}</p>
    <DwInlineAlert v-else-if="error" class="yarn-nodes-tab__status" :message="error"/>
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
            <td>{{ node.id ?? '—' }}</td>
            <td>{{ node.state ?? '—' }}</td>
            <td>{{ node.nodeHealthStatus ?? '—' }}</td>
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
  display: flex;
  flex-direction: column;
  height: 100%;
  min-height: 0;
  background: var(--dw-bg-editor);
}

.yarn-nodes-tab__head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: var(--dw-space-5) var(--dw-space-8);
  border-bottom: 1px solid var(--dw-border);
  background: var(--dw-bg-panel);
}

.yarn-nodes-tab__head h2 {
  margin: 0;
  font-size: var(--dw-text-lg);
}

.yarn-nodes-tab__head p {
  margin: var(--dw-space-2) 0 0;
  font-size: var(--dw-text-sm);
  color: var(--dw-text-muted);
}

.yarn-nodes-tab__table-wrap {
  flex: 1;
  overflow: auto;
  padding: var(--dw-space-6) var(--dw-space-8);
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
  padding: var(--dw-space-6) var(--dw-space-8);
  font-size: var(--dw-text-sm);
  color: var(--dw-text-muted);
}
</style>
