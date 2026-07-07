<!--
  SQL 控制台 Tab — 业务逻辑在 composables / services，本组件负责布局与事件绑定。
-->
<script setup lang="ts">
import {computed, nextTick, onMounted, onUnmounted, ref, watch} from 'vue'
import {storeToRefs} from 'pinia'
import {useI18n} from 'vue-i18n'
import {AiPromptBar, ConsoleCtxBar, ConsoleTransactionBar, QueryResultPane} from '@/features/workspace/components'
import {ContextMenuHost} from '@/core/context-menu'
import EditorFullscreenButton from '@/core/components/EditorFullscreenButton.vue'
import IconButton from '@/core/components/IconButton.vue'
import ConsoleToolbarIcon from '@/core/components/ConsoleToolbarIcon.vue'
import {SqlEditor} from '@datawise/sql-editor'
import type {SqlEditorExpose} from '@datawise/sql-editor'
import {useExplorerSqlSchemaProvider} from '@/features/workspace/adapters/explorer-sql-schema-provider'
import SplitHandle from '@/core/components/SplitHandle.vue'
import {shortcutTooltip} from '@/features/layout/composables/useAppShortcutListener'
import {useWorkspaceSqlShortcutHandlers} from '@/features/workspace/composables/useWorkspaceSqlShortcutHandlers'
import type {WorkspaceTab} from '@/core/types'
import {useAppConfigStore} from '@/features/layout/stores/app-config-store'
import {
  CONSOLE_EDITOR_HEIGHT_DEFAULT,
  CONSOLE_EDITOR_HEIGHT_MAX,
  CONSOLE_EDITOR_HEIGHT_MIN,
  CONSOLE_EDITOR_HEIGHT_RATIO,
  CONSOLE_RESULT_MIN_HEIGHT
} from '@/features/workspace/constants/defaults'
import {useAiPromptPanel} from '@/features/workspace/composables/useAiPromptPanel'
import {useAiSqlFix} from '@/features/workspace/composables/useAiSqlFix'
import {useAiIndexSuggest} from '@/features/workspace/composables/useAiIndexSuggest'
import {useQueryResultAiSummary} from '@/features/workspace/composables/useQueryResultAiSummary'
import {useExplainPlanAiInterpret} from '@/features/workspace/composables/useExplainPlanAiInterpret'
import AiSqlFixDialog from '@/features/workspace/components/AiSqlFixDialog.vue'
import IndexSuggestDialog from '@/features/workspace/components/IndexSuggestDialog.vue'
import {useConsoleConnectionContext} from '@/features/workspace/composables/useConsoleConnectionContext'
import {useEditorContextMenu} from '@/features/workspace/composables/useEditorContextMenu'
import {useConnectionCapabilities} from '@/shared/capabilities/useConnectionCapabilities'
import {useLayoutStore} from '@/features/layout/stores/layout'
import {useEditorFullscreen} from '@/features/workspace/composables/useEditorFullscreen'
import {useSqlEditorActions, type SqlRunOptions} from '@/features/workspace/composables/useSqlEditorActions'
import {useResourceWriteGuard} from '@/features/auth/composables/useResourceWriteGuard'
import {UserResource} from '@/features/auth/types/user-resource.types'
import type {QueryResultRefreshRequest} from '@/features/workspace/services/query-result-refresh.service'
import {resolveConsoleInstanceLabel, buildExplorerScopedLabelResolver} from '@/features/workspace/services/resolve-console-instance'
import {appendConsoleAiSql} from '@/features/workspace/services/console-ai-sql.service'
import {useWorkspaceStore} from '@/features/workspace/stores/workspace'
import {useExplorerStore} from '@/features/explorer/stores/explorer'
import {usePluginStore} from '@/features/plugin/stores/plugin-store'
import {sqlApi} from '@/api'
import {mergeCursorPageIntoQueryResult} from '@/features/workspace/services/query-result-cursor.service'
import {useQueryBookmarkSave} from '@/features/workspace/composables/useQueryBookmarkSave'
import SaveBookmarkDialog from '@/features/workspace/components/SaveBookmarkDialog.vue'
import {isViewModelSelectSql} from '@/api/modules/view-model'
import DangerousSqlPendingBar from '@/features/workspace/components/DangerousSqlPendingBar.vue'
import ConsoleSqlCancelDialog from '@/features/workspace/components/ConsoleSqlCancelDialog.vue'
import SqlParameterPanel from '@/features/workspace/components/SqlParameterPanel.vue'
import SqlExecutionLimitHint from '@/features/workspace/components/SqlExecutionLimitHint.vue'
import {useDangerousSqlPending} from '@/features/workspace/composables/useDangerousSqlPending'
import {normalizeConnectionEnvironment} from '@/features/connection/services/connection-environment.service'
import {shouldConfirmDangerousSql} from '@/features/workspace/services/dangerous-sql-confirm-policy.service'
import {splitSqlStatements} from '@/features/workspace/services/split-sql-statements'
import {resolveExecutableSql} from '@/features/workspace/services/resolve-executable-sql'
import {useConsoleSqlCancel} from '@/features/workspace/composables/useConsoleSqlCancel'
import {useTeamStore} from '@/features/team/stores/team-store'
import {resolveProductionApprovalTeams} from '@/features/team/services/production-approval-policy.service'
import SubmitProductionApprovalDialog from '@/features/workspace/components/SubmitProductionApprovalDialog.vue'
import {canDmlConnection} from '@/features/team/services/connection-access.service'
import {applySqlParameters, extractSqlParameters} from '@/features/workspace/services/sql-parameters.service'
import {
    supportsExplainAnalyze,
    wrapExplainSql,
} from '@/features/workspace/services/explain-plan.service'
import {validateCrossEnvCompareSql, buildCrossEnvCompareScope} from '@/features/cross-env-compare/services/cross-env-compare.service'
import {reviewSql} from '@/features/platform/services/sql-review.service'
import type {SqlReviewFinding} from '@/features/platform/types/platform.types'

const {t} = useI18n()
const {readOnly: guestReadOnly, hint: guestReadOnlyHint} = useResourceWriteGuard(UserResource.WorkspaceScripts)
const props = defineProps<{ tab: WorkspaceTab }>()

const workspace = useWorkspaceStore()
const explorer = useExplorerStore()
const layout = useLayoutStore()
const appConfig = useAppConfigStore()
const pluginStore = usePluginStore()
const {consoleQueryByTabId} = storeToRefs(workspace)

const sql = ref(props.tab.sql ?? '')
const sqlParamValues = ref<Record<string, string>>({})
const parameterNames = computed(() => extractSqlParameters(sql.value))
const aiSelectionSql = ref('')
const splitRef = ref<HTMLElement>()
const editorRef = ref<SqlEditorExpose>()
const cursorLoading = ref(false)
const transactionBarRef = ref<{ refreshStatus: () => Promise<void> } | null>(null)
const schemaProvider = useExplorerSqlSchemaProvider()

const editorHeight = computed({
  get: () => appConfig.consoleEditorHeight,
  set: (value: number) => appConfig.setConsoleEditorHeight(clampEditorHeight(value)),
})

const showResultPanel = computed(() => appConfig.showConsoleResultPanel)

const sqlFormatEnabled = computed(() => pluginStore.isEnabled('p-sql-format'))
const consoleAiEnabled = computed(() => pluginStore.isEnabled('p-console-ai'))
const indexSuggestEnabled = computed(() => pluginStore.isEnabled('p-ai-index-suggest'))
const aiSqlFixEnabled = computed(() => pluginStore.isEnabled('p-ai-sql-fix'))
const aiResultSummaryEnabled = computed(() => pluginStore.isEnabled('p-ai-result-summary'))
const aiExplainEnabled = computed(() => pluginStore.isEnabled('p-ai-explain'))
const dmlGenerateEnabled = computed(() => pluginStore.isEnabled('p-dml-generate'))
const explainPlanEnabled = computed(() => pluginStore.isEnabled('p-explain-plan'))
const crossEnvCompareEnabled = computed(() => pluginStore.isEnabled('p-cross-env-compare'))
const bookmarksEnabled = computed(() => pluginStore.isEnabled('p-sql-bookmarks'))

function collapseResultPanel() {
  appConfig.setShowConsoleResultPanel(false)
}

function expandResultPanel() {
  appConfig.setShowConsoleResultPanel(true)
}

const {connectionId, instanceId, dataSources, source, activeInstance, workspaceBound} =
    useConsoleConnectionContext(props.tab)

const {
  bookmarkDialogOpen,
  bookmarkSaving,
  bookmarkDefaults,
  openSaveBookmarkDialog,
  onSaveBookmark,
} = useQueryBookmarkSave(() => ({
  name: props.tab.title?.trim() || 'Query',
  connectionName: source.value?.label ?? '',
  sql: sql.value,
}))

function openSaveViewModelDialog() {
  const connId = connectionId.value || props.tab.connectionId
  const instance = databaseName.value
  if (!connId || !instance) {
    layout.showToast(t('viewModel.saveFailed'))
    return
  }
  if (!isViewModelSelectSql(sql.value)) {
    layout.showToast(t('viewModel.selectOnly'))
    return
  }
  layout.setModule('database')
  void workspace.openViewModelEditor({
    connectionId: connId,
    instanceId: instanceId.value ?? props.tab.instanceId ?? undefined,
    database: instance,
    sql: sql.value,
  })
}

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

const dbDialect = computed(() => source.value?.dbType)

const connectionEnvironment = computed(() => {
  const connId = connectionId.value || props.tab.connectionId
  if (!connId) return normalizeConnectionEnvironment(null, null).env
  const node = explorer.findNode(connId)
  return normalizeConnectionEnvironment(node?.env, node?.envCustom).env
})

const {caps: connectionCaps, hint: capabilityHint} = useConnectionCapabilities(dbDialect)

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

const {
  pending: dangerousSqlPending,
  pendingSql: dangerousSqlPendingSql,
  preview: dangerousSqlPreview,
  loading: dangerousSqlLoading,
  affectedCount: dangerousSqlAffectedCount,
  sampleRows: dangerousSqlSampleRows,
  sampleColumns: dangerousSqlSampleColumns,
  errorMessage: dangerousSqlErrorMessage,
  productionForced: dangerousSqlProductionForced,
  requiresConfirmation: requiresDangerousSqlConfirmation,
  armPending: armDangerousSqlPending,
  disarm: disarmDangerousSqlPending,
} = useDangerousSqlPending(async (previewSql) => {
  const connId = connectionId.value || props.tab.connectionId
  if (!connId) {
    throw new Error(t('console.connectionRequired'))
  }
  const result = await sqlApi.execute(previewSql, {
    connectionId: connId,
    database: databaseName.value,
    sessionKey: props.tab.id,
    pageSize: 20,
    maxRows: 20,
  })
  return {
    rows: result.rows ?? [],
    columns: result.columns ?? [],
  }
}, {
  shouldConfirm: (_sql, preview) => shouldConfirmDangerousSql(preview, {
    env: connectionEnvironment.value,
    preferences: appConfig.dangerousSqlPreferences,
  }),
  productionForced: () => connectionEnvironment.value === 'prod',
})

const {runSql, saveConsole, formatSql, formatSelection, jumpToErrorLine, running} = useSqlEditorActions({
  getTabId: () => props.tab.id,
  getSql: () => sql.value,
  getSqlFile: () => props.tab.sqlFile,
  getConnectionId: () => connectionId.value || props.tab.connectionId,
  getInstanceId: () => instanceId.value ?? props.tab.instanceId,
  getDatabase: () => databaseName.value,
  getConnectionLabel: () => source.value?.label ?? t('common.unnamedConnection'),
  getInstanceLabel: () => databaseName.value,
  getDbType: () => dbDialect.value,
  editorRef: () => editorRef.value ?? null,
  onExecuteComplete: () => {
    void transactionBarRef.value?.refreshStatus()
  },
  applyParameters: (text) => applySqlParameters(text, sqlParamValues.value),
})

const {
  fixDialogOpen,
  fixOriginal,
  fixSuggested,
  fixing: aiFixLoading,
  requestFix: requestAiSqlFix,
  applyFix,
} = useAiSqlFix({
  getSql: () => sql.value,
  setSql: (value) => {
    sql.value = value
  },
  focusEditorLine: (line) => {
    void nextTick(() => {
      requestAnimationFrame(() => {
        editorRef.value?.goToLine(line, false)
        editorRef.value?.layout()
      })
    })
  },
  getConnectionId: () => connectionId.value || props.tab.connectionId,
  getDatabase: () => databaseName.value,
  getDbType: () => dbDialect.value,
  getConnectionLabel: () => source.value?.label ?? t('common.unnamedConnection'),
  getSelection: () => editorRef.value?.getSelectedText()?.trim() || aiSelectionSql.value || undefined,
  resolveAiPrefs: () => appConfig.aiPreferences,
})

const {
  dialogOpen: indexSuggestDialogOpen,
  originalSql: indexSuggestQuery,
  suggestedSql: indexSuggestDraft,
  loading: aiIndexSuggestLoading,
  requestSuggest: requestAiIndexSuggest,
  applySuggest: applyIndexSuggest,
} = useAiIndexSuggest({
  getConnectionId: () => connectionId.value || props.tab.connectionId,
  getDatabase: () => databaseName.value,
  getDbType: () => dbDialect.value,
  getConnectionLabel: () => source.value?.label ?? t('common.unnamedConnection'),
  resolveAiPrefs: () => appConfig.aiPreferences,
  openConsole: (options) => workspace.openConsole(options),
  buildConsoleTitle: () => t('queryResult.indexSuggestConsoleTitle'),
})

const {
  summaryOpen: aiSummaryOpen,
  summaryText: aiSummaryText,
  loading: aiSummaryLoading,
  summarize: summarizeActiveResult,
  closeSummary: closeAiSummary,
} = useQueryResultAiSummary({
  getConnectionId: () => connectionId.value || props.tab.connectionId,
  getDatabase: () => databaseName.value,
  getDbType: () => dbDialect.value,
  getConnectionLabel: () => source.value?.label ?? t('common.unnamedConnection'),
  resolveAiPrefs: () => appConfig.aiPreferences,
})

function onRequestAiSummary() {
  const view = consoleQuery.value.activeView
  if (view === 'overview') return
  const result = consoleQuery.value.results[view]
  if (result) void summarizeActiveResult(result)
}

const {
  interpretOpen: aiExplainOpen,
  interpretText: aiExplainText,
  loading: aiExplainLoading,
  interpret: interpretActiveExplainPlan,
  closeInterpret: closeAiExplain,
} = useExplainPlanAiInterpret({
  getConnectionId: () => connectionId.value || props.tab.connectionId,
  getDatabase: () => databaseName.value,
  getDbType: () => dbDialect.value,
  getConnectionLabel: () => source.value?.label ?? t('common.unnamedConnection'),
  resolveAiPrefs: () => appConfig.aiPreferences,
})

function onRequestAiExplain() {
  const view = consoleQuery.value.activeView
  if (view === 'overview') return
  const result = consoleQuery.value.results[view]
  if (!result?.explainPlan?.length || !result.sql?.trim()) return
  void interpretActiveExplainPlan({
    sql: result.sql,
    explainPlan: result.explainPlan,
    explainMode: result.explainMode,
  })
}

const teamStore = useTeamStore()
const collabPulling = ref(false)
const collabPushing = ref(false)
const collabRemoteChanged = ref(false)
const collabLastRemoteUpdatedAt = ref<string | null>(null)
let collabPollTimer: number | null = null
const productionApprovalDialogOpen = ref(false)
const productionApprovalSubmitting = ref(false)
const sqlReviewFindings = ref<SqlReviewFinding[]>([])
const sqlReviewBlocked = ref(false)
const sqlReviewSuggestedSql = ref<string | null>(null)
const sqlReviewRewriteNote = ref<string | null>(null)
const sqlReviewRewriteLoading = ref(false)

const productionApprovalTeams = computed(() => {
  const pendingSql = dangerousSqlPendingSql.value
  if (!pendingSql) return []
  return resolveProductionApprovalTeams({
    env: connectionEnvironment.value,
    sql: pendingSql,
    connectionId: connectionId.value || props.tab.connectionId,
    teams: teamStore.teams,
  })
})

const needsProductionApproval = computed(() => productionApprovalTeams.value.length > 0)
const teamSharedQueryMeta = computed(() => props.tab.teamSharedQuery ?? null)
const teamCollabEnabled = computed(() => Boolean(teamSharedQueryMeta.value?.teamId && teamSharedQueryMeta.value?.queryId))
const teamCollabConflictHint = computed(() =>
  collabRemoteChanged.value
      ? t('team.sharedQueries.collabConflictHint')
      : t('team.sharedQueries.collabSyncedHint'),
)

const dangerousSqlSubmitTitle = computed(() =>
    needsProductionApproval.value
        ? t('console.productionApproval.submitForApproval')
        : t('console.dangerousSql.submit'),
)

const canManageTransactions = computed(() =>
    canDmlConnection(connectionId.value || props.tab.connectionId, teamStore.teams),
)
const canKillSession = computed(() =>
    Boolean((connectionId.value || props.tab.connectionId)?.trim())
    && connectionCaps.value.sessionKill
    && canManageTransactions.value,
)

const {
  confirmOpen: cancelConfirmOpen,
  pendingMode: cancelPendingMode,
  cancelling: cancelInProgress,
  cancelQueryNow,
  requestCancelConnection,
  closeConfirm: closeCancelConfirm,
  confirmCancel,
} = useConsoleSqlCancel({
  sessionKey: computed(() => props.tab.id),
  running,
  canKill: canKillSession,
})

const {isFullscreen: isEditorFullscreen, toggle: toggleEditorFullscreen, exit: exitEditorFullscreen} =
    useEditorFullscreen()

/** 全屏编辑时执行 SQL 需先退出全屏，才能看到结果区 */
function resolveConsoleExecutable(executableOverride?: unknown) {
  return resolveExecutableSql(
      executableOverride,
      () => editorRef.value?.getSelectedText() ?? '',
      {
        fallbackToCurrentLineSql: () => editorRef.value?.getCurrentLineSql() ?? '',
        getCurrentLineNumber: () => editorRef.value?.getCurrentLineNumber() ?? null,
        fallbackToFullDocument: () => sql.value,
        getSelectionStartLine: () => editorRef.value?.getSelectionStartLine() ?? null,
      },
  )
}

function batchNeedsDangerousConfirmation(resolvedSql: string): boolean {
  const statements = splitSqlStatements(resolvedSql)
  const batch = statements.length > 1 ? statements : [statements[0] ?? resolvedSql]
  return batch.some((statement) => requiresDangerousSqlConfirmation(statement.trim()))
}

async function loadSqlReviewFindings(resolvedSql: string) {
  sqlReviewFindings.value = []
  sqlReviewBlocked.value = false
  sqlReviewSuggestedSql.value = null
  sqlReviewRewriteNote.value = null
  const connId = connectionId.value || props.tab.connectionId
  if (!connId) return
  sqlReviewRewriteLoading.value = true
  try {
    const result = await reviewSql(
        {
          sql: resolvedSql,
          connectionId: connId,
          database: databaseName.value,
          aiRewrite: true,
        },
        {silent: true},
    )
    sqlReviewFindings.value = result.findings ?? []
    sqlReviewBlocked.value = !result.allowed
    sqlReviewSuggestedSql.value = result.suggestedSql?.trim() || null
    sqlReviewRewriteNote.value = result.rewriteNote?.trim() || null
  } catch {
    sqlReviewFindings.value = []
    sqlReviewBlocked.value = false
    sqlReviewSuggestedSql.value = null
    sqlReviewRewriteNote.value = null
  } finally {
    sqlReviewRewriteLoading.value = false
  }
}

function applySqlReviewSuggestion() {
  const suggested = sqlReviewSuggestedSql.value?.trim()
  if (!suggested) return
  sql.value = suggested
  editorRef.value?.layout()
  layout.showToast(t('platform.sqlReview.appliedRewrite'))
  void loadSqlReviewFindings(suggested)
}

async function armDangerousSqlWithReview(resolved: string) {
  await loadSqlReviewFindings(resolved)
  await armDangerousSqlPending(resolved)
}

function executeSql(executableOverride?: unknown, runOptions?: SqlRunOptions) {
  if (isEditorFullscreen.value) {
    exitEditorFullscreen()
  }
  if (!runOptions?.skipDangerousCheck) {
    const {sql: executable} = resolveConsoleExecutable(executableOverride)
    const trimmed = executable.trim()
    if (trimmed) {
      const resolved = applySqlParameters(trimmed, sqlParamValues.value)
      if (batchNeedsDangerousConfirmation(resolved)) {
        void armDangerousSqlWithReview(resolved)
        return
      }
    }
  }
  sqlReviewFindings.value = []
  sqlReviewBlocked.value = false
  sqlReviewSuggestedSql.value = null
  sqlReviewRewriteNote.value = null
  runSql(executableOverride, runOptions)
}

function resolveToolbarStatementSql(): string {
  const selected = editorRef.value?.getSelectedText?.()?.trim()
  if (selected) return selected
  return editorRef.value?.getCurrentLineSql?.()?.trim() || sql.value.trim()
}

function onRunStatementFromGutter(payload: { sql: string; anchorLine: number }) {
  executeSql(payload.sql, {perfSource: 'gutter'})
}

function runExplainPlanFromToolbar(event?: MouseEvent) {
  const targetSql = resolveToolbarStatementSql()
  const trimmed = targetSql.trim()
  if (!trimmed) return
  if (!explainPlanEnabled.value) return
  if (!connectionCaps.value.sqlExplain) {
    layout.showToast(capabilityHint('sqlExplain'))
    return
  }

  const analyze = Boolean(event?.shiftKey) && supportsExplainAnalyze(dbDialect.value)
  const wrapped = wrapExplainSql(trimmed, dbDialect.value, analyze)
  executeSql(wrapped, {skipDangerousCheck: true, perfSource: 'explain'})
}

async function saveStatementAsFileFromToolbar() {
  if (guestReadOnly.value) {
    layout.showToast(guestReadOnlyHint.value)
    return
  }
  const statementSql = resolveToolbarStatementSql()
  if (!statementSql) return
  const ok = await workspace.saveConsoleStatementAsFile(props.tab.id, statementSql)
  if (!ok) {
    layout.showToast(t('console.saveFailed'))
  }
}

function submitDangerousSql() {
  if (!dangerousSqlPending.value || !dangerousSqlPendingSql.value) return
  if (needsProductionApproval.value) {
    productionApprovalDialogOpen.value = true
    return
  }
  const pending = dangerousSqlPendingSql.value
  disarmDangerousSqlPending()
  executeSql(pending, {skipDangerousCheck: true})
}

async function onSubmitProductionApproval(teamId: string) {
  const pendingSql = dangerousSqlPendingSql.value
  const connId = connectionId.value || props.tab.connectionId
  if (!pendingSql || !connId) return

  productionApprovalSubmitting.value = true
  try {
    await teamStore.submitProductionApproval(teamId, {
      connectionId: connId,
      connectionName: source.value?.label ?? explorer.findNode(connId)?.label,
      database: databaseName.value || undefined,
      sql: pendingSql,
    })
    productionApprovalDialogOpen.value = false
    disarmDangerousSqlPending()
    layout.showToast(t('console.productionApproval.submitted'))
  } catch (error) {
    const message = error instanceof Error ? error.message : t('console.productionApproval.submitFailed')
    layout.showToast(message)
  } finally {
    productionApprovalSubmitting.value = false
  }
}

async function pullTeamSharedQuery() {
  const meta = teamSharedQueryMeta.value
  if (!meta || collabPulling.value) return
  collabPulling.value = true
  try {
    const detail = await teamStore.getSharedQuery(meta.teamId, meta.queryId)
    sql.value = detail.sql ?? ''
    collabLastRemoteUpdatedAt.value = detail.updatedAt || null
    collabRemoteChanged.value = false
    layout.showToast(t('team.sharedQueries.collabPulled'))
  } catch (error) {
    const message = error instanceof Error ? error.message : t('team.sharedQueries.collabPullFailed')
    layout.showToast(message)
  } finally {
    collabPulling.value = false
  }
}

async function pushTeamSharedQuery() {
  const meta = teamSharedQueryMeta.value
  if (!meta || collabPushing.value) return
  collabPushing.value = true
  try {
    const detail = await teamStore.getSharedQuery(meta.teamId, meta.queryId)
    const updated = await teamStore.updateSharedQuery(meta.teamId, meta.queryId, {
      title: detail.title,
      description: detail.description ?? undefined,
      connectionId: connectionId.value || props.tab.connectionId || detail.connectionId || undefined,
      connectionName: source.value?.label || detail.connectionName || undefined,
      database: databaseName.value || detail.database || undefined,
      sql: sql.value,
      tags: detail.tags ?? [],
      expectedUpdatedAt: collabLastRemoteUpdatedAt.value || detail.updatedAt || undefined,
    })
    collabLastRemoteUpdatedAt.value = updated.updatedAt || null
    collabRemoteChanged.value = false
    layout.showToast(t('team.sharedQueries.collabPushed'))
  } catch (error) {
    const fallback = t('team.sharedQueries.collabPushFailed')
    const message = error instanceof Error ? error.message : fallback
    if (message.includes('pull latest')) {
      collabRemoteChanged.value = true
      layout.showToast(t('team.sharedQueries.collabConflictSave'))
    } else {
      layout.showToast(message)
    }
  } finally {
    collabPushing.value = false
  }
}

async function pollTeamSharedQuery() {
  const meta = teamSharedQueryMeta.value
  if (!meta || collabPulling.value || collabPushing.value) return
  try {
    const detail = await teamStore.getSharedQuery(meta.teamId, meta.queryId)
    if (!collabLastRemoteUpdatedAt.value) {
      collabLastRemoteUpdatedAt.value = detail.updatedAt || null
      return
    }
    const remoteUpdated = (detail.updatedAt || '').trim()
    const localSeen = (collabLastRemoteUpdatedAt.value || '').trim()
    if (remoteUpdated && remoteUpdated !== localSeen && (detail.sql ?? '') !== sql.value) {
      collabRemoteChanged.value = true
    }
  } catch {
    // polling is best-effort; explicit pull/push handles user-facing errors
  }
}

function stopCollabPolling() {
  if (collabPollTimer != null) {
    window.clearInterval(collabPollTimer)
    collabPollTimer = null
  }
}

function startCollabPolling() {
  stopCollabPolling()
  if (!teamCollabEnabled.value) return
  collabPollTimer = window.setInterval(() => {
    void pollTeamSharedQuery()
  }, 15000)
}

watch(teamCollabEnabled, (enabled) => {
  if (!enabled) {
    collabRemoteChanged.value = false
    collabLastRemoteUpdatedAt.value = null
    stopCollabPolling()
    return
  }
  void pollTeamSharedQuery()
  startCollabPolling()
}, {immediate: true})

onUnmounted(() => {
  stopCollabPolling()
})

function rollbackDangerousSql() {
  disarmDangerousSqlPending()
}

function requestExplainPlan(targetSql: string) {
  const trimmed = targetSql.trim()
  if (!trimmed) return
  if (!explainPlanEnabled.value) return
  if (!connectionCaps.value.sqlExplain) {
    layout.showToast(capabilityHint('sqlExplain'))
    return
  }
  const wrapped = wrapExplainSql(trimmed, dbDialect.value, false)
  executeSql(wrapped, {skipDangerousCheck: true})
}

function openCrossEnvCompareFromResult(index: number) {
  const result = consoleQuery.value.results[index]
  const connId = connectionId.value || props.tab.connectionId
  const database = databaseName.value
  if (!connId || !database || !result?.sql?.trim()) return

  const sqlError = validateCrossEnvCompareSql(result.sql)
  if (sqlError) {
    layout.showToast(t(`crossEnvCompare.errors.${sqlError}`))
    return
  }

  const scope = buildCrossEnvCompareScope({
    connectionId: connId,
    connectionLabel: source.value?.label ?? explorer.findNode(connId)?.label ?? connId,
    database,
    dbType: dbDialect.value ?? 'mysql',
  })
  workspace.openCrossEnvCompare({left: scope, sql: result.sql})
}

const {
  visible: editorMenuVisible,
  position: editorMenuPos,
  menuItems: editorMenuItems,
  show: showEditorContextMenu,
  close: closeEditorMenu,
  selectMenuItem: onEditorMenuSelect,
} = useEditorContextMenu({
  editorRef: () => editorRef.value ?? null,
  runSql: (sql) => executeSql(sql, {perfSource: 'context-menu'}),
  requestExplainPlan,
  formatSelection,
  openAiInput: (prefill) => {
    if (prefill?.includes('\n')) {
      const lines = prefill.split('\n')
      aiSelectionSql.value = lines.slice(1).join('\n').trim()
    }
    void openAiInput(prefill)
  },
  getDbType: () => dbDialect.value,
  getCapabilities: () => connectionCaps.value,
  getCapabilityHint: () => capabilityHint('sqlExplain'),
  getExplainPlanEnabled: () => explainPlanEnabled.value,
  getIndexSuggestEnabled: () => indexSuggestEnabled.value,
  requestIndexSuggest: (targetSql) => {
    void requestAiIndexSuggest({sql: targetSql})
  },
})

function onEditorContextMenu(payload: { x: number; y: number; selectedText: string }) {
  aiSelectionSql.value = payload.selectedText.trim()
  showEditorContextMenu(payload)
}

const aiContextLabel = computed(
    () => activeInstance.value?.label ?? source.value?.label ?? null,
)

const consoleQuery = computed(() => {
  const state = consoleQueryByTabId.value[props.tab.id]
  return state ?? {results: [], activeView: 'overview' as const}
})

watch(
    () => props.tab.sql,
    (value) => {
      if (value !== undefined && value !== sql.value) {
        sql.value = value
      }
    },
)

function onActiveViewChange(view: 'overview' | number) {
  workspace.setConsoleActiveView(props.tab.id, view)
}

function onCloseResult(index: number) {
  workspace.closeConsoleQueryResult(props.tab.id, index)
}

function onCloseOtherResults(index: number) {
  workspace.closeOtherConsoleQueryResults(props.tab.id, index)
}

function onCloseAllResults() {
  workspace.closeAllConsoleQueryResults(props.tab.id)
}

function refreshActiveResult(payload?: QueryResultRefreshRequest) {
  if (!payload) return
  executeSql(payload.sql, {refreshResultIndex: payload.resultIndex, skipDangerousCheck: true})
}

async function onLoadMoreResult(index: number) {
  const result = consoleQuery.value.results[index]
  if (!result?.cursorId || cursorLoading.value) return
  cursorLoading.value = true
  try {
    const page = await sqlApi.fetchCursorPage(result.cursorId, result.pageSize)
    workspace.appendConsoleQueryResultPage(
        props.tab.id,
        index,
        mergeCursorPageIntoQueryResult(result, page),
    )
  } finally {
    cursorLoading.value = false
  }
}

const aiQuickActions = computed(() => {
  if (!aiSelectionSql.value.trim()) return []
  const actions = [
    {id: 'explain', label: t('console.editorMenu.explain')},
    {id: 'optimize', label: t('console.editorMenu.optimize')},
    {id: 'rewrite', label: t('console.editorMenu.rewrite')},
    {id: 'generate-insert', label: t('console.editorMenu.generateInsert')},
  ]
  if (indexSuggestEnabled.value) {
    actions.push({id: 'suggest-index', label: t('console.editorMenu.suggestIndex')})
  }
  return actions
})

function applyConsoleAiQuickAction(actionId: string) {
  const selected = aiSelectionSql.value.trim()
  if (!selected) return
  if (actionId === 'suggest-index') {
    void requestAiIndexSuggest({sql: selected})
    return
  }
  const promptByAction: Record<string, string> = {
    explain: t('console.explainPrompt', {sql: selected}),
    optimize: t('console.optimizePrompt', {sql: selected}),
    rewrite: t('console.rewritePrompt', {sql: selected}),
    'generate-insert': t('console.generateInsertPrompt', {sql: selected}),
  }
  const prompt = promptByAction[actionId]
  if (!prompt) return
  aiPrompt.value = prompt
  void submitAiPrompt()
}

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

watch(sql, (value) => {
  workspace.updateTabSql(props.tab.id, value)
  if (dangerousSqlPending.value) {
    disarmDangerousSqlPending()
  }
})

watch(
    () => consoleQuery.value.results.length,
    (count, prev) => {
      if (count > 0 && count !== prev) {
        expandResultPanel()
      }
    },
)

watch([connectionId, instanceId], ([conn, inst]) => {
  workspace.updateTabContext(props.tab.id, {
    connectionId: conn,
    instanceId: inst,
    database: activeInstance.value?.label ?? props.tab.database,
  })
})

useWorkspaceSqlShortcutHandlers(() => ({
  onRun: () => executeSql(undefined, {perfSource: 'shortcut'}),
  onSave: saveConsole,
  onAiPrompt: consoleAiEnabled.value ? openAiInput : undefined,
}))

function clampEditorHeight(value: number) {
  const splitEl = splitRef.value
  const maxByPane = splitEl
      ? Math.max(CONSOLE_EDITOR_HEIGHT_MIN, splitEl.clientHeight - CONSOLE_RESULT_MIN_HEIGHT - 4)
      : CONSOLE_EDITOR_HEIGHT_MAX
  const max = Math.min(CONSOLE_EDITOR_HEIGHT_MAX, maxByPane)
  return Math.min(max, Math.max(CONSOLE_EDITOR_HEIGHT_MIN, value))
}

onMounted(() => {
  if (!splitRef.value) return
  if (appConfig.consoleEditorHeight === CONSOLE_EDITOR_HEIGHT_DEFAULT) {
    editorHeight.value = clampEditorHeight(
        Math.round(splitRef.value.clientHeight * CONSOLE_EDITOR_HEIGHT_RATIO),
    )
  }
})

</script>

<template>
  <div class="console-tab" :class="{ 'is-editor-fullscreen': isEditorFullscreen }">
    <div class="dw-console-toolbar">
      <div class="dw-console-actions dw-btn-group">
        <IconButton
            class="console-run-btn"
            :class="{ 'console-run-btn--cancel': running }"
            :disabled="dangerousSqlPending && !running"
            :title="running
              ? t('console.cancelExecution.cancelQueryHint')
              : dangerousSqlPending
                ? t('console.dangerousSql.pendingRunBlocked')
                : shortcutTooltip(t('console.run'), 'workspace.runSql')"
            @click="running ? cancelQueryNow() : executeSql(undefined, {perfSource: 'toolbar'})"
        >
          <ConsoleToolbarIcon :name="running ? 'stop' : 'run'"/>
        </IconButton>
        <IconButton
            v-if="explainPlanEnabled"
            :disabled="!connectionCaps.sqlExplain"
            :title="connectionCaps.sqlExplain
              ? t('console.explainMode.toolbar')
              : capabilityHint('sqlExplain')"
            @click="runExplainPlanFromToolbar"
        >
          <ConsoleToolbarIcon name="explainPlan"/>
        </IconButton>
        <IconButton
            :disabled="!dangerousSqlPending"
            :variant="dangerousSqlPending ? 'accent' : undefined"
            :title="dangerousSqlSubmitTitle"
            @click="submitDangerousSql"
        >
          <ConsoleToolbarIcon name="submit"/>
        </IconButton>
        <IconButton
            :disabled="!dangerousSqlPending"
            :title="t('console.dangerousSql.rollback')"
            @click="rollbackDangerousSql"
        >
          <ConsoleToolbarIcon name="rollback"/>
        </IconButton>
        <IconButton
            v-if="running"
            class="console-disconnect-btn"
            :title="t('console.cancelExecution.cancelConnectionHint')"
            @click="requestCancelConnection()"
        >
          <ConsoleToolbarIcon name="disconnect"/>
        </IconButton>
        <span class="dw-console-divider" aria-hidden="true"/>
        <IconButton
            :disabled="guestReadOnly"
            :title="guestReadOnly ? guestReadOnlyHint : shortcutTooltip(t('console.save'), 'workspace.saveConsole')"
            @click="saveConsole"
        >
          <ConsoleToolbarIcon name="save"/>
        </IconButton>
        <IconButton
            :disabled="guestReadOnly"
            :title="guestReadOnly ? guestReadOnlyHint : t('console.saveAsFile')"
            @click="saveStatementAsFileFromToolbar"
        >
          <ConsoleToolbarIcon name="saveAs"/>
        </IconButton>
        <IconButton
            v-if="bookmarksEnabled"
            :title="t('console.saveBookmark')"
            @click="openSaveBookmarkDialog"
        >
          <ConsoleToolbarIcon name="bookmark"/>
        </IconButton>
        <IconButton
            :disabled="guestReadOnly"
            :title="t('console.saveViewModel')"
            @click="openSaveViewModelDialog"
        >
          <ConsoleToolbarIcon name="viewModel"/>
        </IconButton>
        <IconButton
            v-if="sqlFormatEnabled"
            :title="t('console.format')"
            @click="formatSql"
        >
          <ConsoleToolbarIcon name="format"/>
        </IconButton>
        <EditorFullscreenButton
            variant="toolbar"
            :active="isEditorFullscreen"
            @click="toggleEditorFullscreen"
        />
        <span class="dw-console-divider" aria-hidden="true"/>
        <div v-if="consoleAiEnabled" ref="aiBtnRef" class="ai-btn-wrap">
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
        <div class="dw-console-toolbar__controls">
          <SqlExecutionLimitHint/>
          <ConsoleTransactionBar
              ref="transactionBarRef"
              :tab-id="tab.id"
              :connection-id="connectionId || tab.connectionId"
              :database="databaseName"
              :can-manage="canManageTransactions"
          />
        </div>
        <span class="dw-console-divider" aria-hidden="true"/>
        <div class="dw-console-toolbar__info">
          <ConsoleCtxBar
              class="dw-console-toolbar__ctx"
              v-model:connection-id="connectionId"
              v-model:instance-id="instanceId"
              :data-sources="dataSources"
              :bound-database-label="tab.database"
              :context-locked="workspaceBound"
              :bound-connection-label="source?.label ?? explorer.findNode(tab.connectionId ?? '')?.label"
              :bound-connection-db-type="dbDialect"
          />
        </div>
      </div>
    </div>

    <DangerousSqlPendingBar
        v-if="dangerousSqlPending"
        :preview="dangerousSqlPreview"
        :loading="dangerousSqlLoading"
        :affected-count="dangerousSqlAffectedCount"
        :sample-rows="dangerousSqlSampleRows"
        :sample-columns="dangerousSqlSampleColumns"
        :error-message="dangerousSqlErrorMessage"
        :production-forced="dangerousSqlProductionForced"
        :production-approval-required="needsProductionApproval"
        :sql-review-findings="sqlReviewFindings"
        :sql-review-blocked="sqlReviewBlocked"
        :sql-review-suggested-sql="sqlReviewSuggestedSql"
        :sql-review-rewrite-note="sqlReviewRewriteNote"
        :sql-review-rewrite-loading="sqlReviewRewriteLoading"
        @apply-suggested-sql="applySqlReviewSuggestion"
    />
    <div v-if="teamCollabEnabled" class="team-collab-banner">
      <span class="team-collab-banner__text">
        {{ t('team.sharedQueries.collabBanner', { title: teamSharedQueryMeta?.title || tab.title }) }}
      </span>
      <span class="team-collab-banner__hint" :class="{ 'is-warning': collabRemoteChanged }">
        {{ teamCollabConflictHint }}
      </span>
      <div class="team-collab-banner__actions">
        <button type="button" class="dw-btn dw-btn--ghost" :disabled="collabPulling || collabPushing" @click="pullTeamSharedQuery">
          {{ collabPulling ? t('common.loading') : t('team.sharedQueries.pullLatest') }}
        </button>
        <button type="button" class="dw-btn dw-btn--primary" :disabled="collabPulling || collabPushing" @click="pushTeamSharedQuery">
          {{ collabPushing ? t('common.saving') : t('team.sharedQueries.pushCurrent') }}
        </button>
      </div>
    </div>

    <div ref="splitRef" class="split">
      <div
          class="editor-pane"
          :class="{
          'editor-pane--fullscreen': isEditorFullscreen,
          'editor-pane--expanded': !isEditorFullscreen && !showResultPanel,
        }"
          :style="!isEditorFullscreen && showResultPanel ? { height: `${editorHeight}px` } : undefined"
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
            @quick-action="applyConsoleAiQuickAction"
        />
        <SqlParameterPanel
            :parameter-names="parameterNames"
            :values="sqlParamValues"
            @update:values="sqlParamValues = $event"
        />
        <div class="editor-surface">
          <SqlEditor
              ref="editorRef"
              v-model="sql"
              :connection-id="connectionId || tab.connectionId"
              :database-name="databaseName"
              :schema-provider="schemaProvider"
              :dialect="dbDialect"
              show-hint-bar
              @contextmenu="onEditorContextMenu"
              @run-statement="onRunStatementFromGutter"
          />
        </div>
      </div>
      <SplitHandle
          v-if="!isEditorFullscreen && showResultPanel"
          v-model="editorHeight"
          direction="horizontal"
          :min="CONSOLE_EDITOR_HEIGHT_MIN"
          :max="CONSOLE_EDITOR_HEIGHT_MAX"
      />
      <QueryResultPane
          v-if="!isEditorFullscreen && showResultPanel"
          class="result-pane"
          collapsible
          :results="consoleQuery.results"
          :active-view="consoleQuery.activeView"
          always-show-overview
          closable-results
          :enable-dml-generate="dmlGenerateEnabled"
          :enable-ai-fix="aiSqlFixEnabled"
          :ai-fix-loading="aiFixLoading"
          :enable-ai-summary="aiResultSummaryEnabled"
          :ai-summary-loading="aiSummaryLoading"
          :ai-summary-open="aiSummaryOpen"
          :ai-summary-text="aiSummaryText"
          :enable-ai-index-suggest="indexSuggestEnabled"
          :ai-index-suggest-loading="aiIndexSuggestLoading"
          :enable-ai-explain="aiExplainEnabled"
          :ai-explain-loading="aiExplainLoading"
          :ai-explain-open="aiExplainOpen"
          :ai-explain-text="aiExplainText"
          :enable-cross-env-compare="crossEnvCompareEnabled && Boolean((connectionId || tab.connectionId) && databaseName)"
          :db-type="dbDialect"
          :export-suggest-mask="connectionEnvironment === 'prod'"
          :cursor-loading="cursorLoading"
          @collapse="collapseResultPanel"
          @update:active-view="onActiveViewChange"
          @close-result="onCloseResult"
          @close-other-results="onCloseOtherResults"
          @close-all-results="onCloseAllResults"
          @jump-to-error-line="jumpToErrorLine"
          @request-ai-fix="requestAiSqlFix"
          @request-ai-summary="onRequestAiSummary"
          @close-ai-summary="closeAiSummary"
          @request-ai-explain="onRequestAiExplain"
          @close-ai-explain="closeAiExplain"
          @request-index-suggest="requestAiIndexSuggest"
          @open-cross-env-compare="openCrossEnvCompareFromResult"
          @refresh="refreshActiveResult"
          @load-more="onLoadMoreResult"
      />
      <AiSqlFixDialog
          v-if="aiSqlFixEnabled"
          v-model:open="fixDialogOpen"
          :original-sql="fixOriginal"
          :suggested-sql="fixSuggested"
          :loading="aiFixLoading"
          @apply="applyFix"
      />
      <IndexSuggestDialog
          v-if="indexSuggestEnabled"
          v-model:open="indexSuggestDialogOpen"
          :query-sql="indexSuggestQuery"
          :suggested-sql="indexSuggestDraft"
          :loading="aiIndexSuggestLoading"
          @apply="applyIndexSuggest"
      />
      <button
          v-if="!isEditorFullscreen && !showResultPanel"
          type="button"
          class="result-collapsed-bar"
          :title="t('queryResult.expandPanel')"
          @click="expandResultPanel"
      >
        <span class="result-collapsed-bar__label">{{ t('queryResult.panelTitle') }}</span>
      </button>
    </div>

    <ContextMenuHost
        :visible="editorMenuVisible"
        :items="editorMenuItems"
        :x="editorMenuPos.x"
        :y="editorMenuPos.y"
        @select="onEditorMenuSelect"
        @close="closeEditorMenu"
    />

    <SaveBookmarkDialog
        v-model:open="bookmarkDialogOpen"
        :default-name="bookmarkDefaults.name"
        :default-connection-name="bookmarkDefaults.connectionName"
        :default-sql="bookmarkDefaults.sql"
        :saving="bookmarkSaving"
        @save="onSaveBookmark"
    />

    <SubmitProductionApprovalDialog
        v-model:open="productionApprovalDialogOpen"
        :saving="productionApprovalSubmitting"
        :sql="dangerousSqlPendingSql ?? ''"
        :connection-name="source?.label ?? ''"
        :database="databaseName"
        :teams="productionApprovalTeams"
        @submit="onSubmitProductionApproval"
    />

    <ConsoleSqlCancelDialog
        :open="cancelConfirmOpen"
        :mode="cancelPendingMode"
        :loading="cancelInProgress"
        @confirm="confirmCancel()"
        @cancel="closeCancelConfirm()"
    />
  </div>
</template>

<style scoped>
.console-run-btn--cancel {
  color: #dc2626;
}

.console-run-btn--cancel:hover {
  background: color-mix(in srgb, #dc2626 10%, var(--dw-bg-muted));
}

.console-disconnect-btn {
  color: #dc2626;
}

.console-disconnect-btn:hover {
  background: color-mix(in srgb, #dc2626 10%, var(--dw-bg-muted));
}

.ai-btn-wrap {
  display: inline-flex;
}

.dw-console-toolbar__context {
  display: flex;
  flex: 1;
  flex-wrap: wrap;
  align-items: center;
  justify-content: flex-end;
  gap: 4px;
  min-width: 0;
}

.dw-console-toolbar__controls {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  flex-shrink: 0;
}

.dw-console-toolbar__info {
  display: inline-flex;
  align-items: center;
  flex-shrink: 0;
  min-width: 0;
}

.dw-console-toolbar__ctx {
  min-width: 0;
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

.editor-surface :deep(.sql-editor-hint-bar) {
  height: 26px;
  min-height: 26px;
  max-height: 26px;
  padding: 0 var(--dw-console-chrome-inset);
  gap: 6px;
  font-size: 10px;
  line-height: 14px;
  background: var(--dw-bg-editor);
}

.editor-surface :deep(.sql-editor-hint-bar .hint-text) {
  line-height: 14px;
  padding-bottom: 1px;
}

.editor-surface :deep(.sql-editor-hint-bar .hint-leading) {
  width: 172px;
  min-width: 172px;
  gap: 4px;
}

.editor-surface :deep(.sql-editor-hint-bar .hint-badge) {
  height: 18px;
  padding: 0 5px;
  font-size: 9px;
  line-height: 14px;
}

.editor-surface :deep(.sql-editor-hint-bar .hint-statement) {
  width: 50px;
  min-width: 50px;
}

.editor-surface :deep(.sql-editor-hint-bar .hint-slot) {
  width: 64px;
  min-width: 64px;
}

.editor-surface :deep(.sql-editor-hint-bar .hint-dialect-slot) {
  width: 46px;
  min-width: 46px;
}

.editor-surface :deep(.sql-editor-hint-bar .hint-dialect) {
  width: 46px;
  min-width: 46px;
  height: 16px;
  font-size: 8px;
  line-height: 14px;
}

.editor-surface :deep(.sql-editor-hint-bar .hint-chip) {
  min-width: 24px;
  height: 18px;
  padding: 0 5px;
  font-size: 9px;
  line-height: 14px;
}

.editor-surface :deep(.sql-editor-hint-bar .hint-quick-label) {
  font-size: 9px;
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

.result-collapsed-bar {
  display: flex;
  align-items: center;
  flex-shrink: 0;
  width: 100%;
  height: var(--dw-tab-height);
  padding: 0 10px;
  border: none;
  border-top: 1px solid var(--dw-tab-bar-border);
  background: var(--dw-tab-bar-bg);
  color: var(--dw-text-secondary);
  font-size: var(--dw-tab-title-size);
  cursor: pointer;
}

.result-collapsed-bar:hover {
  color: var(--dw-text);
  background: var(--dw-bg-hover);
}

.result-collapsed-bar__label {
  font-weight: 500;
}

.console-tab.is-editor-fullscreen .split {
  min-height: 0;
}

.result-pane {
  flex: 1;
  min-height: 140px;
}

.console-tab {
  display: flex;
  flex-direction: column;
  height: 100%;
  min-height: 0;
}

.team-collab-banner {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  padding: 8px 12px;
  border-bottom: 1px solid var(--dw-border-light);
  background: color-mix(in srgb, var(--dw-primary) 8%, var(--dw-bg-panel));
}

.team-collab-banner__text {
  font-size: 12px;
  color: var(--dw-text-secondary);
}

.team-collab-banner__actions {
  display: inline-flex;
  gap: 6px;
}

.team-collab-banner__hint {
  margin-left: auto;
  font-size: 11px;
  color: var(--dw-text-muted);
}

.team-collab-banner__hint.is-warning {
  color: var(--dw-danger, #c0392b);
  font-weight: 600;
}
</style>
