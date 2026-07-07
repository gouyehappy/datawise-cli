<script setup lang="ts">
import {computed, nextTick, reactive, ref, watch} from 'vue'
import {useI18n} from 'vue-i18n'
import {
    AppModal,
    CollapsibleSection,
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
import {platformApi} from '@/api'
import type {AnalysisCanvasSummary} from '@/features/platform/types/platform.types'
import {useExplorerStore} from '@/features/explorer/stores/explorer'
import {useNotificationStore} from '@/features/layout/stores/notification-store'

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
const saving = ref(false)
const error = ref('')
const firstFieldRef = ref<HTMLInputElement | HTMLTextAreaElement>()

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

const taskTypeOptions = computed<SelectOption[]>(() => [
    {value: 'sql', label: t('workspace.platformCatalog.form.taskType.sql')},
    {value: 'canvas', label: t('workspace.platformCatalog.form.taskType.canvas')},
    {value: 'schema_drift', label: t('workspace.platformCatalog.form.taskType.schema_drift')},
])

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
    taskForm.payloadJson = '{}'
    taskForm.enabled = true
    canvasOptions.value = []
    error.value = ''
}

watch(
    () => props.open,
    async (isOpen) => {
        if (!isOpen) return
        resetForms()
        if (props.feature === 'scheduled_tasks') {
            canvasOptionsLoading.value = true
            try {
                canvasOptions.value = await platformApi.listAnalysisCanvas()
            } catch {
                canvasOptions.value = []
            } finally {
                canvasOptionsLoading.value = false
            }
        }
        await nextTick()
        firstFieldRef.value?.focus()
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
            const payloadJson =
                taskForm.type === 'canvas'
                    ? JSON.stringify({canvasId: taskForm.canvasId.trim()})
                    : taskForm.payloadJson.trim() || undefined
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

      <p v-if="error" class="modal-error-text" role="alert">{{ error }}</p>
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
  font-family: var(--dw-font-mono, ui-monospace, monospace);
  font-size: 12px;
}

.modal-fieldset:last-of-type {
  margin-bottom: 0;
}
</style>
