<script setup lang="ts">
import {computed, nextTick, reactive, ref, watch} from 'vue'
import {useI18n} from 'vue-i18n'
import {
    AppModal,
    CollapsibleSection,
    DwInlineAlert,
    FormField,
    ModalActions,
    SettingsSwitch,
} from '@/core/components'
import DwSelect from '@/core/components/DwSelect.vue'
import type {SelectOption} from '@/core/components/select.types'
import type {PlatformFeatureId} from '@/features/platform/types/platform.types'
import type {WorkspaceTab} from '@/core/types'
import {
    savePlatformCatalogItem,
    type PlatformCatalogFormPayload,
} from '@/features/platform/services/platform-catalog-mutations.service'
import {instanceSqlApi, platformApi} from '@/api'
import type {AnalysisCanvasSummary} from '@/features/platform/types/platform.types'
import {useExplorerStore} from '@/features/explorer/stores/explorer'
import {useNotificationStore} from '@/features/layout/stores/notification-store'
import {useTeamStore} from '@/features/team/stores/team-store'
import {
    buildScheduledSqlPayloadJson,
    type ScheduledSqlSource,
} from '@/features/platform/services/scheduled-sql-payload.service'

const props = defineProps<{
    open: boolean
    feature: PlatformFeatureId
    tab: WorkspaceTab
}>()

const emit = defineEmits<{
    'update:open': [value: boolean]
    saved: []
}>()

const {t} = useI18n()
const explorer = useExplorerStore()
const notifications = useNotificationStore()
const teamStore = useTeamStore()
const saving = ref(false)
const error = ref('')
const firstFieldRef = ref<HTMLInputElement | HTMLTextAreaElement>()
const sqlFileOptionsLoading = ref(false)
const sqlFileOptions = ref<SelectOption[]>([])
const sharedQueryOptionsLoading = ref(false)
const sharedQueryOptions = ref<SelectOption[]>([])

const semanticForm = reactive({
    id: '',
    name: '',
    expression: '',
    description: '',
    unit: '',
    upstreamMetrics: '',
    changeNote: '',
})
const canvasForm = reactive({title: '', description: '', promptTemplate: '', sql: ''})
const driftForm = reactive({
    name: '',
    targetConnectionId: '',
    targetDatabase: '',
    tablePattern: '%',
    enabled: true,
})
const taskForm = reactive({
    name: '',
    type: 'sql',
    cronExpression: '0 0 * * *',
    canvasId: '',
    sqlSource: 'inline' as ScheduledSqlSource,
    sql: '',
    sqlFile: '',
    teamId: '',
    queryId: '',
    payloadJson: '{}',
    enabled: true,
})
const canvasOptions = ref<AnalysisCanvasSummary[]>([])
const canvasOptionsLoading = ref(false)

const dialogTitle = computed(() => {
    switch (props.feature) {
        case 'semantic_metrics':
            return t('platform.metrics.formTitle')
        case 'analysis_canvas':
            return t('platform.canvas.formTitle')
        case 'schema_drift':
            return t('platform.drift.formTitle')
        case 'scheduled_tasks':
            return t('platform.tasks.formTitle')
        default:
            return t('workspace.platformCatalog.add')
    }
})

const dialogSubtitle = computed(() =>
    t(`workspace.platformCatalog.form.subtitle.${props.feature}`),
)

const dialogWidth = computed(() =>
    props.feature === 'analysis_canvas' ? '600px' : '560px',
)

const showScopeBanner = computed(() =>
    props.feature === 'semantic_metrics' || props.feature === 'schema_drift',
)

const scopeConnectionLabel = computed(() => {
    const connectionId = props.tab.connectionId
    if (!connectionId) return '—'
    return explorer.findNode(connectionId)?.label ?? connectionId
})

const scopeDatabase = computed(() => props.tab.database?.trim() || '—')

const taskCanvasSelectOptions = computed<SelectOption[]>(() =>
    canvasOptions.value.map((item) => ({
        value: item.id,
        label: item.title || item.id,
    })),
)

const showTaskPayloadEditor = computed(() =>
    props.feature === 'scheduled_tasks' && taskForm.type !== 'canvas',
)

const showSqlSourceFields = computed(() =>
    props.feature === 'scheduled_tasks' && taskForm.type === 'sql',
)

const taskTypeOptions = computed<SelectOption[]>(() => [
    {value: 'sql', label: t('workspace.platformCatalog.form.taskType.sql')},
    {value: 'canvas', label: t('workspace.platformCatalog.form.taskType.canvas')},
    {value: 'schema_drift', label: t('workspace.platformCatalog.form.taskType.schema_drift')},
])

const sqlSourceOptions = computed<SelectOption[]>(() => [
    {value: 'inline', label: t('workspace.platformCatalog.form.sqlSource.inline')},
    {value: 'workspace_file', label: t('workspace.platformCatalog.form.sqlSource.workspace_file')},
    {value: 'query_library', label: t('workspace.platformCatalog.form.sqlSource.query_library')},
])

const teamSelectOptions = computed<SelectOption[]>(() =>
    teamStore.teams.map((team) => ({
        value: team.id,
        label: team.name || team.id,
    })),
)

const selectedSharedQueryHint = computed(() => {
    const query = sharedQueryOptions.value.find((item) => item.value === taskForm.queryId)
    return query?.label ?? ''
})

async function ensureTeamsLoaded() {
    if (!teamStore.ready || !teamStore.teams.length) {
        try {
            await teamStore.load()
        } catch {
            // leave empty; UI shows empty hint
        }
    }
}

async function loadSqlFileOptions() {
    const connectionId = props.tab.connectionId?.trim()
    const database = props.tab.database?.trim()
    sqlFileOptions.value = []
    if (!connectionId || !database) return
    sqlFileOptionsLoading.value = true
    try {
        const files = await instanceSqlApi.listScripts({
            connectionId,
            instanceName: database,
        })
        sqlFileOptions.value = files.map((file) => ({
            value: file.fileName,
            label: file.fileName,
        }))
        if (taskForm.sqlFile && !sqlFileOptions.value.some((item) => item.value === taskForm.sqlFile)) {
            sqlFileOptions.value = [
                {value: taskForm.sqlFile, label: taskForm.sqlFile},
                ...sqlFileOptions.value,
            ]
        }
    } catch {
        sqlFileOptions.value = taskForm.sqlFile
            ? [{value: taskForm.sqlFile, label: taskForm.sqlFile}]
            : []
    } finally {
        sqlFileOptionsLoading.value = false
    }
}

async function loadSharedQueryOptions(teamId: string) {
    sharedQueryOptions.value = []
    const id = teamId.trim()
    if (!id) return
    sharedQueryOptionsLoading.value = true
    try {
        const list = await teamStore.fetchSharedQueries(id)
        sharedQueryOptions.value = list.map((item) => ({
            value: item.id,
            label: item.title?.trim() || item.id,
        }))
        if (taskForm.queryId && !sharedQueryOptions.value.some((item) => item.value === taskForm.queryId)) {
            sharedQueryOptions.value = [
                {value: taskForm.queryId, label: taskForm.queryId},
                ...sharedQueryOptions.value,
            ]
        }
    } catch {
        sharedQueryOptions.value = taskForm.queryId
            ? [{value: taskForm.queryId, label: taskForm.queryId}]
            : []
    } finally {
        sharedQueryOptionsLoading.value = false
    }
}

async function refreshSqlSourceOptions() {
    if (taskForm.sqlSource === 'workspace_file') {
        await loadSqlFileOptions()
        return
    }
    if (taskForm.sqlSource === 'query_library') {
        await ensureTeamsLoaded()
        if (!taskForm.teamId && teamStore.teams[0]?.id) {
            taskForm.teamId = teamStore.teams[0].id
        }
        await loadSharedQueryOptions(taskForm.teamId)
    }
}

const canSave = computed(() => {
    switch (props.feature) {
        case 'semantic_metrics':
            return Boolean(semanticForm.name.trim())
        case 'analysis_canvas':
            return Boolean(canvasForm.title.trim())
        case 'schema_drift':
            return Boolean(
                driftForm.name.trim()
                && driftForm.targetConnectionId.trim()
                && driftForm.targetDatabase.trim()
                && props.tab.connectionId
                && props.tab.database,
            )
        case 'scheduled_tasks':
            if (!taskForm.name.trim() || !taskForm.type.trim()) return false
            if (taskForm.type === 'canvas') return Boolean(taskForm.canvasId.trim())
            if (taskForm.type === 'sql') {
                if (taskForm.sqlSource === 'workspace_file') return Boolean(taskForm.sqlFile.trim())
                if (taskForm.sqlSource === 'query_library') {
                    return Boolean(taskForm.teamId.trim() && taskForm.queryId.trim())
                }
                return Boolean(taskForm.sql.trim() || taskForm.payloadJson.trim())
            }
            return true
        default:
            return false
    }
})

function resetForms() {
    semanticForm.id = ''
    semanticForm.name = ''
    semanticForm.expression = ''
    semanticForm.description = ''
    semanticForm.unit = ''
    semanticForm.upstreamMetrics = ''
    semanticForm.changeNote = ''
    canvasForm.title = ''
    canvasForm.description = ''
    canvasForm.promptTemplate = ''
    canvasForm.sql = ''
    driftForm.name = ''
    driftForm.targetConnectionId = ''
    driftForm.targetDatabase = ''
    driftForm.tablePattern = '%'
    driftForm.enabled = true
    taskForm.name = ''
    taskForm.type = 'sql'
    taskForm.cronExpression = '0 0 * * *'
    taskForm.canvasId = ''
    taskForm.sqlSource = 'inline'
    taskForm.sql = ''
    taskForm.sqlFile = ''
    taskForm.teamId = ''
    taskForm.queryId = ''
    taskForm.payloadJson = '{}'
    taskForm.enabled = true
    canvasOptions.value = []
    sqlFileOptions.value = []
    sharedQueryOptions.value = []
    error.value = ''
}

function applyScheduleDraft() {
    const draft = props.tab.platformScheduleDraft
    if (!draft || props.feature !== 'scheduled_tasks') return
    if (draft.name?.trim()) taskForm.name = draft.name.trim()
    if (draft.cronExpression?.trim()) taskForm.cronExpression = draft.cronExpression.trim()
    if (draft.enabled != null) taskForm.enabled = draft.enabled
    taskForm.type = 'sql'
    taskForm.sqlSource = draft.source ?? 'workspace_file'
    if (draft.sql?.trim()) taskForm.sql = draft.sql.trim()
    if (draft.sqlFile?.trim()) taskForm.sqlFile = draft.sqlFile.trim()
    if (draft.teamId?.trim()) taskForm.teamId = draft.teamId.trim()
    if (draft.queryId?.trim()) taskForm.queryId = draft.queryId.trim()
    try {
        taskForm.payloadJson = buildScheduledSqlPayloadJson({
            source: taskForm.sqlSource,
            connectionId: props.tab.connectionId ?? '',
            database: props.tab.database ?? '',
            sql: taskForm.sql,
            sqlFile: taskForm.sqlFile,
            teamId: taskForm.teamId,
            queryId: taskForm.queryId,
        })
    } catch {
        // keep defaults until user fills required fields
    }
}

watch(
    () => props.open,
    async (isOpen) => {
        if (!isOpen) return
        resetForms()
        if (props.feature === 'scheduled_tasks') {
            applyScheduleDraft()
            canvasOptionsLoading.value = true
            try {
                canvasOptions.value = await platformApi.listAnalysisCanvas()
            } catch {
                canvasOptions.value = []
            } finally {
                canvasOptionsLoading.value = false
            }
            await refreshSqlSourceOptions()
        }
        await nextTick()
        firstFieldRef.value?.focus()
    },
)

watch(
    () => taskForm.sqlSource,
    async (source, previous) => {
        if (!props.open || props.feature !== 'scheduled_tasks') return
        if (source === previous) return
        error.value = ''
        await refreshSqlSourceOptions()
    },
)

watch(
    () => taskForm.teamId,
    async (teamId, previous) => {
        if (!props.open || props.feature !== 'scheduled_tasks') return
        if (taskForm.sqlSource !== 'query_library') return
        if (teamId === previous) return
        if (previous) taskForm.queryId = ''
        await loadSharedQueryOptions(teamId)
    },
)

function close() {
    emit('update:open', false)
}

function buildPayload(): PlatformCatalogFormPayload | null {
    switch (props.feature) {
        case 'semantic_metrics':
            return {...semanticForm, feature: 'semantic_metrics'}
        case 'analysis_canvas':
            return {...canvasForm, feature: 'analysis_canvas'}
        case 'schema_drift':
            return {...driftForm, feature: 'schema_drift'}
        case 'scheduled_tasks': {
            let payloadJson = taskForm.payloadJson.trim() || undefined
            if (taskForm.type === 'canvas') {
                payloadJson = JSON.stringify({canvasId: taskForm.canvasId.trim()})
            } else if (taskForm.type === 'sql') {
                try {
                    payloadJson = buildScheduledSqlPayloadJson({
                        source: taskForm.sqlSource,
                        connectionId: props.tab.connectionId ?? '',
                        database: props.tab.database ?? '',
                        sql: taskForm.sql,
                        sqlFile: taskForm.sqlFile,
                        teamId: taskForm.teamId,
                        queryId: taskForm.queryId,
                    })
                } catch (e) {
                    error.value = e instanceof Error
                        ? e.message
                        : t('workspace.platformCatalog.form.validation.required')
                    return null
                }
            }
            return {
                ...taskForm,
                feature: 'scheduled_tasks',
                payloadJson: payloadJson ?? '{}',
            }
        }
        default:
            return null
    }
}

async function submit() {
    if (!canSave.value) {
        error.value = t('workspace.platformCatalog.form.validation.required')
        return
    }
    const payload = buildPayload()
    if (!payload) return
    saving.value = true
    error.value = ''
    try {
        const result = await savePlatformCatalogItem(payload, {
            connectionId: props.tab.connectionId,
            database: props.tab.database,
        })
        if (payload.feature === 'semantic_metrics' && result.definitionChanged && result.metricName) {
            await notifications.push({
                category: 'workspace',
                titleKey: 'metricDefinitionChanged',
                bodyKey: 'metricDefinitionChanged',
                params: {name: result.metricName},
            })
        }
        emit('saved')
        close()
    } catch (err) {
        error.value = err instanceof Error ? err.message : String(err)
    } finally {
        saving.value = false
    }
}
</script>

<template>
  <AppModal
      :open="open"
      :title="dialogTitle"
      :subtitle="dialogSubtitle"
      :width="dialogWidth"
      @close="close"
  >
    <div v-if="showScopeBanner" class="modal-summary-box">
      <div class="modal-summary-row">
        <span class="modal-summary-row__label">{{ t('workspace.platformCatalog.form.scope.connection') }}</span>
        <span class="modal-summary-row__value">{{ scopeConnectionLabel }}</span>
      </div>
      <div class="modal-summary-row">
        <span class="modal-summary-row__label">
          {{ feature === 'schema_drift'
              ? t('workspace.platformCatalog.form.scope.source')
              : t('workspace.platformCatalog.form.scope.database') }}
        </span>
        <span class="modal-summary-row__value">{{ scopeDatabase }}</span>
      </div>
    </div>

    <form class="modal-form" @submit.prevent="submit">
      <template v-if="feature === 'semantic_metrics'">
        <fieldset class="modal-fieldset">
          <legend>{{ t('workspace.platformCatalog.form.section.basic') }}</legend>
          <div class="modal-form-grid">
            <FormField :label="t('platform.common.name')">
              <template #default="{ id }">
                <input
                    :id="id"
                    ref="firstFieldRef"
                    v-model="semanticForm.name"
                    class="dw-input"
                    type="text"
                    :placeholder="t('workspace.platformCatalog.form.placeholder.name')"
                >
              </template>
            </FormField>
            <FormField :label="t('platform.metrics.unit')">
              <template #default="{ id }">
                <input :id="id" v-model="semanticForm.unit" class="dw-input" type="text">
              </template>
            </FormField>
          </div>
        </fieldset>

        <fieldset class="modal-fieldset">
          <legend>{{ t('workspace.platformCatalog.form.section.definition') }}</legend>
          <FormField :label="t('platform.metrics.expression')">
            <template #default="{ id }">
              <textarea
                  :id="id"
                  v-model="semanticForm.expression"
                  class="modal-textarea modal-textarea--mono"
                  rows="3"
                  spellcheck="false"
                  :placeholder="t('workspace.platformCatalog.form.hint.expression')"
              />
            </template>
          </FormField>
          <FormField :label="t('platform.metrics.upstreamMetrics')">
            <template #default="{ id }">
              <input
                  :id="id"
                  v-model="semanticForm.upstreamMetrics"
                  class="dw-input"
                  type="text"
                  :placeholder="t('workspace.platformCatalog.form.hint.upstreamMetrics')"
              >
            </template>
          </FormField>
          <FormField :label="t('platform.metrics.changeNote')">
            <template #default="{ id }">
              <input
                  :id="id"
                  v-model="semanticForm.changeNote"
                  class="dw-input"
                  type="text"
                  :placeholder="t('workspace.platformCatalog.form.hint.changeNote')"
              >
            </template>
          </FormField>
          <FormField :label="t('platform.common.description')">
            <template #default="{ id }">
              <textarea
                  :id="id"
                  v-model="semanticForm.description"
                  class="modal-textarea"
                  rows="2"
                  :placeholder="t('workspace.platformCatalog.form.placeholder.description')"
              />
            </template>
          </FormField>
        </fieldset>
      </template>

      <template v-else-if="feature === 'analysis_canvas'">
        <fieldset class="modal-fieldset">
          <legend>{{ t('workspace.platformCatalog.form.section.basic') }}</legend>
          <FormField :label="t('platform.common.title')">
            <template #default="{ id }">
              <input
                  :id="id"
                  ref="firstFieldRef"
                  v-model="canvasForm.title"
                  class="dw-input"
                  type="text"
                  :placeholder="t('workspace.platformCatalog.form.placeholder.title')"
              >
            </template>
          </FormField>
          <FormField :label="t('platform.common.description')">
            <template #default="{ id }">
              <textarea
                  :id="id"
                  v-model="canvasForm.description"
                  class="modal-textarea"
                  rows="2"
                  :placeholder="t('workspace.platformCatalog.form.placeholder.description')"
              />
            </template>
          </FormField>
        </fieldset>

        <fieldset class="modal-fieldset">
          <legend>{{ t('workspace.platformCatalog.form.section.definition') }}</legend>
          <FormField :label="t('platform.canvas.promptTemplate')">
            <template #default="{ id }">
              <textarea
                  :id="id"
                  v-model="canvasForm.promptTemplate"
                  class="modal-textarea"
                  rows="3"
                  :placeholder="t('workspace.platformCatalog.form.hint.promptTemplate')"
              />
            </template>
          </FormField>
          <FormField :label="t('platform.common.sql')">
            <template #default="{ id }">
              <textarea
                  :id="id"
                  v-model="canvasForm.sql"
                  class="modal-textarea modal-textarea--mono"
                  rows="7"
                  spellcheck="false"
              />
            </template>
          </FormField>
        </fieldset>
      </template>

      <template v-else-if="feature === 'schema_drift'">
        <fieldset class="modal-fieldset">
          <legend>{{ t('workspace.platformCatalog.form.section.basic') }}</legend>
          <div class="modal-form-grid">
            <FormField :label="t('platform.common.name')">
              <template #default="{ id }">
                <input
                    :id="id"
                    ref="firstFieldRef"
                    v-model="driftForm.name"
                    class="dw-input"
                    type="text"
                    :placeholder="t('workspace.platformCatalog.form.placeholder.name')"
                >
              </template>
            </FormField>
            <FormField :label="t('platform.drift.tablePattern')">
              <template #default="{ id }">
                <input
                    :id="id"
                    v-model="driftForm.tablePattern"
                    class="dw-input"
                    type="text"
                    spellcheck="false"
                >
              </template>
            </FormField>
          </div>
          <p class="modal-hint">{{ t('workspace.platformCatalog.form.hint.tablePattern') }}</p>
        </fieldset>

        <fieldset class="modal-fieldset">
          <legend>{{ t('workspace.platformCatalog.form.section.target') }}</legend>
          <div class="modal-form-grid">
            <FormField :label="t('platform.drift.targetConnectionId')">
              <template #default="{ id }">
                <input :id="id" v-model="driftForm.targetConnectionId" class="dw-input" type="text">
              </template>
            </FormField>
            <FormField :label="t('platform.drift.targetDatabase')">
              <template #default="{ id }">
                <input :id="id" v-model="driftForm.targetDatabase" class="dw-input" type="text">
              </template>
            </FormField>
          </div>
        </fieldset>

        <SettingsSwitch v-model="driftForm.enabled" :label="t('platform.common.enabled')"/>
      </template>

      <template v-else-if="feature === 'scheduled_tasks'">
        <fieldset class="modal-fieldset">
          <legend>{{ t('workspace.platformCatalog.form.section.basic') }}</legend>
          <FormField :label="t('platform.common.name')">
            <template #default="{ id }">
              <input
                  :id="id"
                  ref="firstFieldRef"
                  v-model="taskForm.name"
                  class="dw-input"
                  type="text"
                  :placeholder="t('workspace.platformCatalog.form.placeholder.name')"
              >
            </template>
          </FormField>
        </fieldset>

        <fieldset class="modal-fieldset">
          <legend>{{ t('workspace.platformCatalog.form.section.schedule') }}</legend>
          <div class="modal-form-grid">
            <label class="modal-field">
              <span>{{ t('platform.tasks.type') }}</span>
              <DwSelect v-model="taskForm.type" size="sm" :options="taskTypeOptions"/>
            </label>
            <FormField :label="t('platform.tasks.cronExpression')">
              <template #default="{ id }">
                <input
                    :id="id"
                    v-model="taskForm.cronExpression"
                    class="dw-input modal-input--mono"
                    type="text"
                    spellcheck="false"
                    :placeholder="t('workspace.platformCatalog.form.hint.cron')"
                >
              </template>
            </FormField>
          </div>
          <p class="modal-hint">{{ t('workspace.platformCatalog.form.hint.cron') }}</p>
        </fieldset>

        <SettingsSwitch v-model="taskForm.enabled" :label="t('platform.common.enabled')"/>

        <fieldset v-if="taskForm.type === 'canvas'" class="modal-fieldset">
          <legend>{{ t('workspace.platformCatalog.form.section.target') }}</legend>
          <label class="modal-field">
            <span>{{ t('platform.tasks.canvasId') }}</span>
            <DwSelect
                v-model="taskForm.canvasId"
                size="sm"
                :options="taskCanvasSelectOptions"
                :disabled="canvasOptionsLoading || !taskCanvasSelectOptions.length"
            />
          </label>
          <p class="modal-hint">{{ t('platform.tasks.canvasHint') }}</p>
          <p v-if="!canvasOptionsLoading && !taskCanvasSelectOptions.length" class="modal-hint">
            {{ t('platform.canvas.empty') }}
          </p>
        </fieldset>

        <fieldset v-if="showSqlSourceFields" class="modal-fieldset">
          <legend>{{ t('workspace.platformCatalog.form.section.sqlSource') }}</legend>
          <label class="modal-field">
            <span>{{ t('workspace.platformCatalog.form.sqlSourceLabel') }}</span>
            <DwSelect v-model="taskForm.sqlSource" size="sm" :options="sqlSourceOptions"/>
          </label>
          <p class="modal-hint">{{ t('workspace.platformCatalog.form.hint.sqlSource') }}</p>
          <p class="modal-hint">{{ t('workspace.platformCatalog.form.hint.productionApproval') }}</p>

          <FormField
              v-if="taskForm.sqlSource === 'inline'"
              :label="t('workspace.platformCatalog.form.sqlLabel')"
          >
            <template #default="{ id }">
              <textarea
                  :id="id"
                  v-model="taskForm.sql"
                  class="modal-textarea modal-textarea--mono"
                  rows="5"
                  spellcheck="false"
                  :placeholder="t('workspace.platformCatalog.form.hint.sqlInline')"
              />
            </template>
          </FormField>

          <FormField
              v-else-if="taskForm.sqlSource === 'workspace_file'"
              :label="t('workspace.platformCatalog.form.sqlFileLabel')"
          >
            <DwSelect
                v-model="taskForm.sqlFile"
                size="sm"
                :options="sqlFileOptions"
                :disabled="sqlFileOptionsLoading || !sqlFileOptions.length"
            />
            <p class="modal-hint">
              {{ sqlFileOptionsLoading
                ? t('workspace.platformCatalog.form.hint.sqlFileLoading')
                : sqlFileOptions.length
                  ? t('workspace.platformCatalog.form.hint.sqlFile')
                  : t('workspace.platformCatalog.form.hint.sqlFileEmpty') }}
            </p>
          </FormField>

          <template v-else>
            <div class="modal-form-grid">
              <FormField :label="t('workspace.platformCatalog.form.teamLabel')">
                <DwSelect
                    v-model="taskForm.teamId"
                    size="sm"
                    :options="teamSelectOptions"
                    :disabled="!teamSelectOptions.length"
                />
              </FormField>
              <FormField :label="t('workspace.platformCatalog.form.queryLabel')">
                <DwSelect
                    v-model="taskForm.queryId"
                    size="sm"
                    :options="sharedQueryOptions"
                    :disabled="sharedQueryOptionsLoading || !sharedQueryOptions.length"
                />
              </FormField>
            </div>
            <p class="modal-hint">
              {{ sharedQueryOptionsLoading
                ? t('workspace.platformCatalog.form.hint.queryLibraryLoading')
                : !teamSelectOptions.length
                  ? t('workspace.platformCatalog.form.hint.queryLibraryNoTeams')
                  : !sharedQueryOptions.length
                    ? t('workspace.platformCatalog.form.hint.queryLibraryEmpty')
                    : selectedSharedQueryHint
                      ? t('workspace.platformCatalog.form.hint.queryLibrarySelected', {
                        title: selectedSharedQueryHint,
                      })
                      : t('workspace.platformCatalog.form.hint.queryLibrary') }}
            </p>
          </template>
        </fieldset>

        <CollapsibleSection
            v-if="showTaskPayloadEditor"
            :title="t('workspace.platformCatalog.form.section.advanced')"
            :description="t('platform.tasks.payloadJson')"
            joined="single"
        >
          <FormField :label="t('platform.tasks.payloadJson')">
            <template #default="{ id }">
              <textarea
                  :id="id"
                  v-model="taskForm.payloadJson"
                  class="modal-textarea modal-textarea--mono"
                  rows="4"
                  spellcheck="false"
                  :placeholder="t('workspace.platformCatalog.form.hint.payloadJson')"
              />
            </template>
          </FormField>
        </CollapsibleSection>
      </template>

      <DwInlineAlert :message="error"/>
    </form>

    <template #footer>
      <ModalActions
          :confirm-label="t('platform.common.save')"
          :confirm-disabled="!canSave"
          :confirm-loading="saving"
          @cancel="close"
          @confirm="submit"
      />
    </template>
  </AppModal>
</template>

<style scoped>
.modal-textarea--mono,
.modal-input--mono {
  font-family: var(--dw-font-mono);
  font-size: var(--dw-text-sm);
}

.modal-fieldset:last-of-type {
  margin-bottom: 0;
}
</style>
