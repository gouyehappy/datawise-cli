<script setup lang="ts">
import {computed, onMounted, ref, watch} from 'vue'
import {useI18n} from 'vue-i18n'
import {DwButton, EmptyState} from '@/core/components'
import {explorerApi} from '@/api'
import type {YarnQueueSummary} from '@/features/explorer/services/yarn-applications.service'
import {useExplorerStore} from '@/features/explorer/stores/explorer'
import type {WorkspaceTab} from '@/core/types'

const props = defineProps<{ tab: WorkspaceTab }>()

const {t} = useI18n()
const explorer = useExplorerStore()

const queues = ref<YarnQueueSummary[]>([])
const schedulerType = ref<string | null>(null)
const loading = ref(false)
const saving = ref(false)
const error = ref<string | null>(null)
const success = ref<string | null>(null)
const selectedQueueName = ref<string | null>(null)
const queueState = ref('RUNNING')
const queueCapacity = ref('')
const queueMaxCapacity = ref('')

const connectionId = computed(() => props.tab.connectionId ?? '')
const connectionLabel = computed(() => {
  if (!connectionId.value) return t('explorer.yarnQueues.noConnection')
  return explorer.findNode(connectionId.value)?.label ?? connectionId.value
})

const selectedQueue = computed(() =>
    queues.value.find((queue) => queue.name === selectedQueueName.value) ?? null,
)

function selectQueue(queue: YarnQueueSummary) {
  selectedQueueName.value = queue.name
  queueState.value = queue.state ?? 'RUNNING'
  queueCapacity.value = queue.capacity > 0 ? String(queue.capacity) : ''
  queueMaxCapacity.value = ''
  success.value = null
}

async function loadQueues() {
  if (!connectionId.value) return
  loading.value = true
  error.value = null
  success.value = null
  try {
    const result = await explorerApi.fetchYarnQueues(connectionId.value)
    queues.value = result.queues
    schedulerType.value = result.schedulerType
    if (selectedQueueName.value) {
      const stillExists = result.queues.some((queue) => queue.name === selectedQueueName.value)
      if (!stillExists) selectedQueueName.value = null
      else selectQueue(result.queues.find((queue) => queue.name === selectedQueueName.value)!)
    }
  } catch (err) {
    error.value = err instanceof Error ? err.message : t('explorer.yarnQueues.loadFailed')
    queues.value = []
  } finally {
    loading.value = false
  }
}

async function applyQueueChanges() {
  if (!connectionId.value || !selectedQueueName.value) return
  const params: Record<string, string> = {}
  if (queueState.value.trim()) params.state = queueState.value.trim().toUpperCase()
  if (queueCapacity.value.trim()) params.capacity = queueCapacity.value.trim()
  if (queueMaxCapacity.value.trim()) params['maximum-capacity'] = queueMaxCapacity.value.trim()
  if (!Object.keys(params).length) return

  saving.value = true
  error.value = null
  success.value = null
  try {
    const result = await explorerApi.updateYarnQueue(connectionId.value, {
      queueName: selectedQueueName.value,
      params,
    })
    success.value = result.message ?? t('explorer.yarnQueues.updateSuccess')
    await loadQueues()
  } catch (err) {
    error.value = err instanceof Error ? err.message : t('explorer.yarnQueues.updateFailed')
  } finally {
    saving.value = false
  }
}

async function removeSelectedQueue() {
  if (!connectionId.value || !selectedQueueName.value) return
  if (!window.confirm(t('explorer.yarnQueues.removeConfirm', {name: selectedQueueName.value}))) return
  saving.value = true
  error.value = null
  success.value = null
  try {
    const result = await explorerApi.removeYarnQueue(connectionId.value, {
      queueName: selectedQueueName.value,
    })
    success.value = result.message ?? t('explorer.yarnQueues.removeSuccess')
    selectedQueueName.value = null
    await loadQueues()
  } catch (err) {
    error.value = err instanceof Error ? err.message : t('explorer.yarnQueues.removeFailed')
  } finally {
    saving.value = false
  }
}

onMounted(loadQueues)
watch(connectionId, loadQueues)
</script>

<template>
  <div class="yarn-queues-tab">
    <header class="yarn-queues-tab__head">
      <div>
        <h2>{{ t('explorer.yarnQueues.title') }}</h2>
        <p>{{ connectionLabel }}</p>
        <p v-if="schedulerType" class="yarn-queues-tab__scheduler">{{ t('explorer.yarnQueues.scheduler', {type: schedulerType}) }}</p>
      </div>
      <button type="button" @click="loadQueues">{{ t('explorer.yarnQueues.refresh') }}</button>
    </header>

    <p v-if="loading" class="yarn-queues-tab__status">{{ t('explorer.yarnQueues.loading') }}</p>
    <p v-else-if="error" class="yarn-queues-tab__status is-error">{{ error }}</p>
    <p v-else-if="success" class="yarn-queues-tab__status is-success">{{ success }}</p>

    <div v-if="queues.length" class="yarn-queues-tab__body">
      <div class="yarn-queues-tab__table-wrap">
        <table>
          <thead>
            <tr>
              <th>{{ t('explorer.yarnQueues.columns.name') }}</th>
              <th>{{ t('explorer.yarnQueues.columns.state') }}</th>
              <th>{{ t('explorer.yarnQueues.columns.capacity') }}</th>
              <th>{{ t('explorer.yarnQueues.columns.usedCapacity') }}</th>
              <th>{{ t('explorer.yarnQueues.columns.apps') }}</th>
            </tr>
          </thead>
          <tbody>
            <tr
                v-for="queue in queues"
                :key="queue.name ?? queue.state ?? Math.random()"
                :class="{ 'is-selected': selectedQueueName === queue.name }"
                @click="selectQueue(queue)"
            >
              <td>{{ queue.name ?? '—' }}</td>
              <td>{{ queue.state ?? '—' }}</td>
              <td>{{ queue.capacity?.toFixed?.(1) ?? 0 }}%</td>
              <td>{{ queue.usedCapacity?.toFixed?.(1) ?? 0 }}%</td>
              <td>{{ queue.numApplications }}</td>
            </tr>
          </tbody>
        </table>
      </div>

      <section v-if="selectedQueue" class="yarn-queues-tab__editor">
        <h3>{{ t('explorer.yarnQueues.editorTitle', {name: selectedQueue.name ?? ''}) }}</h3>
        <div class="yarn-queues-tab__form">
          <label>
            <span>{{ t('explorer.yarnQueues.form.state') }}</span>
            <select v-model="queueState">
              <option value="RUNNING">RUNNING</option>
              <option value="STOPPED">STOPPED</option>
            </select>
          </label>
          <label>
            <span>{{ t('explorer.yarnQueues.form.capacity') }}</span>
            <input v-model="queueCapacity" type="number" min="0" max="100" step="0.1">
          </label>
          <label>
            <span>{{ t('explorer.yarnQueues.form.maxCapacity') }}</span>
            <input v-model="queueMaxCapacity" type="number" min="0" max="100" step="0.1">
          </label>
        </div>
        <div class="yarn-queues-tab__actions">
          <DwButton size="sm" :disabled="saving" @click="applyQueueChanges">
            {{ t('explorer.yarnQueues.applyChanges') }}
          </DwButton>
          <DwButton size="sm" variant="danger" :disabled="saving" @click="removeSelectedQueue">
            {{ t('explorer.yarnQueues.removeQueue') }}
          </DwButton>
        </div>
        <p class="yarn-queues-tab__hint">{{ t('explorer.yarnQueues.mutableHint') }}</p>
      </section>
    </div>
    <EmptyState v-else-if="!loading" :title="t('explorer.yarnQueues.empty')" />
  </div>
</template>

<style scoped>
.yarn-queues-tab {
  display: flex;
  flex-direction: column;
  height: 100%;
  min-height: 0;
  background: var(--dw-bg-editor);
}

.yarn-queues-tab__head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: var(--dw-space-5) var(--dw-space-8);
  border-bottom: 1px solid var(--dw-border);
  background: var(--dw-bg-panel);
}

.yarn-queues-tab__head h2 {
  margin: 0;
  font-size: var(--dw-text-lg);
}

.yarn-queues-tab__head p {
  margin: var(--dw-space-2) 0 0;
  font-size: var(--dw-text-sm);
  color: var(--dw-text-muted);
}

.yarn-queues-tab__scheduler {
  margin-top: var(--dw-space-1) !important;
}

.yarn-queues-tab__body {
  display: grid;
  grid-template-columns: minmax(0, 1.4fr) minmax(280px, 0.9fr);
  gap: var(--dw-space-8);
  flex: 1;
  min-height: 0;
  padding: var(--dw-space-6) var(--dw-space-8);
}

.yarn-queues-tab__table-wrap {
  overflow: auto;
  border: 1px solid var(--dw-border);
  border-radius: var(--dw-control-radius);
}

.yarn-queues-tab__table-wrap table {
  width: 100%;
  border-collapse: collapse;
  font-size: var(--dw-text-sm);
}

.yarn-queues-tab__table-wrap th,
.yarn-queues-tab__table-wrap td {
  padding: var(--dw-pad-control);
  border-bottom: 1px solid var(--dw-border);
  text-align: left;
}

.yarn-queues-tab__table-wrap tbody tr {
  cursor: pointer;
}

.yarn-queues-tab__table-wrap tbody tr:hover,
.yarn-queues-tab__table-wrap tbody tr.is-selected {
  background: color-mix(in srgb, var(--dw-accent) 10%, transparent);
}

.yarn-queues-tab__editor {
  border: 1px solid var(--dw-border);
  border-radius: var(--dw-control-radius);
  padding: var(--dw-space-6);
  background: var(--dw-bg-panel);
}

.yarn-queues-tab__editor h3 {
  margin: 0 0 var(--dw-space-6);
  font-size: var(--dw-text-xl);
}

.yarn-queues-tab__form {
  display: grid;
  gap: var(--dw-gap-md);
}

.yarn-queues-tab__form label {
  display: flex;
  flex-direction: column;
  gap: var(--dw-gap-xs);
  font-size: var(--dw-text-sm);
  color: var(--dw-text-muted);
}

.yarn-queues-tab__form input,
.yarn-queues-tab__form select {
  padding: var(--dw-pad-tight);
  border: 1px solid var(--dw-border);
  border-radius: var(--dw-control-radius-sm);
  background: var(--dw-bg-input);
  color: var(--dw-text);
}

.yarn-queues-tab__actions {
  display: flex;
  gap: var(--dw-gap);
  margin-top: var(--dw-space-6);
}

.yarn-queues-tab__hint {
  margin: var(--dw-space-5) 0 0;
  font-size: var(--dw-text-xs);
  color: var(--dw-text-muted);
  line-height: var(--dw-leading-relaxed);
}

.yarn-queues-tab__status {
  padding: var(--dw-space-6) var(--dw-space-8);
  font-size: var(--dw-text-sm);
  color: var(--dw-text-muted);
}

.yarn-queues-tab__status.is-error {
  color: var(--dw-danger);
}

.yarn-queues-tab__status.is-success {
  color: var(--dw-success);
}
</style>
