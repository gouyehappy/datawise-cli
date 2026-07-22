<script setup lang="ts">
import {computed, nextTick, onMounted, ref, watch} from 'vue'
import {storeToRefs} from 'pinia'
import {useI18n} from 'vue-i18n'
import {SqlEditor} from '@datawise/sql-editor'
import type {SqlEditorExpose} from '@datawise/sql-editor'
import {ensureSqlEditorPlugin} from '@/features/workspace/services/ensure-sql-editor-plugin'
import {
    AiPromptBar,
    ConsoleCtxBar,
    QueryResultPane,
} from '@/features/workspace/components'
import IconButton from '@/core/components/IconButton.vue'
import ConsoleToolbarIcon from '@/core/components/ConsoleToolbarIcon.vue'
import EditorFullscreenButton from '@/core/components/EditorFullscreenButton.vue'
import SplitHandle from '@/core/components/SplitHandle.vue'
import {DwButton, DwInlineAlert} from '@/core/components'
import type {WorkspaceTab} from '@/core/types'
import {shortcutTooltip} from '@/features/layout/composables/useAppShortcutListener'
import {useViewModelEditor} from '@/features/workspace/composables/useViewModelEditor'
import {useViewModelLineagePreview} from '@/features/workspace/composables/useViewModelLineagePreview'
import {useExplorerSqlSchemaProvider} from '@/features/workspace/adapters/explorer-sql-schema-provider'
import {useExplorerStore} from '@/features/explorer/stores/explorer'
import {useLayoutStore} from '@/features/layout/stores/layout'
import {useWorkspaceStore} from '@/features/workspace/stores/workspace'
import {useResourceWriteGuard} from '@/features/auth/composables/useResourceWriteGuard'
import {useFeaturePermission} from '@/features/auth/composables/useFeaturePermission'
import {FeaturePermission} from '@/features/auth/types/feature-permission.types'
import {UserResource} from '@/features/auth/types/user-resource.types'
import {usePluginStore} from '@/features/plugin/stores/plugin-store'
import {useAppConfigStore} from '@/features/layout/stores/app-config-store'
import {useEditorFullscreen} from '@/features/workspace/composables/useEditorFullscreen'
import {useAiPromptPanel} from '@/features/workspace/composables/useAiPromptPanel'
import {useWorkspaceSqlShortcutHandlers} from '@/features/workspace/composables/useWorkspaceSqlShortcutHandlers'
import {appendConsoleAiSql} from '@/features/workspace/services/console-ai-sql.service'
import {resolveExecutableSql} from '@/features/workspace/services/resolve-executable-sql'
import {canPreviewViewModelSql} from '@/features/explorer/services/view-model-save.service'
import {
    buildExplorerScopedLabelResolver,
    resolveConsoleInstanceLabel,
} from '@/features/workspace/services/resolve-console-instance'
import {
    extractDataSources,
    filterSelectableDataSources,
    findDataSource,
    includePinnedDataSource,
} from '@/features/explorer/utils/data-sources'
import ViewModelLineagePreviewPanel from '@/features/workspace/components/tabs/ViewModelLineagePreviewPanel.vue'
import {
    CONSOLE_EDITOR_HEIGHT_MAX,
    CONSOLE_EDITOR_HEIGHT_MIN,
    CONSOLE_EDITOR_HEIGHT_RATIO,
    CONSOLE_RESULT_MIN_HEIGHT,
} from '@/features/workspace/constants/defaults'

const props = defineProps<{ tab: WorkspaceTab }>()
const {t} = useI18n()
const explorer = useExplorerStore()
const layout = useLayoutStore()
const workspace = useWorkspaceStore()
const appConfig = useAppConfigStore()
const pluginStore = usePluginStore()
const schemaProvider = useExplorerSqlSchemaProvider()
const {readOnly: guestReadOnly, hint: guestReadOnlyHint} = useResourceWriteGuard(UserResource.WorkspaceScripts)
const {can} = useFeaturePermission()
const {connectionHealthById} = storeToRefs(explorer)

const editorRef = ref<SqlEditorExpose>()
const editorReady = ref(false)
const splitRef = ref<HTMLElement>()
const aiSelectionSql = ref('')
const showPreview = ref(false)
const showLineagePreview = ref(false)
const editorHeight = ref(280)
const {isFullscreen: isEditorFullscreen, toggle: toggleEditorFullscreen, exit: exitEditorFullscreen} = useEditorFullscreen()

const connectionId = ref(props.tab.connectionId ?? '')
const instanceId = ref<string | null>(props.tab.instanceId ?? null)

const dataSources = computed(() => {
    const all = extractDataSources(explorer.tree)
    const selectable = filterSelectableDataSources(all, connectionHealthById.value)
    const pinned = props.tab.connectionId ?? connectionId.value
    return includePinnedDataSource(all, selectable, connectionHealthById.value, pinned)
})

const source = computed(() =>
    connectionId.value ? findDataSource(dataSources.value, connectionId.value) : undefined,
)

const activeInstance = computed(() =>
    source.value?.instances.find((item) => item.id === instanceId.value) ?? null,
)

const databaseName = computed(() =>
    resolveConsoleInstanceLabel({
        activeInstanceLabel: activeInstance.value?.label,
        instanceId: instanceId.value,
        tabInstanceId: props.tab.instanceId,
        tabDatabase: props.tab.database,
        findNodeLabel: (nodeId) => explorer.findNode(nodeId)?.label,
        resolveScopedLabel: buildExplorerScopedLabelResolver(explorer.tree, (nodeId) => explorer.findNode(nodeId)),
    }),
)

const dbDialect = computed(() => source.value?.dbType ?? explorer.findNode(props.tab.connectionId ?? '')?.dbType)

const connectionLabel = computed(() =>
    source.value?.label ?? explorer.findNode(props.tab.connectionId ?? '')?.label ?? t('common.unnamedConnection'),
)

const viewModelTitle = computed(() => props.tab.viewModelName ?? props.tab.title)

const {
    sql,
    previewColumns,
    previewRows,
    previewLoading,
    previewError,
    saving,
    draftSaving,
    saveError,
    scopeReady,
    canPreview,
    isDirty,
    statusLabelKey,
    preview,
    save,
    saveDraft,
    syncFromTab,
} = useViewModelEditor(props.tab, {
    getInstanceName: () => databaseName.value,
    resolvePreviewSql: () => resolvePreviewSql(),
})

const {
    graph: lineageGraph,
    loading: lineageLoading,
    error: lineageError,
    refresh: refreshLineagePreview,
} = useViewModelLineagePreview(sql, {
    connectionId: computed(() => connectionId.value || props.tab.connectionId || ''),
    instanceName: computed(() => databaseName.value || null),
    modelName: computed(() => viewModelTitle.value),
    dbType: computed(() => dbDialect.value),
    enabled: showLineagePreview,
})

const sqlFormatEnabled = computed(() => pluginStore.isEnabled('p-sql-format'))
const consoleAiEnabled = computed(() => pluginStore.isEnabled('p-console-ai'))

function resolvePreviewSql(): string {
    return resolveExecutableSql(undefined, () => editorRef.value?.getSelectedText() ?? '', {
        fallbackToCurrentLineSql: () => editorRef.value?.getCurrentLineSql() ?? '',
        getCurrentLineNumber: () => editorRef.value?.getCurrentLineNumber() ?? null,
        fallbackToFullDocument: () => sql.value,
        getSelectionStartLine: () => editorRef.value?.getSelectionStartLine() ?? null,
    }).sql
}

function mapPreviewError(code: string | null): string {
    if (!code) return ''
    if (code === 'single_select_required') return t('viewModel.selectOnly')
    if (code === 'missing_scope') return t('viewModel.previewScopeMissing')
    return code
}

function mapSaveError(code: string | null): string {
    if (!code) return ''
    if (code === 'sql_required') return t('viewModel.sqlRequired')
    if (code === 'single_select_required') return t('viewModel.singleSelectRequired')
    if (code === 'missing_scope') return t('viewModel.scopeMissing')
    if (/select query/i.test(code)) return t('viewModel.selectOnly')
    return code
}

const previewErrorMessage = computed(() => mapPreviewError(previewError.value))
const saveErrorMessage = computed(() => mapSaveError(saveError.value))

const previewDisabledReason = computed(() => {
    if (!scopeReady.value) return t('viewModel.scopeMissing')
    if (!canPreviewViewModelSql(resolvePreviewSql())) return t('viewModel.previewDisabledHint')
    return ''
})

async function resolveAiSqlRequest() {
    const connId = connectionId.value || props.tab.connectionId
    const db = databaseName.value
    if (!connId || !db) return undefined
    return {
        connectionId: connId,
        database: db,
        prefs: appConfig.aiPreferences,
    }
}

const {
    visible: showAiInput,
    prompt: aiPrompt,
    generating: aiGenerating,
    panelRef: aiPanelRef,
    btnRef: aiBtnRef,
    open: openAiInput,
    toggle: toggleAiInput,
    close: closeAiInput,
    submit: submitAiPrompt,
} = useAiPromptPanel(({prompt, sql: generated}) => {
    const {text, focusLine} = appendConsoleAiSql(sql.value, prompt, generated)
    sql.value = text
    void nextTick(() => {
        requestAnimationFrame(() => {
            editorRef.value?.goToLine(focusLine, false)
            editorRef.value?.layout()
        })
    })
}, {resolveRequest: resolveAiSqlRequest})

const aiContextLabel = computed(
    () => activeInstance.value?.label ?? source.value?.label ?? databaseName.value ?? null,
)

const aiQuickActions = computed(() => {
    if (!aiSelectionSql.value.trim()) return []
    return [
        {id: 'explain', label: t('console.editorMenu.explain')},
        {id: 'optimize', label: t('console.editorMenu.optimize')},
        {id: 'rewrite', label: t('console.editorMenu.rewrite')},
    ]
})

function applyViewModelAiQuickAction(actionId: string) {
    const selected = aiSelectionSql.value.trim()
    if (!selected) return
    const promptByAction: Record<string, string> = {
        explain: t('console.explainPrompt', {sql: selected}),
        optimize: t('console.optimizePrompt', {sql: selected}),
        rewrite: t('console.rewritePrompt', {sql: selected}),
    }
    const prompt = promptByAction[actionId]
    if (!prompt) return
    aiPrompt.value = prompt
    void submitAiPrompt()
}

watch(
    () => [props.tab.connectionId, props.tab.instanceId] as const,
    ([nextConnectionId, nextInstanceId]) => {
        if (nextConnectionId) connectionId.value = nextConnectionId
        if (nextInstanceId !== undefined) instanceId.value = nextInstanceId
    },
)

watch(
    () => [props.tab.viewModelSql, props.tab.id] as const,
    () => syncFromTab(props.tab),
)

watch(sql, (value) => {
    props.tab.viewModelSql = value
})

watch(databaseName, (name) => {
    if (!name?.trim()) return
    if (props.tab.database?.trim() !== name.trim()) {
        workspace.updateTabContext(props.tab.id, {database: name.trim()})
    }
}, {immediate: true})

watch(showAiInput, async (visible) => {
    if (visible) {
        aiSelectionSql.value = editorRef.value?.getSelectedText()?.trim() ?? ''
    }
    await nextTick()
    editorRef.value?.layout()
})

watch(isEditorFullscreen, async () => {
    await nextTick()
    editorRef.value?.layout()
})

watch(showLineagePreview, async () => {
    await nextTick()
    editorRef.value?.layout()
})

watch(showPreview, async () => {
    await nextTick()
    editorRef.value?.layout()
})

function clampEditorHeight(value: number) {
    const splitEl = splitRef.value
    const maxByPane = splitEl
        ? Math.max(CONSOLE_EDITOR_HEIGHT_MIN, splitEl.clientHeight - CONSOLE_RESULT_MIN_HEIGHT - 4)
        : CONSOLE_EDITOR_HEIGHT_MAX
    const max = Math.min(CONSOLE_EDITOR_HEIGHT_MAX, maxByPane)
    return Math.min(max, Math.max(CONSOLE_EDITOR_HEIGHT_MIN, value))
}

function formatSql() {
    editorRef.value?.formatDocument()
    workspace.setStatus(t('console.formatted'))
}

async function onPreview() {
    if (isEditorFullscreen.value) {
        exitEditorFullscreen()
    }
    await preview()
    showPreview.value = true
}

function toggleLineagePreviewPanel() {
    showLineagePreview.value = !showLineagePreview.value
}

function togglePreviewPanel() {
    showPreview.value = !showPreview.value
    if (showPreview.value && !previewRows.value.length && canPreview.value) {
        void onPreview()
    }
}

async function refreshViewsTreeAfterSave() {
    try {
        const instanceName = databaseName.value
        if (props.tab.connectionId && instanceName) {
            await explorer.reloadViewsFolder(
                props.tab.connectionId,
                instanceName,
                props.tab.instanceId ?? undefined,
            )
        }
    } catch {
        // tree refresh is best-effort
    }
}

function denyGuestWrite(): boolean {
    if (!guestReadOnly.value) return false
    return true
}

async function onPublish() {
    if (denyGuestWrite()) return
    const result = await save()
    if (!result) return
    if (result.outcome === 'published') {
        layout.showSuccessToast(t('viewModel.saved', {name: viewModelTitle.value}))
        await refreshViewsTreeAfterSave()
        return
    }
    // Validation / publish failure: saveError is rendered inline
    if (result.reason === 'single_select_required' || result.reason === 'sql_required' || result.reason === 'missing_scope') {
        return
    }
    if (!result.reason) {
        layout.showSuccessToast(t('viewModel.savedDraft', {name: viewModelTitle.value}))
    }
    await refreshViewsTreeAfterSave()
}

async function onSaveDraft() {
    if (denyGuestWrite()) return
    const result = await saveDraft()
    if (!result) return
    if (result.reason) return
    layout.showSuccessToast(t('viewModel.savedDraft', {name: viewModelTitle.value}))
    await refreshViewsTreeAfterSave()
}

useWorkspaceSqlShortcutHandlers(() => ({
    onRun: () => void onPreview(),
    onSave: () => void onSaveDraft(),
    onAiPrompt: consoleAiEnabled.value ? openAiInput : undefined,
}))

onMounted(async () => {
    await ensureSqlEditorPlugin()
    editorReady.value = true
    syncFromTab(props.tab)
    if (!splitRef.value) return
    editorHeight.value = clampEditorHeight(
        Math.round(splitRef.value.clientHeight * CONSOLE_EDITOR_HEIGHT_RATIO),
    )
})
</script>

<template>
  <div class="console-tab vm-editor-tab vm-editor-tab--v2 dw-workbench-page" :class="{ 'is-editor-fullscreen': isEditorFullscreen }">
    <div class="vm-editor-status" :class="{'is-ready': scopeReady, 'is-warn': !scopeReady}">
      <div class="vm-editor-status__intro">
        <span
            class="vm-editor-status__badge"
            :class="{
              'vm-editor-status__badge--draft': tab.viewModelIsDraft,
              'vm-editor-status__badge--published': !tab.viewModelIsDraft && tab.viewModelSavedSql,
            }"
        >
          {{ t(statusLabelKey) }}
          <span v-if="isDirty" class="vm-editor-tab__dirty">*</span>
        </span>
        <div class="vm-editor-status__scope">
          <span class="vm-editor-chip">{{ connectionLabel }}</span>
          <span v-if="databaseName" class="vm-editor-chip">{{ databaseName }}</span>
          <span class="vm-editor-chip vm-editor-chip--accent">{{ viewModelTitle }}</span>
        </div>
        <p v-if="!scopeReady" class="vm-editor-status__hint">{{ t('viewModel.scopeMissing') }}</p>
        <p v-else-if="showLineagePreview" class="vm-editor-status__hint">{{ t('viewModel.lineagePreviewHint') }}</p>
        <p v-else class="vm-editor-status__hint">{{ t('viewModel.previewHint') }}</p>
      </div>
      <div class="vm-editor-status__actions">
        <DwButton
            :variant="showLineagePreview ? 'secondary' : 'ghost'"
            size="sm"
            type="button"
            :disabled="!scopeReady"
            @click="toggleLineagePreviewPanel"
        >
          {{ t('viewModel.toggleLineagePreview') }}
        </DwButton>
        <DwButton
            :variant="showPreview ? 'secondary' : 'ghost'"
            size="sm"
            type="button"
            @click="togglePreviewPanel"
        >
          {{ t('viewModel.toggleResults') }}
        </DwButton>
      </div>
    </div>

    <div class="dw-console-toolbar">
      <div class="dw-console-actions dw-btn-group">
        <IconButton
            v-if="can(FeaturePermission.WorkbenchConsoleRun)"
            class="console-run-btn"
            :disabled="!canPreview || previewLoading"
            :title="previewDisabledReason || shortcutTooltip(t('viewModel.preview'), 'workspace.runSql')"
            @click="onPreview"
        >
          <ConsoleToolbarIcon name="run"/>
        </IconButton>
        <span class="dw-console-divider" aria-hidden="true"/>
        <IconButton
            v-if="can(FeaturePermission.WorkbenchConsoleSave)"
            :disabled="guestReadOnly || saving || draftSaving || !scopeReady"
            :title="guestReadOnly ? guestReadOnlyHint : t('viewModel.publish')"
            @click="onPublish"
        >
          <ConsoleToolbarIcon name="save"/>
        </IconButton>
        <IconButton
            v-if="can(FeaturePermission.WorkbenchConsoleSave)"
            :disabled="guestReadOnly || saving || draftSaving || !scopeReady"
            :title="guestReadOnly ? guestReadOnlyHint : t('viewModel.saveDraft')"
            @click="onSaveDraft"
        >
          <ConsoleToolbarIcon name="save" muted/>
        </IconButton>
        <IconButton
            v-if="sqlFormatEnabled && can(FeaturePermission.WorkbenchConsoleFormat)"
            :title="t('console.format')"
            @click="formatSql"
        >
          <ConsoleToolbarIcon name="format"/>
        </IconButton>
        <EditorFullscreenButton
            v-if="can(FeaturePermission.WorkbenchConsoleFullscreen)"
            variant="toolbar"
            :active="isEditorFullscreen"
            @click="toggleEditorFullscreen"
        />
        <span class="dw-console-divider" aria-hidden="true"/>
        <div v-if="consoleAiEnabled && can(FeaturePermission.WorkbenchConsoleAi)" ref="aiBtnRef" class="ai-btn-wrap">
          <IconButton
              class="console-ai-btn"
              :title="shortcutTooltip(t('console.ai'), 'workspace.aiPrompt')"
              :active="showAiInput"
              @click="toggleAiInput"
          >
            <ConsoleToolbarIcon name="ai"/>
          </IconButton>
        </div>
      </div>

      <div class="dw-console-toolbar__context">
        <ConsoleCtxBar
            v-model:connection-id="connectionId"
            v-model:instance-id="instanceId"
            :data-sources="dataSources"
            :bound-database-label="tab.database"
            :context-locked="true"
            read-only
            :bound-connection-label="connectionLabel"
            :bound-connection-db-type="dbDialect"
        />
      </div>
    </div>

    <DwInlineAlert :message="saveErrorMessage"/>

    <div ref="splitRef" class="split dw-seam-stack dw-seam-stack--flush">
      <div
          class="editor-pane"
          :class="{
            'editor-pane--fullscreen': isEditorFullscreen,
            'editor-pane--expanded': !isEditorFullscreen && !showPreview && !showLineagePreview,
          }"
          :style="!isEditorFullscreen && (showPreview || showLineagePreview) ? { height: `${editorHeight}px` } : undefined"
      >
        <AiPromptBar
            v-if="showAiInput && consoleAiEnabled"
            ref="aiPanelRef"
            v-model="aiPrompt"
            :generating="aiGenerating"
            :context-label="aiContextLabel"
            :quick-actions="aiQuickActions"
            @submit="submitAiPrompt"
            @close="closeAiInput"
            @quick-action="applyViewModelAiQuickAction"
        />
        <div class="editor-surface">
          <SqlEditor
              v-if="editorReady"
              ref="editorRef"
              v-model="sql"
              :connection-id="connectionId || tab.connectionId"
              :database-name="databaseName"
              :schema-provider="schemaProvider"
              :dialect="dbDialect"
              show-hint-bar
          />
        </div>
        <ViewModelLineagePreviewPanel
            v-if="!isEditorFullscreen && showLineagePreview"
            class="vm-lineage-preview-pane"
            :graph="lineageGraph"
            :loading="lineageLoading"
            :error="lineageError"
            :model-name="viewModelTitle"
            @refresh="refreshLineagePreview"
        />
      </div>
      <SplitHandle
          v-if="!isEditorFullscreen && showPreview"
          v-model="editorHeight"
          direction="horizontal"
          :min="CONSOLE_EDITOR_HEIGHT_MIN"
          :max="CONSOLE_EDITOR_HEIGHT_MAX"
      />
      <QueryResultPane
          v-if="!isEditorFullscreen && showPreview"
          class="result-pane"
          :columns="previewColumns"
          :rows="previewRows"
          :total="previewRows.length"
          :result-label="viewModelTitle"
          :loading="previewLoading"
          :show-export="false"
      />
      <DwInlineAlert :message="previewErrorMessage && !isEditorFullscreen && showPreview ? previewErrorMessage : null"/>
    </div>
  </div>
</template>

<style scoped>
.ai-btn-wrap {
  display: inline-flex;
}

.dw-console-toolbar__context {
  display: flex;
  flex: 1;
  flex-wrap: wrap;
  align-items: center;
  justify-content: flex-end;
  gap: var(--dw-gap);
  min-width: 0;
}

.vm-editor-tab {
  display: flex;
  flex-direction: column;
  min-height: 0;
  height: 100%;
}

.vm-editor-status {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: var(--dw-space-6);
  padding: var(--dw-pad-control-lg);
  border-bottom: 1px solid var(--dw-border-light);
  background: var(--dw-bg-editor);
}

.vm-editor-status.is-warn {
  background: color-mix(in srgb, var(--dw-warning) 6%, var(--dw-bg-editor));
}

.vm-editor-status__intro {
  display: flex;
  flex-direction: column;
  gap: var(--dw-gap-sm);
  min-width: 0;
}

.vm-editor-status__badge {
  display: inline-flex;
  align-items: center;
  gap: var(--dw-gap-xs);
  width: fit-content;
  font-size: var(--dw-text-xs);
  padding: var(--dw-pad-chip);
  border-radius: var(--dw-radius-pill);
  background: var(--dw-bg-muted);
  color: var(--dw-text-secondary);
  white-space: nowrap;
}

.vm-editor-status__badge--draft {
  color: var(--dw-warning);
  background: color-mix(in srgb, var(--dw-warning) 12%, transparent);
}

.vm-editor-status__badge--published {
  color: var(--dw-success);
  background: color-mix(in srgb, var(--dw-success) 12%, transparent);
}

.vm-editor-status__scope {
  display: flex;
  flex-wrap: wrap;
  gap: var(--dw-gap-sm);
}

.vm-editor-chip {
  display: inline-flex;
  align-items: center;
  min-height: var(--dw-control-h-xs);
  padding: 0 var(--dw-space-4);
  border-radius: var(--dw-radius-pill);
  border: 1px solid var(--dw-wb-card-border);
  background: var(--dw-wb-card-bg);
  font-size: var(--dw-text-xs);
  color: var(--dw-text-muted);
}

.vm-editor-chip--accent {
  color: var(--dw-primary);
  border-color: color-mix(in srgb, var(--dw-primary) 30%, var(--dw-border-light));
  background: color-mix(in srgb, var(--dw-primary) 6%, var(--dw-bg-panel));
}

.vm-editor-status__hint {
  margin: 0;
  font-size: var(--dw-text-xs);
  color: var(--dw-text-muted);
  line-height: var(--dw-leading);
}

.vm-editor-status__actions {
  flex-shrink: 0;
}

.vm-editor-tab__dirty {
  color: var(--dw-warning);
}

.split {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
}

.editor-pane {
  position: relative;
  display: flex;
  flex-direction: column;
  flex-shrink: 0;
  min-height: 120px;
  border-bottom: 1px solid var(--dw-border-light);
}

.editor-surface {
  position: relative;
  flex: 1;
  min-height: 0;
}

.editor-surface :deep(.sql-editor) {
  height: 100%;
}

.editor-pane--fullscreen {
  flex: 1;
  min-height: 0;
  border-bottom: none;
}

.editor-pane--expanded {
  flex: 1;
  min-height: 0;
  border-bottom: none;
}

.console-tab.is-editor-fullscreen .split {
  min-height: 0;
}

.result-pane {
  flex: 1;
  min-height: 120px;
}

.vm-lineage-preview-pane {
  flex-shrink: 0;
  height: 220px;
  min-height: 160px;
}
</style>
