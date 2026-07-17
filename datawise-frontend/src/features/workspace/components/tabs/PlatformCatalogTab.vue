<script setup lang="ts">
import {computed, onMounted, ref, watch} from 'vue'
import {useI18n} from 'vue-i18n'
import DwDataGrid from '@/core/components/DwDataGrid.vue'
import {ConfirmDialog} from '@/core/components'
import {DwIcon} from '@/core/icons'
import type {DwDataGridLabels} from '@/core/components/dw-data-grid.types'
import type {WorkspaceTab} from '@/core/types'
import {platformApi} from '@/api'
import {buildPlatformCatalogColumns} from '@/features/platform/services/platform-catalog.service'
import {
    autoGeneratePlatformSemanticMetrics,
    deletePlatformCatalogItems,
    platformCatalogRowLabel,
} from '@/features/platform/services/platform-catalog-mutations.service'
import AnalysisCanvasRerunDialog from '@/features/platform/components/AnalysisCanvasRerunDialog.vue'
import SchemaDriftReportDialog from '@/features/platform/components/SchemaDriftReportDialog.vue'
import type {SchemaDriftReport} from '@/features/platform/types/platform.types'
import {useLayoutStore} from '@/features/layout/stores/layout'
import FederatedViewWizardDialog from '@/features/platform/components/FederatedViewWizardDialog.vue'
import PlatformCatalogFormDialog from '@/features/workspace/components/PlatformCatalogFormDialog.vue'
import {usePlatformCatalog} from '@/features/workspace/composables/usePlatformCatalog'
import ReleaseHighlightsCards from '@/features/layout/components/ReleaseHighlightsCards.vue'
import {useWorkspaceStore} from '@/features/workspace/stores/workspace'
import type {ReleaseHighlightAction} from '@/features/layout/services/release-highlights.service'

const props = defineProps<{ tab: WorkspaceTab }>()
const {t} = useI18n()
const layout = useLayoutStore()
const workspace = useWorkspaceStore()

const {rows, loading, error, reload} = usePlatformCatalog(props.tab)
const selectedKeys = ref<string[]>([])
const formOpen = ref(false)
const federatedWizardOpen = ref(false)
const deleteConfirmOpen = ref(false)
const deleting = ref(false)
const autoGenerating = ref(false)
const runningAction = ref(false)
const canvasRerunOpen = ref(false)
const canvasRerunId = ref<string | null>(null)
const driftReportOpen = ref(false)
const driftReport = ref<SchemaDriftReport | null>(null)

const feature = computed(() => props.tab.platformFeature ?? 'semantic_metrics')
const isSemanticMetrics = computed(() => feature.value === 'semantic_metrics')
const isAnalysisCanvas = computed(() => feature.value === 'analysis_canvas')
const isSchemaDrift = computed(() => feature.value === 'schema_drift')
const isScheduledTasks = computed(() => feature.value === 'scheduled_tasks')
const isFederatedViews = computed(() => feature.value === 'federated_views')

const singleSelectedId = computed(() =>
    selectedKeys.value.length === 1 ? selectedKeys.value[0] : null,
)

const canRunAction = computed(() => Boolean(singleSelectedId.value) && !runningAction.value)

const canAutoGenerate = computed(() =>
    Boolean(props.tab.connectionId?.trim() && props.tab.database?.trim()),
)

const columns = computed(() => buildPlatformCatalogColumns(feature.value, t))

const gridLabels = computed<Partial<DwDataGridLabels>>(() => ({
  empty: t('workspace.platformCatalog.empty'),
  noMatch: t('workspace.platformCatalog.noMatch'),
  loading: t('workspace.tableDetail.loading'),
}))

const canDelete = computed(() => selectedKeys.value.length > 0)

const deleteConfirmMessage = computed(() => {
  const keys = selectedKeys.value
  if (keys.length === 1) {
    const row = rows.value.find((item) => item.id === keys[0])
    const name = row ? platformCatalogRowLabel(feature.value, row) : keys[0]
    return t('platform.common.confirmDelete', {name})
  }
  return t('workspace.platformCatalog.confirmDeleteBatch', {count: keys.length})
})

function openAdd() {
  if (isFederatedViews.value) {
    federatedWizardOpen.value = true
    return
  }
  formOpen.value = true
}

function consumeOpenCreateDraft() {
  if (!props.tab.platformOpenCreateForm && !props.tab.platformScheduleDraft) return
  if (feature.value !== 'scheduled_tasks') return
  formOpen.value = true
  props.tab.platformOpenCreateForm = false
}

onMounted(() => {
  consumeOpenCreateDraft()
})

watch(
  () => [props.tab.platformOpenCreateForm, props.tab.platformScheduleDraft] as const,
  () => {
    consumeOpenCreateDraft()
  },
)

function requestDelete() {
  if (!canDelete.value) return
  deleteConfirmOpen.value = true
}

async function confirmDelete() {
  if (!selectedKeys.value.length) return
  deleting.value = true
  try {
    await deletePlatformCatalogItems(feature.value, selectedKeys.value)
    layout.showSuccessToast(t('platform.common.deleted'))
    selectedKeys.value = []
    await reload()
  } catch (err) {
    layout.showErrorToast(err instanceof Error ? err.message : String(err))
  } finally {
    deleting.value = false
    deleteConfirmOpen.value = false
  }
}

async function onSaved() {
  layout.showSuccessToast(t('platform.common.saved'))
  props.tab.platformScheduleDraft = undefined
  props.tab.platformOpenCreateForm = false
  await reload()
}

async function autoGenerateMetrics() {
  const connectionId = props.tab.connectionId?.trim()
  const database = props.tab.database?.trim()
  if (!connectionId || !database || autoGenerating.value) return
  autoGenerating.value = true
  try {
    const count = await autoGeneratePlatformSemanticMetrics(connectionId, database)
    layout.showSuccessToast(t('platform.metrics.autoGenerateDone', {count}))
    await reload()
  } catch (err) {
    layout.showErrorToast(err instanceof Error ? err.message : String(err))
  } finally {
    autoGenerating.value = false
  }
}

function openCanvasRerun() {
  const id = singleSelectedId.value
  if (!id) return
  canvasRerunId.value = id
  canvasRerunOpen.value = true
}

async function runSchemaDriftMonitor() {
  const id = singleSelectedId.value
  if (!id || runningAction.value) return
  runningAction.value = true
  try {
    driftReport.value = await platformApi.runSchemaDriftMonitor(id)
    driftReportOpen.value = true
    layout.showSuccessToast(t('platform.common.runDone'))
    await reload()
  } catch (err) {
    layout.showErrorToast(err instanceof Error ? err.message : String(err))
  } finally {
    runningAction.value = false
  }
}

async function runScheduledTask() {
  const id = singleSelectedId.value
  if (!id || runningAction.value) return
  runningAction.value = true
  try {
    await platformApi.runScheduledTask(id)
    layout.showSuccessToast(t('platform.common.runDone'))
    await reload()
  } catch (err) {
    layout.showErrorToast(err instanceof Error ? err.message : String(err))
  } finally {
    runningAction.value = false
  }
}

async function executeFederatedView() {
  const id = singleSelectedId.value
  if (!id || runningAction.value) return
  runningAction.value = true
  try {
    const result = await platformApi.executeFederatedView({viewId: id, maxRows: 100})
    layout.showSuccessToast(t('platform.federated.executeDone', {rows: result.rowCount ?? 0}))
  } catch (err) {
    layout.showErrorToast(err instanceof Error ? err.message : String(err))
  } finally {
    runningAction.value = false
  }
}

function runReleaseAction(action: ReleaseHighlightAction) {
  if (action === 'open_federated_wizard') {
    federatedWizardOpen.value = true
    return
  }
  if (action === 'open_sql_console') {
    layout.setModule('database')
    workspace.openConsole()
    return
  }
  if (action === 'open_ai') {
    layout.setModule('ai')
  }
}
</script>

<template>
  <ReleaseHighlightsCards scope="platform" @action="runReleaseAction"/>

  <DwDataGrid
      v-model:selected-keys="selectedKeys"
      :rows="rows"
      :columns="columns"
      row-key="id"
      :loading="loading"
      :error="error"
      :labels="gridLabels"
      :show-search="false"
      :column-filter="false"
  >
    <template #toolbar-actions>
      <button type="button" :disabled="loading" @click="openAdd">
        <DwIcon name="plus" size="sm" :stroke-width="1.35"/>
        {{ t('workspace.platformCatalog.add') }}
      </button>
      <button type="button" :disabled="loading || deleting || !canDelete" @click="requestDelete">
        <DwIcon name="delete" size="sm" :stroke-width="1.35"/>
        {{ t('workspace.platformCatalog.delete') }}
      </button>
      <button
          v-if="isAnalysisCanvas"
          type="button"
          :disabled="loading || !canRunAction"
          @click="openCanvasRerun"
      >
        <DwIcon name="run" size="sm" :stroke-width="1.35"/>
        {{ t('platform.canvas.rerun') }}
      </button>
      <button
          v-if="isSchemaDrift"
          type="button"
          :disabled="loading || !canRunAction"
          @click="runSchemaDriftMonitor"
      >
        <DwIcon name="run" size="sm" :stroke-width="1.35"/>
        {{ t('platform.common.run') }}
      </button>
      <button
          v-if="isScheduledTasks"
          type="button"
          :disabled="loading || !canRunAction"
          @click="runScheduledTask"
      >
        <DwIcon name="run" size="sm" :stroke-width="1.35"/>
        {{ t('platform.common.run') }}
      </button>
      <button
          v-if="isFederatedViews"
          type="button"
          :disabled="loading || !canRunAction"
          @click="executeFederatedView"
      >
        <DwIcon name="run" size="sm" :stroke-width="1.35"/>
        {{ t('platform.federated.execute') }}
      </button>
      <button
          v-if="isSemanticMetrics"
          type="button"
          :disabled="loading || autoGenerating || !canAutoGenerate"
          @click="autoGenerateMetrics"
      >
        <DwIcon name="ai" size="sm" :stroke-width="1.35"/>
        {{ t('platform.metrics.autoGenerate') }}
      </button>
    </template>
  </DwDataGrid>

  <PlatformCatalogFormDialog
      v-if="!isFederatedViews"
      v-model:open="formOpen"
      :feature="feature"
      :tab="tab"
      @saved="onSaved"
  />

  <FederatedViewWizardDialog
      v-model:open="federatedWizardOpen"
      :tab="tab"
      @saved="onSaved"
  />

  <ConfirmDialog
      v-model:open="deleteConfirmOpen"
      :title="t('workspace.platformCatalog.delete')"
      :message="deleteConfirmMessage"
      :confirm-label="t('workspace.platformCatalog.delete')"
      :confirm-loading="deleting"
      @confirm="confirmDelete"
  />

  <AnalysisCanvasRerunDialog
      v-model:open="canvasRerunOpen"
      :canvas-id="canvasRerunId"
  />

  <SchemaDriftReportDialog
      v-model:open="driftReportOpen"
      :report="driftReport"
  />
</template>
