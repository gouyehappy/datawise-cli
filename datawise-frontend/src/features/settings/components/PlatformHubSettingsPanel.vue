<script setup lang="ts">
import {computed, onMounted, reactive, ref} from 'vue'
import {useI18n} from 'vue-i18n'
import {platformApi} from '@/api'
import type {
    AnalysisCanvasSummary,
    FederatedViewSource,
    FederatedViewSummary,
    ScheduledTask,
    SchemaDriftMonitor,
    SemanticMetric,
} from '@/features/platform/types/platform.types'
import {useLayoutStore} from '@/features/layout/stores/layout'
import {DwButton, DwInput, EmptyState, FormField} from '@/core/components'

type PlatformTab = 'canvas' | 'metrics' | 'federated' | 'drift' | 'tasks'

const {t} = useI18n()
const layout = useLayoutStore()

const tabs: {id: PlatformTab; labelKey: string}[] = [
    {id: 'canvas', labelKey: 'platform.tabs.canvas'},
    {id: 'metrics', labelKey: 'platform.tabs.metrics'},
    {id: 'federated', labelKey: 'platform.tabs.federated'},
    {id: 'drift', labelKey: 'platform.tabs.drift'},
    {id: 'tasks', labelKey: 'platform.tabs.tasks'},
]

const activeTab = ref<PlatformTab>('canvas')
const loading = ref(false)
const saving = ref(false)
const runningId = ref<string | null>(null)

const canvasItems = ref<AnalysisCanvasSummary[]>([])
const metricItems = ref<SemanticMetric[]>([])
const federatedItems = ref<FederatedViewSummary[]>([])
const driftItems = ref<SchemaDriftMonitor[]>([])
const taskItems = ref<ScheduledTask[]>([])

const canvasForm = reactive({
    title: '',
    description: '',
    promptTemplate: '',
    sql: '',
    summary: '',
})
const metricForm = reactive({
    connectionId: '',
    database: '',
    name: '',
    expression: '',
    description: '',
    unit: '',
})
const metricAutoConnectionId = ref('')
const metricAutoDatabase = ref('')
const federatedForm = reactive({
    name: '',
    description: '',
    sql: '',
})
const federatedSourcesJson = ref('[]')
const driftForm = reactive({
    name: '',
    sourceConnectionId: '',
    sourceDatabase: '',
    targetConnectionId: '',
    targetDatabase: '',
    tablePattern: '%',
    enabled: true,
})
const taskForm = reactive({
    name: '',
    type: 'sql',
    cronExpression: '0 0 * * *',
    payloadJson: '{}',
    enabled: true,
})

const activeListEmpty = computed(() => {
    switch (activeTab.value) {
        case 'canvas':
            return canvasItems.value.length === 0
        case 'metrics':
            return metricItems.value.length === 0
        case 'federated':
            return federatedItems.value.length === 0
        case 'drift':
            return driftItems.value.length === 0
        case 'tasks':
            return taskItems.value.length === 0
        default:
            return true
    }
})

function formatTime(value?: string | null): string {
    if (!value) return '—'
    const date = new Date(value)
    return Number.isNaN(date.getTime()) ? value : date.toLocaleString()
}

async function refreshActiveTab() {
    loading.value = true
    try {
        switch (activeTab.value) {
            case 'canvas':
                canvasItems.value = await platformApi.listAnalysisCanvas()
                break
            case 'metrics':
                metricItems.value = await platformApi.listSemanticMetrics()
                break
            case 'federated':
                federatedItems.value = await platformApi.listFederatedViews()
                break
            case 'drift':
                driftItems.value = await platformApi.listSchemaDriftMonitors()
                break
            case 'tasks':
                taskItems.value = await platformApi.listScheduledTasks()
                break
        }
    } catch (error) {
        layout.showToast(error instanceof Error ? error.message : String(error))
    } finally {
        loading.value = false
    }
}

async function onSelectTab(tab: PlatformTab) {
    activeTab.value = tab
    await refreshActiveTab()
}

async function saveCanvas() {
    if (!canvasForm.title.trim()) return
    saving.value = true
    try {
        await platformApi.saveAnalysisCanvas({...canvasForm, title: canvasForm.title.trim()})
        canvasForm.title = ''
        canvasForm.description = ''
        canvasForm.promptTemplate = ''
        canvasForm.sql = ''
        canvasForm.summary = ''
        layout.showToast(t('platform.common.saved'))
        await refreshActiveTab()
    } catch (error) {
        layout.showToast(error instanceof Error ? error.message : String(error))
    } finally {
        saving.value = false
    }
}

async function deleteCanvas(id: string, title: string) {
    if (!window.confirm(t('platform.common.confirmDelete', {name: title}))) return
    try {
        await platformApi.deleteAnalysisCanvas(id)
        layout.showToast(t('platform.common.deleted'))
        await refreshActiveTab()
    } catch (error) {
        layout.showToast(error instanceof Error ? error.message : String(error))
    }
}

async function rerunCanvas(id: string) {
    runningId.value = id
    try {
        const result = await platformApi.rerunAnalysisCanvas({canvasId: id, parameterValues: {}})
        layout.showToast(t('platform.canvas.rerunDone'))
        if (result.sql?.trim()) {
            await navigator.clipboard.writeText(result.sql)
        }
    } catch (error) {
        layout.showToast(error instanceof Error ? error.message : String(error))
    } finally {
        runningId.value = null
    }
}

async function saveMetric() {
    if (!metricForm.connectionId.trim() || !metricForm.database.trim() || !metricForm.name.trim()) return
    saving.value = true
    try {
        await platformApi.saveSemanticMetric({...metricForm})
        metricForm.name = ''
        metricForm.expression = ''
        metricForm.description = ''
        metricForm.unit = ''
        layout.showToast(t('platform.common.saved'))
        await refreshActiveTab()
    } catch (error) {
        layout.showToast(error instanceof Error ? error.message : String(error))
    } finally {
        saving.value = false
    }
}

async function deleteMetric(id: string, name: string) {
    if (!window.confirm(t('platform.common.confirmDelete', {name}))) return
    try {
        await platformApi.deleteSemanticMetric(id)
        layout.showToast(t('platform.common.deleted'))
        await refreshActiveTab()
    } catch (error) {
        layout.showToast(error instanceof Error ? error.message : String(error))
    }
}

async function autoGenerateMetrics() {
    if (!metricAutoConnectionId.value.trim() || !metricAutoDatabase.value.trim()) return
    saving.value = true
    try {
        const created = await platformApi.autoGenerateSemanticMetrics({
            connectionId: metricAutoConnectionId.value.trim(),
            database: metricAutoDatabase.value.trim(),
        })
        layout.showToast(t('platform.metrics.autoGenerateDone', {count: created.length}))
        await refreshActiveTab()
    } catch (error) {
        layout.showToast(error instanceof Error ? error.message : String(error))
    } finally {
        saving.value = false
    }
}

async function saveFederated() {
    if (!federatedForm.name.trim()) return
    saving.value = true
    try {
        let sources: FederatedViewSource[] = []
        if (federatedSourcesJson.value.trim()) {
            sources = JSON.parse(federatedSourcesJson.value) as FederatedViewSource[]
        }
        await platformApi.saveFederatedView({
            ...federatedForm,
            name: federatedForm.name.trim(),
            sources,
        })
        federatedForm.name = ''
        federatedForm.description = ''
        federatedForm.sql = ''
        federatedSourcesJson.value = '[]'
        layout.showToast(t('platform.common.saved'))
        await refreshActiveTab()
    } catch (error) {
        layout.showToast(error instanceof Error ? error.message : String(error))
    } finally {
        saving.value = false
    }
}

async function deleteFederated(id: string, name: string) {
    if (!window.confirm(t('platform.common.confirmDelete', {name}))) return
    try {
        await platformApi.deleteFederatedView(id)
        layout.showToast(t('platform.common.deleted'))
        await refreshActiveTab()
    } catch (error) {
        layout.showToast(error instanceof Error ? error.message : String(error))
    }
}

async function executeFederated(id: string) {
    runningId.value = id
    try {
        const result = await platformApi.executeFederatedView({viewId: id, maxRows: 100})
        layout.showToast(t('platform.federated.executeDone', {rows: result.rowCount ?? 0}))
    } catch (error) {
        layout.showToast(error instanceof Error ? error.message : String(error))
    } finally {
        runningId.value = null
    }
}

async function saveDriftMonitor() {
    if (!driftForm.name.trim()) return
    saving.value = true
    try {
        await platformApi.saveSchemaDriftMonitor({...driftForm, name: driftForm.name.trim()})
        driftForm.name = ''
        layout.showToast(t('platform.common.saved'))
        await refreshActiveTab()
    } catch (error) {
        layout.showToast(error instanceof Error ? error.message : String(error))
    } finally {
        saving.value = false
    }
}

async function deleteDriftMonitor(id: string, name: string) {
    if (!window.confirm(t('platform.common.confirmDelete', {name}))) return
    try {
        await platformApi.deleteSchemaDriftMonitor(id)
        layout.showToast(t('platform.common.deleted'))
        await refreshActiveTab()
    } catch (error) {
        layout.showToast(error instanceof Error ? error.message : String(error))
    }
}

async function runDriftMonitor(id: string) {
    runningId.value = id
    try {
        const report = await platformApi.runSchemaDriftMonitor(id)
        layout.showToast(t('platform.common.runDone') + ` (${report.driftTableCount})`)
        await refreshActiveTab()
    } catch (error) {
        layout.showToast(error instanceof Error ? error.message : String(error))
    } finally {
        runningId.value = null
    }
}

async function saveTask() {
    if (!taskForm.name.trim() || !taskForm.type.trim()) return
    saving.value = true
    try {
        await platformApi.saveScheduledTask({...taskForm, name: taskForm.name.trim()})
        taskForm.name = ''
        layout.showToast(t('platform.common.saved'))
        await refreshActiveTab()
    } catch (error) {
        layout.showToast(error instanceof Error ? error.message : String(error))
    } finally {
        saving.value = false
    }
}

async function deleteTask(id: string, name: string) {
    if (!window.confirm(t('platform.common.confirmDelete', {name}))) return
    try {
        await platformApi.deleteScheduledTask(id)
        layout.showToast(t('platform.common.deleted'))
        await refreshActiveTab()
    } catch (error) {
        layout.showToast(error instanceof Error ? error.message : String(error))
    }
}

async function runTask(id: string) {
    runningId.value = id
    try {
        await platformApi.runScheduledTask(id)
        layout.showToast(t('platform.common.runDone'))
        await refreshActiveTab()
    } catch (error) {
        layout.showToast(error instanceof Error ? error.message : String(error))
    } finally {
        runningId.value = null
    }
}

onMounted(() => {
    void refreshActiveTab()
})
</script>

<template>
  <div class="platform-hub-settings">
    <header class="panel-head">
      <h2>{{ t('platform.title') }}</h2>
      <p>{{ t('platform.subtitle') }}</p>
    </header>

    <div class="platform-tabs">
      <button
          v-for="tab in tabs"
          :key="tab.id"
          class="platform-tab"
          :class="{'is-active': activeTab === tab.id}"
          type="button"
          @click="onSelectTab(tab.id)"
      >
        {{ t(tab.labelKey) }}
      </button>
      <DwButton class="platform-refresh" size="sm" variant="ghost" :disabled="loading" @click="refreshActiveTab">
        {{ t('platform.common.refresh') }}
      </DwButton>
    </div>

    <p v-if="loading" class="platform-status">{{ t('platform.common.loading') }}</p>

    <EmptyState v-else-if="activeListEmpty" compact :title="t('platform.common.empty')"/>

    <section v-else-if="activeTab === 'canvas'" class="platform-list">
      <article v-for="item in canvasItems" :key="item.id" class="platform-row">
        <div class="platform-row__main">
          <strong>{{ item.title }}</strong>
          <span class="platform-row__meta">{{ t('platform.canvas.parameterCount', {count: item.parameterCount}) }}</span>
          <span class="platform-row__meta">{{ formatTime(item.updatedAt) }}</span>
        </div>
        <div class="platform-row__actions">
          <DwButton size="sm" variant="ghost" :disabled="runningId === item.id" @click="rerunCanvas(item.id)">
            {{ t('platform.canvas.rerun') }}
          </DwButton>
          <DwButton size="sm" variant="ghost" @click="deleteCanvas(item.id, item.title)">
            {{ t('platform.common.delete') }}
          </DwButton>
        </div>
      </article>
    </section>

    <section v-else-if="activeTab === 'metrics'" class="platform-list">
      <article v-for="item in metricItems" :key="item.id" class="platform-row">
        <div class="platform-row__main">
          <strong>{{ item.name }}</strong>
          <span class="platform-row__meta">{{ item.connectionId }} / {{ item.database }}</span>
          <span class="platform-row__meta">{{ item.expression }}</span>
        </div>
        <div class="platform-row__actions">
          <DwButton size="sm" variant="ghost" @click="deleteMetric(item.id, item.name)">
            {{ t('platform.common.delete') }}
          </DwButton>
        </div>
      </article>
    </section>

    <section v-else-if="activeTab === 'federated'" class="platform-list">
      <article v-for="item in federatedItems" :key="item.id" class="platform-row">
        <div class="platform-row__main">
          <strong>{{ item.name }}</strong>
          <span class="platform-row__meta">{{ t('platform.federated.sourceCount', {count: item.sourceCount}) }}</span>
          <span class="platform-row__meta">{{ formatTime(item.updatedAt) }}</span>
        </div>
        <div class="platform-row__actions">
          <DwButton size="sm" variant="ghost" :disabled="runningId === item.id" @click="executeFederated(item.id)">
            {{ t('platform.federated.execute') }}
          </DwButton>
          <DwButton size="sm" variant="ghost" @click="deleteFederated(item.id, item.name)">
            {{ t('platform.common.delete') }}
          </DwButton>
        </div>
      </article>
    </section>

    <section v-else-if="activeTab === 'drift'" class="platform-list">
      <article v-for="item in driftItems" :key="item.id" class="platform-row">
        <div class="platform-row__main">
          <strong>{{ item.name }}</strong>
          <span class="platform-row__meta">
            {{ item.sourceConnectionId }}/{{ item.sourceDatabase }} →
            {{ item.targetConnectionId }}/{{ item.targetDatabase }}
          </span>
          <span class="platform-row__meta">{{ t('platform.drift.driftCount', {count: item.driftCount}) }}</span>
        </div>
        <div class="platform-row__actions">
          <DwButton size="sm" variant="ghost" :disabled="runningId === item.id" @click="runDriftMonitor(item.id)">
            {{ t('platform.common.run') }}
          </DwButton>
          <DwButton size="sm" variant="ghost" @click="deleteDriftMonitor(item.id, item.name)">
            {{ t('platform.common.delete') }}
          </DwButton>
        </div>
      </article>
    </section>

    <section v-else-if="activeTab === 'tasks'" class="platform-list">
      <article v-for="item in taskItems" :key="item.id" class="platform-row">
        <div class="platform-row__main">
          <strong>{{ item.name }}</strong>
          <span class="platform-row__meta">{{ item.type }} · {{ item.cronExpression || '—' }}</span>
          <span class="platform-row__meta">{{ item.lastRunStatus || '—' }}</span>
        </div>
        <div class="platform-row__actions">
          <DwButton size="sm" variant="ghost" :disabled="runningId === item.id" @click="runTask(item.id)">
            {{ t('platform.common.run') }}
          </DwButton>
          <DwButton size="sm" variant="ghost" @click="deleteTask(item.id, item.name)">
            {{ t('platform.common.delete') }}
          </DwButton>
        </div>
      </article>
    </section>

    <section class="platform-form">
      <h3 v-if="activeTab === 'canvas'">{{ t('platform.canvas.formTitle') }}</h3>
      <h3 v-else-if="activeTab === 'metrics'">{{ t('platform.metrics.formTitle') }}</h3>
      <h3 v-else-if="activeTab === 'federated'">{{ t('platform.federated.formTitle') }}</h3>
      <h3 v-else-if="activeTab === 'drift'">{{ t('platform.drift.formTitle') }}</h3>
      <h3 v-else>{{ t('platform.tasks.formTitle') }}</h3>

      <template v-if="activeTab === 'canvas'">
        <FormField :label="t('platform.common.title')">
          <DwInput v-model="canvasForm.title"/>
        </FormField>
        <FormField :label="t('platform.common.description')">
          <DwInput v-model="canvasForm.description"/>
        </FormField>
        <FormField :label="t('platform.canvas.promptTemplate')">
          <DwInput v-model="canvasForm.promptTemplate"/>
        </FormField>
        <FormField :label="t('platform.common.sql')">
          <DwInput v-model="canvasForm.sql"/>
        </FormField>
        <DwButton :disabled="saving" @click="saveCanvas">{{ t('platform.common.save') }}</DwButton>
      </template>

      <template v-else-if="activeTab === 'metrics'">
        <FormField :label="t('platform.common.connectionId')">
          <DwInput v-model="metricForm.connectionId"/>
        </FormField>
        <FormField :label="t('platform.common.database')">
          <DwInput v-model="metricForm.database"/>
        </FormField>
        <FormField :label="t('platform.common.name')">
          <DwInput v-model="metricForm.name"/>
        </FormField>
        <FormField :label="t('platform.metrics.expression')">
          <DwInput v-model="metricForm.expression"/>
        </FormField>
        <FormField :label="t('platform.metrics.unit')">
          <DwInput v-model="metricForm.unit"/>
        </FormField>
        <div class="platform-form__actions">
          <DwButton :disabled="saving" @click="saveMetric">{{ t('platform.common.save') }}</DwButton>
        </div>
        <div class="platform-auto-row">
          <FormField :label="t('platform.common.connectionId')">
            <DwInput v-model="metricAutoConnectionId"/>
          </FormField>
          <FormField :label="t('platform.common.database')">
            <DwInput v-model="metricAutoDatabase"/>
          </FormField>
          <DwButton variant="ghost" :disabled="saving" @click="autoGenerateMetrics">
            {{ t('platform.metrics.autoGenerate') }}
          </DwButton>
        </div>
      </template>

      <template v-else-if="activeTab === 'federated'">
        <FormField :label="t('platform.common.name')">
          <DwInput v-model="federatedForm.name"/>
        </FormField>
        <FormField :label="t('platform.common.description')">
          <DwInput v-model="federatedForm.description"/>
        </FormField>
        <FormField :label="t('platform.common.sql')">
          <DwInput v-model="federatedForm.sql"/>
        </FormField>
        <FormField :label="t('platform.federated.sourcesJson')">
          <DwInput v-model="federatedSourcesJson"/>
        </FormField>
        <DwButton :disabled="saving" @click="saveFederated">{{ t('platform.common.save') }}</DwButton>
      </template>

      <template v-else-if="activeTab === 'drift'">
        <FormField :label="t('platform.common.name')">
          <DwInput v-model="driftForm.name"/>
        </FormField>
        <FormField :label="t('platform.drift.sourceConnectionId')">
          <DwInput v-model="driftForm.sourceConnectionId"/>
        </FormField>
        <FormField :label="t('platform.drift.sourceDatabase')">
          <DwInput v-model="driftForm.sourceDatabase"/>
        </FormField>
        <FormField :label="t('platform.drift.targetConnectionId')">
          <DwInput v-model="driftForm.targetConnectionId"/>
        </FormField>
        <FormField :label="t('platform.drift.targetDatabase')">
          <DwInput v-model="driftForm.targetDatabase"/>
        </FormField>
        <FormField :label="t('platform.drift.tablePattern')">
          <DwInput v-model="driftForm.tablePattern"/>
        </FormField>
        <DwButton :disabled="saving" @click="saveDriftMonitor">{{ t('platform.common.save') }}</DwButton>
      </template>

      <template v-else>
        <FormField :label="t('platform.common.name')">
          <DwInput v-model="taskForm.name"/>
        </FormField>
        <FormField :label="t('platform.tasks.type')">
          <DwInput v-model="taskForm.type"/>
        </FormField>
        <FormField :label="t('platform.tasks.cronExpression')">
          <DwInput v-model="taskForm.cronExpression"/>
        </FormField>
        <FormField :label="t('platform.tasks.payloadJson')">
          <DwInput v-model="taskForm.payloadJson"/>
        </FormField>
        <DwButton :disabled="saving" @click="saveTask">{{ t('platform.common.save') }}</DwButton>
      </template>
    </section>
  </div>
</template>

<style scoped>
.platform-hub-settings {
  display: flex;
  flex-direction: column;
  gap: 16px;
  max-width: 920px;
}

.platform-tabs {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  align-items: center;
}

.platform-tab {
  border: 1px solid var(--dw-border-light);
  background: var(--dw-bg-panel);
  border-radius: 999px;
  padding: 6px 12px;
  font-size: 12px;
  cursor: pointer;
}

.platform-tab.is-active {
  border-color: var(--dw-accent);
  color: var(--dw-accent);
}

.platform-refresh {
  margin-left: auto;
}

.platform-status {
  margin: 0;
  font-size: 12px;
  color: var(--dw-text-muted);
}

.platform-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.platform-row {
  display: flex;
  justify-content: space-between;
  gap: 12px;
  padding: 10px 12px;
  border: 1px solid var(--dw-border-light);
  border-radius: 8px;
  background: var(--dw-bg-panel);
}

.platform-row__main {
  display: flex;
  flex-direction: column;
  gap: 4px;
  min-width: 0;
}

.platform-row__meta {
  font-size: 12px;
  color: var(--dw-text-muted);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.platform-row__actions {
  display: flex;
  flex-shrink: 0;
  gap: 6px;
}

.platform-form {
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding-top: 8px;
  border-top: 1px solid var(--dw-border-light);
}

.platform-form h3 {
  margin: 0;
  font-size: 14px;
}

.platform-form__actions {
  display: flex;
  gap: 8px;
}

.platform-auto-row {
  display: grid;
  grid-template-columns: 1fr 1fr auto;
  gap: 8px;
  align-items: end;
  margin-top: 8px;
  padding-top: 8px;
  border-top: 1px dashed var(--dw-border-light);
}
</style>
