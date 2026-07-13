<script setup lang="ts">
import {computed, onMounted, ref, watch} from 'vue'
import {useI18n} from 'vue-i18n'
import {DwButton, EmptyState} from '@/core/components'
import {configApi, explorerApi} from '@/api'
import type {YarnAppDetail, YarnAppSummary, YarnQueueSummary} from '@/features/explorer/services/yarn-applications.service'
import {
    formatYarnDuration,
    formatYarnMemory,
    formatYarnTimestamp,
    isYarnAppKillable,
} from '@/features/explorer/services/yarn-applications.service'
import {useWorkspaceStore} from '@/features/workspace/stores/workspace'
import {useLayoutStore} from '@/features/layout/stores/layout'
import {
    buildYarnLogsCommand,
    findSshConnectionForHost,
} from '@/features/ssh/services/ssh-yarn-bridge.service'
import {sendToSshTerminal} from '@/features/terminal/services/ssh-terminal-session.service'

const props = defineProps<{
  connectionId: string
  initialAppId?: string
}>()

const {t} = useI18n()
const workspace = useWorkspaceStore()
const layout = useLayoutStore()

const stateFilter = ref('RUNNING')
const userFilter = ref('')
const queueFilter = ref('')
const apps = ref<YarnAppSummary[]>([])
const selectedApp = ref<YarnAppDetail | null>(null)
const loading = ref(false)
const detailLoading = ref(false)
const mutationLoading = ref(false)
const error = ref<string | null>(null)
const notice = ref<string | null>(null)
const queueOptions = ref<YarnQueueSummary[]>([])
const moveQueueInput = ref('')
const killDiagnostics = ref('')

const canKillSelected = computed(() => isYarnAppKillable(selectedApp.value?.state))

const selectedAmHost = computed(() => selectedApp.value?.amHostHttpAddress ?? '')

const statusText = computed(() => {
  if (loading.value) return t('explorer.yarnApps.loading')
  if (error.value) return error.value
  return t('explorer.yarnApps.status', {count: apps.value.length})
})

async function loadApps() {
  if (!props.connectionId) return
  loading.value = true
  error.value = null
  notice.value = null
  selectedApp.value = null
  try {
    const result = await explorerApi.fetchYarnApplications(props.connectionId, {
      state: stateFilter.value.trim() || undefined,
      user: userFilter.value.trim() || undefined,
      queue: queueFilter.value.trim() || undefined,
      limit: 200,
    })
    apps.value = result.apps
    await selectInitialAppIfNeeded()
  } catch (err) {
    error.value = err instanceof Error ? err.message : t('explorer.yarnApps.loadFailed')
    apps.value = []
  } finally {
    loading.value = false
  }
}

async function selectApp(app: YarnAppSummary) {
  if (!props.connectionId || !app.id) return
  detailLoading.value = true
  killDiagnostics.value = ''
  moveQueueInput.value = app.queue ?? ''
  try {
    const detail = await explorerApi.fetchYarnApplicationDetail(props.connectionId, app.id)
    selectedApp.value = detail
    moveQueueInput.value = detail.queue ?? moveQueueInput.value
  } catch (err) {
    error.value = err instanceof Error ? err.message : t('explorer.yarnApps.detailFailed')
  } finally {
    detailLoading.value = false
  }
}

async function loadQueueOptions() {
  if (!props.connectionId) return
  try {
    const result = await explorerApi.fetchYarnQueues(props.connectionId)
    queueOptions.value = result.queues
  } catch {
    queueOptions.value = []
  }
}

async function killSelectedApp() {
  if (!props.connectionId || !selectedApp.value?.id || !canKillSelected.value) return
  if (!window.confirm(t('explorer.yarnApps.killConfirm', {id: selectedApp.value.id}))) return
  mutationLoading.value = true
  error.value = null
  notice.value = null
  try {
    const result = await explorerApi.killYarnApplication(
        props.connectionId,
        selectedApp.value.id,
        killDiagnostics.value.trim() ? {diagnostics: killDiagnostics.value.trim()} : undefined,
    )
    notice.value = result.message
    await loadApps()
    if (selectedApp.value?.id) {
      selectedApp.value = await explorerApi.fetchYarnApplicationDetail(
          props.connectionId,
          selectedApp.value.id,
      )
    }
  } catch (err) {
    error.value = err instanceof Error ? err.message : t('explorer.yarnApps.killFailed')
  } finally {
    mutationLoading.value = false
  }
}

async function moveSelectedApp() {
  if (!props.connectionId || !selectedApp.value?.id) return
  const appId = selectedApp.value.id
  const queue = moveQueueInput.value.trim()
  if (!queue) return
  mutationLoading.value = true
  error.value = null
  notice.value = null
  try {
    const result = await explorerApi.moveYarnApplicationQueue(
        props.connectionId,
        appId,
        {queue},
    )
    notice.value = result.message
    await loadApps()
    const detail = await explorerApi.fetchYarnApplicationDetail(props.connectionId, appId)
    selectedApp.value = detail
    moveQueueInput.value = detail.queue ?? queue
  } catch (err) {
    error.value = err instanceof Error ? err.message : t('explorer.yarnApps.moveQueueFailed')
  } finally {
    mutationLoading.value = false
  }
}

function refresh() {
  loadApps()
}

async function selectInitialAppIfNeeded() {
  const appId = props.initialAppId?.trim()
  if (!appId) return
  const match = apps.value.find((app) => app.id === appId)
  if (match) {
    await selectApp(match)
  }
}

async function openSshForSelectedApp() {
  if (!selectedApp.value?.id) return
  try {
    const catalog = await configApi.fetchConnectionsCatalog()
    const host = selectedAmHost.value || catalog.connections.find((entry) => entry.id === props.connectionId)?.config.host
    const ssh = findSshConnectionForHost(host ?? '', catalog)
    if (!ssh) {
      layout.showToast(t('ssh.yarnBridge.noSshConnection'))
      return
    }
    workspace.openSshTerminal({
      connectionId: ssh.connectionId,
      connectionName: ssh.label,
    })
  } catch (error) {
    layout.showToast(error instanceof Error ? error.message : t('ssh.yarnBridge.openSshFailed'))
  }
}

async function pasteYarnLogsForSelectedApp() {
  if (!selectedApp.value?.id) return
  try {
    const catalog = await configApi.fetchConnectionsCatalog()
    const host = selectedAmHost.value || catalog.connections.find((entry) => entry.id === props.connectionId)?.config.host
    const ssh = findSshConnectionForHost(host ?? '', catalog)
    if (!ssh) {
      layout.showToast(t('ssh.yarnBridge.noSshConnection'))
      return
    }
    workspace.openSshTerminal({
      connectionId: ssh.connectionId,
      connectionName: ssh.label,
    })
    const command = buildYarnLogsCommand(selectedApp.value.id)
    const ok = await sendToSshTerminal(ssh.connectionId, command, {focus: true})
    if (!ok) {
      layout.showToast(t('ssh.quickOps.pasteFailed'))
    }
  } catch (error) {
    layout.showToast(error instanceof Error ? error.message : t('ssh.yarnBridge.pasteLogsFailed'))
  }
}

defineExpose({refresh})

onMounted(() => {
  loadApps()
  loadQueueOptions()
})
watch(() => props.connectionId, () => {
  loadApps()
  loadQueueOptions()
})

watch(() => props.initialAppId, () => {
  void selectInitialAppIfNeeded()
})
</script>

<template>
  <div class="yarn-apps-panel">
    <header class="yarn-apps-panel__filters">
      <label>
        <span>{{ t('explorer.yarnApps.state') }}</span>
        <select v-model="stateFilter">
          <option value="">{{ t('explorer.yarnApps.allStates') }}</option>
          <option value="RUNNING">RUNNING</option>
          <option value="ACCEPTED">ACCEPTED</option>
          <option value="FINISHED">FINISHED</option>
          <option value="FAILED">FAILED</option>
          <option value="KILLED">KILLED</option>
        </select>
      </label>
      <label>
        <span>{{ t('explorer.yarnApps.user') }}</span>
        <input v-model="userFilter" type="text" :placeholder="t('explorer.yarnApps.userPlaceholder')">
      </label>
      <label>
        <span>{{ t('explorer.yarnApps.queue') }}</span>
        <input v-model="queueFilter" type="text" :placeholder="t('explorer.yarnApps.queuePlaceholder')">
      </label>
      <DwButton size="sm" @click="loadApps">{{ t('explorer.yarnApps.applyFilters') }}</DwButton>
    </header>

    <p class="yarn-apps-panel__status">{{ statusText }}</p>
    <p v-if="notice" class="yarn-apps-panel__notice">{{ notice }}</p>

    <div v-if="apps.length" class="yarn-apps-panel__table-wrap">
      <table class="yarn-apps-panel__table">
        <thead>
          <tr>
            <th>{{ t('explorer.yarnApps.columns.id') }}</th>
            <th>{{ t('explorer.yarnApps.columns.name') }}</th>
            <th>{{ t('explorer.yarnApps.columns.user') }}</th>
            <th>{{ t('explorer.yarnApps.columns.queue') }}</th>
            <th>{{ t('explorer.yarnApps.columns.state') }}</th>
            <th>{{ t('explorer.yarnApps.columns.type') }}</th>
            <th>{{ t('explorer.yarnApps.columns.progress') }}</th>
            <th>{{ t('explorer.yarnApps.columns.elapsed') }}</th>
          </tr>
        </thead>
        <tbody>
          <tr
              v-for="app in apps"
              :key="app.id ?? app.name ?? Math.random()"
              :class="{ 'is-selected': selectedApp?.id === app.id }"
              @click="selectApp(app)"
          >
            <td>{{ app.id ?? '—' }}</td>
            <td>{{ app.name ?? '—' }}</td>
            <td>{{ app.user ?? '—' }}</td>
            <td>{{ app.queue ?? '—' }}</td>
            <td><span class="yarn-apps-panel__badge">{{ app.state ?? '—' }}</span></td>
            <td>{{ app.applicationType ?? '—' }}</td>
            <td>{{ app.progress?.toFixed?.(1) ?? 0 }}%</td>
            <td>{{ formatYarnDuration(app.elapsedTime) }}</td>
          </tr>
        </tbody>
      </table>
    </div>
    <EmptyState v-else-if="!loading" :title="t('explorer.yarnApps.empty')" />

    <section v-if="selectedApp" class="yarn-apps-panel__detail">
      <h3>{{ t('explorer.yarnApps.detailTitle') }}</h3>
      <dl>
        <div><dt>ID</dt><dd>{{ selectedApp.id ?? '—' }}</dd></div>
        <div><dt>{{ t('explorer.yarnApps.columns.name') }}</dt><dd>{{ selectedApp.name ?? '—' }}</dd></div>
        <div><dt>{{ t('explorer.yarnApps.columns.state') }}</dt><dd>{{ selectedApp.state ?? '—' }}</dd></div>
        <div><dt>{{ t('explorer.yarnApps.columns.type') }}</dt><dd>{{ selectedApp.applicationType ?? '—' }}</dd></div>
        <div><dt>{{ t('explorer.yarnApps.started') }}</dt><dd>{{ formatYarnTimestamp(selectedApp.startedTime) }}</dd></div>
        <div><dt>{{ t('explorer.yarnApps.memory') }}</dt><dd>{{ formatYarnMemory(selectedApp.allocatedMb) }}</dd></div>
        <div><dt>{{ t('explorer.yarnApps.vcores') }}</dt><dd>{{ selectedApp.allocatedVCores ?? 0 }}</dd></div>
        <div v-if="selectedApp.trackingUrl"><dt>Tracking</dt><dd><a :href="selectedApp.trackingUrl" target="_blank" rel="noreferrer">{{ selectedApp.trackingUrl }}</a></dd></div>
        <div v-if="selectedApp.diagnostics"><dt>{{ t('explorer.yarnApps.diagnostics') }}</dt><dd class="yarn-apps-panel__diagnostics">{{ selectedApp.diagnostics }}</dd></div>
      </dl>
      <p v-if="detailLoading" class="yarn-apps-panel__detail-loading">{{ t('explorer.yarnApps.loadingDetail') }}</p>
      <div class="yarn-apps-panel__actions">
        <DwButton size="sm" :disabled="!selectedApp?.id" @click="openSshForSelectedApp">
          {{ t('ssh.yarnBridge.openSshTerminal') }}
        </DwButton>
        <DwButton size="sm" :disabled="!selectedApp?.id" @click="pasteYarnLogsForSelectedApp">
          {{ t('ssh.yarnBridge.pasteYarnLogs') }}
        </DwButton>
        <label>
          <span>{{ t('explorer.yarnApps.moveQueue') }}</span>
          <input
              v-model="moveQueueInput"
              type="text"
              list="yarn-queue-options"
              :placeholder="t('explorer.yarnApps.moveQueuePlaceholder')"
          >
          <datalist id="yarn-queue-options">
            <option v-for="queue in queueOptions" :key="queue.name ?? ''" :value="queue.name ?? ''" />
          </datalist>
        </label>
        <DwButton
            size="sm"
            :disabled="mutationLoading || !moveQueueInput.trim()"
            @click="moveSelectedApp"
        >
          {{ t('explorer.yarnApps.moveQueueAction') }}
        </DwButton>
        <label class="yarn-apps-panel__diagnostics-input">
          <span>{{ t('explorer.yarnApps.killReason') }}</span>
          <input v-model="killDiagnostics" type="text" :placeholder="t('explorer.yarnApps.killReasonPlaceholder')">
        </label>
        <DwButton
            size="sm"
            variant="danger"
            :disabled="mutationLoading || !canKillSelected"
            @click="killSelectedApp"
        >
          {{ t('explorer.yarnApps.killAction') }}
        </DwButton>
      </div>
    </section>
  </div>
</template>

<style scoped>
.yarn-apps-panel {
  display: flex;
  flex-direction: column;
  gap: 12px;
  min-height: 0;
  height: 100%;
}

.yarn-apps-panel__filters {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  align-items: end;
}

.yarn-apps-panel__filters label {
  display: flex;
  flex-direction: column;
  gap: 4px;
  font-size: 12px;
  color: var(--dw-text-muted);
}

.yarn-apps-panel__filters input,
.yarn-apps-panel__filters select {
  min-width: 140px;
  padding: 6px 8px;
  border: 1px solid var(--dw-border);
  border-radius: 6px;
  background: var(--dw-bg-input);
  color: var(--dw-text);
}

.yarn-apps-panel__status {
  margin: 0;
  font-size: 12px;
  color: var(--dw-text-muted);
}

.yarn-apps-panel__notice {
  margin: 0;
  font-size: 12px;
  color: var(--dw-success, #16a34a);
}

.yarn-apps-panel__table-wrap {
  flex: 1;
  min-height: 0;
  overflow: auto;
  border: 1px solid var(--dw-border);
  border-radius: 8px;
}

.yarn-apps-panel__table {
  width: 100%;
  border-collapse: collapse;
  font-size: 12px;
}

.yarn-apps-panel__table th,
.yarn-apps-panel__table td {
  padding: 8px 10px;
  border-bottom: 1px solid var(--dw-border);
  text-align: left;
  white-space: nowrap;
}

.yarn-apps-panel__table tbody tr {
  cursor: pointer;
}

.yarn-apps-panel__table tbody tr:hover,
.yarn-apps-panel__table tbody tr.is-selected {
  background: color-mix(in srgb, var(--dw-accent) 10%, transparent);
}

.yarn-apps-panel__badge {
  display: inline-block;
  padding: 2px 6px;
  border-radius: 999px;
  background: color-mix(in srgb, var(--dw-accent) 15%, transparent);
  font-size: 11px;
}

.yarn-apps-panel__detail {
  border-top: 1px solid var(--dw-border);
  padding-top: 12px;
}

.yarn-apps-panel__detail dl {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
  gap: 8px 16px;
  margin: 0;
}

.yarn-apps-panel__detail dt {
  font-size: 11px;
  color: var(--dw-text-muted);
}

.yarn-apps-panel__detail dd {
  margin: 2px 0 0;
  font-size: 13px;
  word-break: break-all;
}

.yarn-apps-panel__diagnostics {
  white-space: pre-wrap;
  font-family: var(--dw-font-mono);
  font-size: 12px;
}

.yarn-apps-panel__actions {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  align-items: end;
  margin-top: 12px;
}

.yarn-apps-panel__actions label {
  display: flex;
  flex-direction: column;
  gap: 4px;
  font-size: 12px;
  color: var(--dw-text-muted);
}

.yarn-apps-panel__actions input {
  min-width: 180px;
  padding: 6px 8px;
  border: 1px solid var(--dw-border);
  border-radius: 6px;
  background: var(--dw-bg-input);
  color: var(--dw-text);
}

.yarn-apps-panel__diagnostics-input {
  flex: 1;
  min-width: 220px;
}
</style>
