<script setup lang="ts">
import {computed, ref, watch} from 'vue'
import {useI18n} from 'vue-i18n'
import {CollapseButton} from '@/core/components'
import {DwIcon} from '@/core/icons'
import {ContextMenuHost} from '@/core/context-menu'
import TabBar from '@/core/components/TabBar.vue'
import TabItem from '@/core/components/TabItem.vue'
import SplitHandle from '@/core/components/SplitHandle.vue'
import DataGrid from '@/core/components/DataGrid.vue'
import ExplainPlanTree from '@/features/workspace/components/ExplainPlanTree.vue'
import GenerateDmlDialog from '@/features/workspace/components/GenerateDmlDialog.vue'
import QueryResultDiffPanel from '@/features/workspace/components/QueryResultDiffPanel.vue'
import QueryResultAiSummaryPanel from '@/features/workspace/components/QueryResultAiSummaryPanel.vue'
import {useClosableTabMenu} from '@/core/composables/useClosableTabMenu'
import type {DbType, TableColumn, TableRow} from '@/core/types'
import type {TableColumnDetail} from '@/shared/api/types'
import type {GridPendingBatch} from '@/core/composables/useGridPendingEdit'
import type {QueryResultItem} from '@/features/workspace/types'
import type {ExplainPlanNode} from '@/features/workspace/types/explain-plan'
import {getResultTabMenu} from '@/features/workspace/constants/tab-context-menu'
import {resolveQueryResultRefreshRequest} from '@/features/workspace/services/query-result-refresh.service'
import type {QueryResultRefreshRequest} from '@/features/workspace/services/query-result-refresh.service'
import {useLayoutStore} from '@/features/layout/stores/layout'
import {usePluginStore} from '@/features/plugin/stores/plugin-store'
import {useGridViewState} from '@/features/workspace/composables/useGridViewState'
import {useEditorSettingsStore} from '@/features/settings/stores/editor-settings'
import {isSlowDurationMs} from '@/features/workspace/services/slow-query.utils'
import {
    buildQueryResultDiff,
    canCompareQueryResults,
} from '@/features/workspace/services/query-result-diff.service'

const MESSAGES_WIDTH_DEFAULT = 280
const MESSAGES_WIDTH_MIN = 180
const MESSAGES_WIDTH_MAX = 480

interface MessageLogEntry {
  key: string
  resultIndex: number
  statementNo: number
  sql: string
  status: 'success' | 'error'
  durationMs: number
  errorMessage?: string
}

const {t} = useI18n()

const props = withDefaults(
    defineProps<{
      results?: QueryResultItem[]
      activeView?: number
      /** 控制台：左侧常显消息面板 */
      alwaysShowOverview?: boolean
      /** 控制台：查询执行中（仅消息区、隐藏结果主区） */
      running?: boolean
      closableResults?: boolean
      collapsible?: boolean
      columns?: TableColumn[]
      rows?: TableRow[]
      total?: number
      where?: string
      orderBy?: string
      showFilter?: boolean
      exportName?: string
      exportSuggestMask?: boolean
      resultLabel?: string
      editable?: boolean
      /** 只读时展示原因（如数据源不支持 DML） */
      readOnlyHint?: string
      canDelete?: boolean
      canUpdate?: boolean
      columnDetails?: TableColumnDetail[]
      pkColumns?: string[]
      tableAutoIncrement?: string | null
      onSubmitChanges?: (batch: GridPendingBatch) => Promise<boolean>
      /** 表数据等场景可指定持久化 scope；默认按结果 Tab id */
      gridStateScope?: string
      resultHasMore?: boolean
      cursorLoading?: boolean
      cursorTrimmedRows?: number
      productionPerfActive?: boolean
      enableDmlGenerate?: boolean
      dbType?: DbType
      enableAiFix?: boolean
      aiFixLoading?: boolean
      enableAiSummary?: boolean
      aiSummaryLoading?: boolean
      aiSummaryOpen?: boolean
      aiSummaryText?: string
      enableAiIndexSuggest?: boolean
      aiIndexSuggestLoading?: boolean
      enableAiExplain?: boolean
      aiExplainLoading?: boolean
      aiExplainOpen?: boolean
      aiExplainText?: string
      /** SQL 控制台：结果 Tab 可发起跨环境抽样对比 */
      enableCrossEnvCompare?: boolean
      showExport?: boolean
      enableFakeData?: boolean
      enableRowDocumentView?: boolean
    }>(),
    {
      showFilter: true,
      alwaysShowOverview: false,
      running: false,
      closableResults: false,
      exportName: 'query_result.csv',
      editable: false,
      canDelete: false,
      canUpdate: false,
      columnDetails: () => [],
      pkColumns: () => [],
      enableDmlGenerate: false,
      showExport: true,
      enableRowDocumentView: false,
    },
)

const emit = defineEmits<{
  'update:activeView': [number]
  collapse: []
  'close-result': [index: number]
  'close-other-results': [index: number]
  'close-all-results': []
  'jump-to-error-line': [lineNumber: number]
  refresh: [payload?: QueryResultRefreshRequest]
  'load-more': [index: number]
  'request-ai-fix': [payload: { sql: string; errorMessage: string; errorLine?: number }]
  'request-ai-summary': []
  'close-ai-summary': []
  'request-index-suggest': [payload: { sql: string; explainPlan?: ExplainPlanNode[] }]
  'request-ai-explain': []
  'close-ai-explain': []
  'open-cross-env-compare': [index: number]
  'generate-fake-data': []
}>()

const layout = useLayoutStore()
const pluginStore = usePluginStore()
const editorSettings = useEditorSettingsStore()
const tabBarRef = ref<InstanceType<typeof TabBar>>()
const batchSummaryRef = ref<HTMLElement | null>(null)
const messagesCollapsed = ref(false)
const messagesWidth = ref(MESSAGES_WIDTH_DEFAULT)

const isConsoleMode = computed(() => props.results !== undefined)
const showMessagesPanel = computed(() => isConsoleMode.value && props.alwaysShowOverview)
/** 有结果且非执行中才展示结果主区；执行中/无结果时仅消息页 */
const showResultsMain = computed(() => {
  if (!showMessagesPanel.value) return true
  if (props.running) return false
  return (props.results?.length ?? 0) > 0
})
const messagesOnly = computed(() => showMessagesPanel.value && !showResultsMain.value)

const normalizedResults = computed<QueryResultItem[]>(() => {
  if (isConsoleMode.value) return props.results ?? []
  return [
    {
      id: 'single',
      label: props.resultLabel ?? t('queryResult.resultTab', {n: 1}),
      sql: '',
      columns: props.columns ?? [],
      rows: props.rows ?? [],
      total: props.total ?? 0,
      where: props.where,
      orderBy: props.orderBy,
      durationMs: 0,
      status: 'success' as const,
      cursorTrimmedRows: props.cursorTrimmedRows,
    },
  ]
})

const {
  menuVisible,
  menuPos,
  menuItems,
  closeMenu,
  onMenuSelect,
  onTabContextMenu,
} = useClosableTabMenu<number>(
    (index) => getResultTabMenu(t, {
      canCompareWithPrevious: canCompareWithPrevious(index),
      canCrossEnvCompare: canCrossEnvCompare(index),
      canSuggestIndex: props.enableAiIndexSuggest
          && Boolean(normalizedResults.value[index]?.explainPlan?.length),
    }),
    () => ({
      close: (index) => emit('close-result', index),
      closeOthers: (index) => emit('close-other-results', index),
      closeAll: () => emit('close-all-results'),
      compareWithPrevious: (index) => compareWithPrevious(index),
      'cross-env-compare': (index) => emit('open-cross-env-compare', index),
      'suggest-index': (index) => requestIndexSuggest(index),
    }),
)

/** 仅 SQL 控制台（有编辑区 + 多结果）需要结果 Tab 栏；直接打开表数据时不显示 */
const showTabBar = computed(() => isConsoleMode.value)

const currentView = computed({
  get: () => {
    if (props.activeView !== undefined) return props.activeView
    return 0
  },
  set: (value: number) => emit('update:activeView', value),
})

const activeTabId = computed<string | null>(() => {
  const item = normalizedResults.value[currentView.value]
  return item?.id ?? null
})

const tabsSignature = computed(() => normalizedResults.value.map((item) => item.id).join(','))

const overflowItems = computed(() =>
    normalizedResults.value.map((item) => ({id: item.id, label: item.label})),
)

const activeResult = computed(() => {
  const index = currentView.value
  return normalizedResults.value[index] ?? null
})

const messageLogEntries = computed<MessageLogEntry[]>(() => {
  const entries: MessageLogEntry[] = []
  let statementNo = 0
  normalizedResults.value.forEach((item, resultIndex) => {
    if (item.batchEntries?.length) {
      for (const [batchIndex, entry] of item.batchEntries.entries()) {
        statementNo += 1
        entries.push({
          key: `${item.id}-batch-${batchIndex}`,
          resultIndex,
          statementNo,
          sql: entry.sql,
          status: entry.status,
          durationMs: entry.durationMs,
          errorMessage: entry.errorMessage,
        })
      }
      return
    }
    statementNo += 1
    entries.push({
      key: item.id,
      resultIndex,
      statementNo,
      sql: item.sql,
      status: item.status,
      durationMs: item.durationMs,
      errorMessage: item.errorMessage,
    })
  })
  return entries
})

const generateDmlOpen = ref(false)
const generateDmlRows = ref<TableRow[]>([])
const diffMode = ref<{ baselineIndex: number; currentIndex: number } | null>(null)

function canCompareWithPrevious(index: number): boolean {
    if (!pluginStore.isEnabled('p-result-diff')) return false
    if (index <= 0) return false
    const previous = normalizedResults.value[index - 1]
    const current = normalizedResults.value[index]
    return canCompareQueryResults(previous, current)
}

function canCrossEnvCompare(index: number): boolean {
    if (!props.enableCrossEnvCompare) return false
    const current = normalizedResults.value[index]
    if (!current || current.status !== 'success') return false
    if (current.batchEntries?.length || current.explainPlan?.length) return false
    if (!current.columns.length || !current.sql?.trim()) return false
    return true
}

const activeDiffView = computed(() => {
    if (!diffMode.value) return null
    if (currentView.value !== diffMode.value.currentIndex) return null
    const baseline = normalizedResults.value[diffMode.value.baselineIndex]
    const current = normalizedResults.value[diffMode.value.currentIndex]
    if (!baseline || !current) return null
    return buildQueryResultDiff(baseline, current)
})

function compareWithPrevious(index: number) {
    if (!canCompareWithPrevious(index)) {
        layout.showErrorToast(t('queryResult.diffUnavailable'))
        return
    }
    diffMode.value = {baselineIndex: index - 1, currentIndex: index}
    currentView.value = index
    tabBarRef.value?.ensureActiveTabVisible()
}

function exitDiffMode() {
    diffMode.value = null
}

function requestIndexSuggest(index?: number) {
    const targetIndex = index ?? (typeof currentView.value === 'number' ? currentView.value : -1)
    const result = normalizedResults.value[targetIndex]
    if (!result?.sql?.trim() || !result.explainPlan?.length) return
    emit('request-index-suggest', {sql: result.sql, explainPlan: result.explainPlan})
}

const canRequestIndexSuggest = computed(() =>
    props.enableAiIndexSuggest
    && Boolean(activeResult.value?.explainPlan?.length && activeResult.value.sql?.trim()),
)

const canGenerateDml = computed(() => {
  if (!props.enableDmlGenerate || !activeResult.value) return false
  return activeResult.value.status === 'success'
      && activeResult.value.columns.length > 0
      && activeResult.value.rows.length > 0
      && !activeResult.value.explainPlan?.length
})

const canShowFakeData = computed(() => {
  if (!props.enableFakeData) return false
  if (!pluginStore.isEnabled('p-fake-data')) return false
  const columns = props.columnDetails?.length ? props.columnDetails : activeResult.value?.columns
  return Boolean(columns?.length)
})

function onGenerateDml(rows: TableRow[]) {
  generateDmlRows.value = rows
  generateDmlOpen.value = true
}

function inferTableFromSql(sql: string): string | undefined {
  const match = sql.match(/\bFROM\s+(?:`([^`]+)`|"([^"]+)"|(\w+))/i)
  return match?.[1] ?? match?.[2] ?? match?.[3]
}

const generateDmlTableName = computed(
    () => inferTableFromSql(activeResult.value?.sql ?? '') ?? 'query_result',
)

const gridScope = computed(() => {
  if (props.gridStateScope?.trim()) return props.gridStateScope
  if (activeResult.value?.status === 'success' && activeResult.value.columns.length > 0) {
    return `result:${activeResult.value.id}`
  }
  return null
})

const {viewState} = useGridViewState(gridScope)

const batchSummaryStats = computed(() => {
  const result = activeResult.value
  if (!result?.batchEntries) return null
  return {
    count: result.batchEntries.length,
    totalRows: result.batchEntries.reduce((sum, entry) => sum + entry.total, 0),
    totalDuration: result.batchEntries.reduce((sum, entry) => sum + entry.durationMs, 0),
    total: result.batchTotal ?? result.batchEntries.length,
    running: Boolean(result.batchRunning),
  }
})

function isSlowQueryDuration(durationMs: number) {
  return isSlowDurationMs(durationMs, editorSettings.settings.slowQueryThresholdMs)
}

watch(tabsSignature, () => {
  diffMode.value = null
})

watch(currentView, (view) => {
  if (diffMode.value && view !== diffMode.value.currentIndex) {
    diffMode.value = null
  }
})

watch(
    () => activeResult.value?.batchEntries?.length,
    () => {
      if (!activeResult.value?.batchRunning) return
      requestAnimationFrame(() => {
        const node = batchSummaryRef.value
        if (!node) return
        node.scrollTop = node.scrollHeight
      })
    },
)

function setViewByTabId(tabId: string) {
  const index = normalizedResults.value.findIndex((item) => item.id === tabId)
  if (index >= 0) currentView.value = index
}

function handleTabSelect(tabId: string) {
  setViewByTabId(tabId)
  tabBarRef.value?.ensureActiveTabVisible()
}

function selectResult(index: number) {
  currentView.value = index
  tabBarRef.value?.ensureActiveTabVisible()
}

function closeResult(index: number) {
  emit('close-result', index)
}

function onExported(fileName: string) {
  layout.startExport(fileName)
}

function onRefresh() {
  const index = currentView.value
  const payload = resolveQueryResultRefreshRequest(activeResult.value, index)
  if (payload) emit('refresh', payload)
}

function onRefreshGrid() {
  if (isConsoleMode.value) {
    onRefresh()
    return
  }
  emit('refresh')
}

const exportBaseName = computed(() => {
  if (activeResult.value?.label) return activeResult.value.label.replace(/\s+/g, '_')
  return props.exportName?.replace(/\.[^.]+$/, '') ?? 'query_result'
})

const exportTableName = computed(() => {
  const label = activeResult.value?.label ?? ''
  const match = label.match(/Result\s*(\d+)/i)
  if (match) return `query_result_${match[1]}`
  return exportBaseName.value
})

function jumpToErrorLine(lineNumber: number) {
  emit('jump-to-error-line', lineNumber)
}

const activeResultIndex = computed(() => currentView.value)

const gridHasMore = computed(() => {
  if (props.resultHasMore != null) return props.resultHasMore
  return Boolean(activeResult.value?.hasMore && activeResult.value?.cursorId)
})

const gridCursorLoading = computed(() => props.cursorLoading ?? false)

const gridCursorTrimmedRows = computed(
    () => props.cursorTrimmedRows ?? activeResult.value?.cursorTrimmedRows ?? 0,
)

function onLoadMoreRows() {
  if (activeResultIndex.value < 0) {
    emit('load-more', 0)
    return
  }
  emit('load-more', activeResultIndex.value)
}

function onRequestAiFix() {
  const result = activeResult.value
  if (!result?.sql?.trim() || !result.errorMessage?.trim()) return
  emit('request-ai-fix', {
    sql: result.sql,
    errorMessage: result.errorMessage,
    errorLine: result.errorLine,
  })
}

const canRequestAiSummary = computed(() => {
  if (!props.enableAiSummary || diffMode.value) return false
  const result = activeResult.value
  if (!result || result.status !== 'success') return false
  if (result.explainPlan?.length || result.batchEntries?.length) return false
  return result.columns.length > 0
})

function onRequestAiSummary() {
  if (!canRequestAiSummary.value) return
  emit('request-ai-summary')
}

const canRequestAiExplain = computed(() => {
  if (!props.enableAiExplain || diffMode.value) return false
  const result = activeResult.value
  return Boolean(result?.explainPlan?.length && result.sql?.trim())
})

function onRequestAiExplain() {
  if (!canRequestAiExplain.value) return
  emit('request-ai-explain')
}

watch(
    () => [props.running, props.results?.length ?? 0] as const,
    ([isRunning, count]) => {
      if (!showMessagesPanel.value) return
      if (isRunning || count === 0) {
        messagesCollapsed.value = false
        return
      }
      messagesCollapsed.value = true
    },
    {immediate: true},
)
</script>

<template>
  <div
      class="result-pane"
      :class="{
        'result-pane--split': showMessagesPanel,
        'result-pane--messages-only': messagesOnly,
      }"
  >
    <template v-if="showMessagesPanel">
      <button
          v-if="messagesCollapsed && showResultsMain"
          type="button"
          class="messages-rail"
          :title="t('queryResult.messagesExpand')"
          @click="messagesCollapsed = false"
      >
        <span class="messages-rail__label">{{ t('queryResult.messages') }}</span>
        <DwIcon name="chevrons-right" size="sm" :stroke-width="1.75"/>
      </button>
      <aside
          v-else
          class="messages-panel"
          :class="{ 'messages-panel--full': messagesOnly }"
          :style="messagesOnly ? undefined : { width: `${messagesWidth}px` }"
      >
        <header class="messages-panel__head">
          <span class="messages-panel__title">{{ t('queryResult.messages') }}</span>
          <div class="messages-panel__actions">
            <button
                v-if="!messagesOnly"
                type="button"
                class="messages-panel__collapse"
                :title="t('queryResult.messagesCollapse')"
                @click="messagesCollapsed = true"
            >
              <DwIcon name="chevrons-left" size="xs" :stroke-width="1.75"/>
            </button>
            <CollapseButton
                v-if="collapsible && messagesOnly"
                @click="emit('collapse')"
            />
          </div>
        </header>
        <div class="messages-panel__sub">
          {{ t('queryResult.messagesAll', {count: messageLogEntries.length}) }}
        </div>
        <div class="messages-log">
          <p v-if="running && !messageLogEntries.length" class="messages-running">
            <span class="messages-running__spinner" aria-hidden="true"/>
            {{ t('queryResult.messagesRunning') }}
          </p>
          <p v-else-if="!messageLogEntries.length" class="messages-empty">
            {{ t('queryResult.messagesEmpty') }}
          </p>
          <button
              v-for="entry in messageLogEntries"
              :key="entry.key"
              type="button"
              class="messages-entry"
              :class="{
                'is-active': currentView === entry.resultIndex,
                'is-error': entry.status === 'error',
              }"
              @click="selectResult(entry.resultIndex)"
          >
            <div class="messages-entry__title">
              {{ t('queryResult.messageStatement', {n: entry.statementNo}) }}
            </div>
            <pre class="messages-entry__sql">{{ entry.sql || '—' }}</pre>
            <p
                class="messages-entry__status"
                :class="{ 'query-duration--slow': isSlowQueryDuration(entry.durationMs) }"
            >
              {{
                entry.status === 'error'
                  ? t('queryResult.messageFailed', {duration: entry.durationMs})
                  : t('queryResult.messageSuccess', {duration: entry.durationMs})
              }}
            </p>
            <pre
                v-if="entry.status === 'error' && entry.errorMessage"
                class="messages-entry__error"
            >{{ entry.errorMessage }}</pre>
            <p class="messages-entry__done">{{ t('queryResult.messageFinished') }}</p>
          </button>
        </div>
      </aside>
      <SplitHandle
          v-if="!messagesCollapsed && showResultsMain"
          v-model="messagesWidth"
          direction="vertical"
          :min="MESSAGES_WIDTH_MIN"
          :max="MESSAGES_WIDTH_MAX"
      />
    </template>

    <div v-if="showResultsMain" class="result-pane__main">
      <TabBar
          v-if="showTabBar"
          ref="tabBarRef"
          bar-class="result-tab-bar"
          :active-tab-id="activeTabId"
          :tabs-signature="tabsSignature"
          :overflow-items="overflowItems"
          :overflow-title="t('workspace.allTabs')"
          :overflow-search-placeholder="t('workspace.searchTabs')"
          @select="handleTabSelect"
      >
        <template #default="{ bindTabRef }">
          <TabItem
              v-for="(item, index) in normalizedResults"
              :key="item.id"
              :tab-id="item.id"
              :title="item.label"
              :active="currentView === index"
              :closable="closableResults"
              :set-ref="bindTabRef(item.id)"
              @select="handleTabSelect(item.id)"
              @close="closeResult(index)"
              @contextmenu="onTabContextMenu($event, index, closableResults)"
          >
            <template #leading>
              <span
                  v-if="item.batchRunning"
                  class="dw-tab__status dw-tab__status--running"
                  aria-hidden="true"
              />
              <span v-else-if="item.status === 'success'" class="dw-tab__status" aria-hidden="true">✓</span>
              <span
                  v-else-if="item.status === 'error'"
                  class="dw-tab__status dw-tab__status--error"
                  aria-hidden="true"
              >✕</span>
            </template>
          </TabItem>
        </template>
        <template v-if="collapsible" #actions>
          <CollapseButton @click="emit('collapse')"/>
        </template>
      </TabBar>

      <div
          v-if="activeResult?.batchEntries && batchSummaryStats"
          ref="batchSummaryRef"
          class="overview batch-summary"
      >
      <p v-if="activeResult.batchRunning" class="batch-running">
        <span class="batch-running__spinner" aria-hidden="true"/>
        {{
          t('queryResult.batchSummaryRunning', {
            current: batchSummaryStats.count,
            total: batchSummaryStats.total,
          })
        }}
      </p>
      <p v-if="activeResult.status === 'error' && !activeResult.batchRunning" class="error-title">
        {{ t('queryResult.errorTitle') }}
      </p>
      <p
          v-if="activeResult.status === 'error' && !activeResult.batchRunning && activeResult.errorMessage"
          class="error-message"
      >
        {{ activeResult.errorMessage }}
      </p>
      <div
          v-if="activeResult.status === 'error' && !activeResult.batchRunning && activeResult.errorLine"
          class="error-actions"
      >
        <button
            type="button"
            class="error-jump"
            @click="jumpToErrorLine(activeResult.errorLine!)"
        >
          {{ t('queryResult.jumpToLine', {line: activeResult.errorLine}) }}
        </button>
      </div>
      <p v-if="batchSummaryStats.count > 0" class="overview-head">
        {{
          t('queryResult.overviewSummaryPrefix', {
            count: batchSummaryStats.count,
            rows: batchSummaryStats.totalRows,
          })
        }}
        <span
            class="query-duration"
            :class="{ 'query-duration--slow': isSlowQueryDuration(batchSummaryStats.totalDuration) }"
        >{{ batchSummaryStats.totalDuration }}ms</span>{{ t('queryResult.overviewDurationSuffix') }}
      </p>
      <p v-else-if="activeResult.batchRunning" class="overview-empty">
        {{ t('queryResult.batchSummaryWaiting') }}
      </p>
      <ul v-if="batchSummaryStats.count > 0" class="overview-list">
        <li v-for="(entry, index) in activeResult.batchEntries" :key="index">
          <div class="overview-item overview-item--static">
            <span
                class="overview-ok"
                :class="{ 'overview-err': entry.status === 'error' }"
                aria-hidden="true"
            >{{ entry.status === 'error' ? '✕' : '✓' }}</span>
            <span class="overview-meta">
              {{
                t('queryResult.overviewItemPrefix', {
                  label: entry.label,
                  rows: entry.total,
                })
              }}
              <span
                  class="query-duration"
                  :class="{ 'query-duration--slow': isSlowQueryDuration(entry.durationMs) }"
              >{{ entry.durationMs }}ms</span>
            </span>
            <span class="overview-sql">{{ entry.sql }}</span>
          </div>
          <pre v-if="entry.status === 'error' && entry.errorMessage" class="batch-entry-error">{{
              entry.errorMessage
            }}</pre>
        </li>
      </ul>
    </div>

    <div v-else-if="activeResult?.status === 'error'" class="error-pane">
      <div class="error-callout" role="alert">
        <div class="error-callout__icon" aria-hidden="true">
          <DwIcon name="alert-circle" size="md" :stroke-width="1.8"/>
        </div>
        <div class="error-callout__body">
          <p class="error-callout__title">{{ t('queryResult.errorTitle') }}</p>
          <pre class="error-callout__message">{{ activeResult.errorMessage }}</pre>
          <div v-if="(enableAiFix && activeResult.sql?.trim() && activeResult.errorMessage) || activeResult.errorLine" class="error-callout__actions">
            <button
                v-if="enableAiFix && activeResult.sql?.trim() && activeResult.errorMessage"
                type="button"
                class="error-ai-fix"
                :disabled="aiFixLoading"
                @click="onRequestAiFix"
            >
              <DwIcon name="ai" size="xs" :stroke-width="1.5"/>
              <span>{{ aiFixLoading ? t('queryResult.aiFixLoading') : t('queryResult.aiFix') }}</span>
            </button>
            <button
                v-if="activeResult.errorLine"
                type="button"
                class="error-jump"
                @click="jumpToErrorLine(activeResult.errorLine!)"
            >
              {{ t('queryResult.jumpToLine', {line: activeResult.errorLine}) }}
            </button>
          </div>
        </div>
      </div>
      <details v-if="activeResult.sql?.trim()" class="error-sql" open>
        <summary class="error-sql__summary">
          <DwIcon class="error-sql__chevron" name="chevron-down" size="xs" :stroke-width="1.5"/>
          <span>{{ t('queryResult.failedSql') }}</span>
        </summary>
        <pre class="error-sql__code">{{ activeResult.sql }}</pre>
      </details>
    </div>

    <div v-else-if="activeResult?.explainPlan?.length" class="explain-plan-pane">
      <QueryResultAiSummaryPanel
          :open="!!aiExplainOpen"
          :loading="!!aiExplainLoading"
          :text="aiExplainText ?? ''"
          :title="t('queryResult.aiExplainTitle')"
          :loading-label="t('queryResult.aiExplainLoading')"
          :copy-label="t('queryResult.aiSummaryCopy')"
          :copied-label="t('queryResult.aiSummaryCopiedShort')"
          :copied-toast="t('queryResult.aiExplainCopied')"
          @close="emit('close-ai-explain')"
      />
      <ExplainPlanTree
          :nodes="activeResult.explainPlan"
          :sql="activeResult.sql"
          :db-type="dbType"
          :explain-mode="activeResult.explainMode"
          :enable-ai-explain="canRequestAiExplain"
          :ai-explain-loading="aiExplainLoading"
          @suggest-indexes="requestIndexSuggest()"
          @request-ai-explain="onRequestAiExplain"
      />
    </div>

    <QueryResultDiffPanel
        v-else-if="activeDiffView"
        :diff="activeDiffView"
        @exit="exitDiffMode"
    />

    <div v-else-if="activeResult" class="result-grid-pane">
      <QueryResultAiSummaryPanel
          :open="!!aiSummaryOpen"
          :loading="!!aiSummaryLoading"
          :text="aiSummaryText ?? ''"
          @close="emit('close-ai-summary')"
      />
      <DataGrid
          v-model:view-state="viewState"
          :columns="activeResult.columns"
          :rows="activeResult.rows"
          :total="activeResult.total"
          :where="activeResult.where"
          :order-by="activeResult.orderBy"
          :show-filter="showFilter"
          :export-base-name="exportBaseName"
          :export-table-name="exportTableName"
          :suggest-export-mask="exportSuggestMask"
          :editable="editable"
          :read-only-hint="readOnlyHint"
          :can-delete="canDelete"
          :can-update="canUpdate"
          :column-details="columnDetails"
          :pk-columns="pkColumns"
          :table-auto-increment="tableAutoIncrement"
          :on-submit-changes="onSubmitChanges"
          :show-dml-actions="canGenerateDml"
          :show-export="showExport"
          :enable-row-document-view="enableRowDocumentView"
          full-toolbar
          :has-more="gridHasMore"
          :cursor-loading="gridCursorLoading"
          :cursor-trimmed-rows="gridCursorTrimmedRows"
          :production-perf-active="props.productionPerfActive"
          @exported="onExported"
          @refresh="onRefreshGrid"
          @load-more="onLoadMoreRows"
          @generate-dml="onGenerateDml"
      >
        <template v-if="canShowFakeData || canRequestAiSummary" #toolbar-extra>
          <button
              v-if="canShowFakeData"
              type="button"
              class="result-toolbar-btn"
              @click="emit('generate-fake-data')"
          >
            {{ t('workspace.fakeData.toolbar') }}
          </button>
          <button
              v-if="canRequestAiSummary"
              type="button"
              class="result-toolbar-btn result-toolbar-btn--ai"
              :disabled="aiSummaryLoading"
              @click="onRequestAiSummary"
          >
            {{ aiSummaryLoading ? t('queryResult.aiSummaryLoading') : t('queryResult.aiSummary') }}
          </button>
        </template>
      </DataGrid>
    </div>

    <div v-else-if="showMessagesPanel" class="result-main-empty">
      {{ t('queryResult.messagesEmpty') }}
    </div>
    </div>
  </div>

  <GenerateDmlDialog
      v-if="activeResult"
      v-model:open="generateDmlOpen"
      :columns="activeResult.columns"
      :rows="generateDmlRows"
      :default-table-name="generateDmlTableName"
  />

  <ContextMenuHost
      v-if="showTabBar"
      :visible="menuVisible"
      :items="menuItems"
      :x="menuPos.x"
      :y="menuPos.y"
      @select="onMenuSelect"
      @close="closeMenu"
  />
</template>

<style scoped>
.result-pane {
  display: flex;
  flex-direction: column;
  height: 100%;
  min-height: 0;
  background: var(--dw-bg-editor);
}

.result-pane--split {
  flex-direction: row;
  align-items: stretch;
}

.result-pane--messages-only .messages-panel--full {
  flex: 1;
  width: auto;
  border-right: none;
}

.result-pane__main {
  display: flex;
  flex-direction: column;
  flex: 1;
  min-width: 0;
  min-height: 0;
  height: 100%;
}

.messages-rail {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: flex-end;
  gap: var(--dw-space-3);
  flex-shrink: 0;
  width: var(--dw-icon-size-lg);
  min-width: var(--dw-icon-size-lg);
  padding: var(--dw-space-5) 0;
  border-right: 1px solid var(--dw-panel-border);
  background: var(--dw-bg-muted);
  color: var(--dw-text-secondary);
}

.messages-rail:hover {
  color: var(--dw-primary);
  background: var(--dw-bg-hover);
}

.messages-rail__label {
  writing-mode: vertical-rl;
  text-orientation: mixed;
  font-size: var(--dw-tab-title-size);
  line-height: var(--dw-tab-title-line);
  letter-spacing: 0.12em;
}

.messages-panel {
  display: flex;
  flex-direction: column;
  flex-shrink: 0;
  min-width: 0;
  min-height: 0;
  height: 100%;
  border-right: 1px solid var(--dw-panel-border);
  background: var(--dw-bg-muted);
}

.messages-panel__head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--dw-space-3);
  height: var(--dw-tab-height);
  padding: 0 var(--dw-space-4);
  border-bottom: 1px solid var(--dw-panel-border);
  background: var(--dw-tab-bar-bg);
}

.messages-panel__title {
  font-size: var(--dw-text-sm);
  font-weight: 600;
  color: var(--dw-text);
}

.messages-panel__actions {
  display: inline-flex;
  align-items: center;
  gap: var(--dw-space-1);
}

.messages-panel__collapse {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: var(--dw-icon-size-md);
  height: var(--dw-icon-size-md);
  border-radius: var(--dw-radius-xs);
  color: var(--dw-text-secondary);
}

.messages-panel__collapse:hover {
  background: var(--dw-tab-hover-bg);
  color: var(--dw-text);
}

.messages-panel__sub {
  padding: var(--dw-space-2) var(--dw-space-4);
  border-bottom: 1px solid var(--dw-border-light);
  background: var(--dw-bg-panel);
  color: var(--dw-text-secondary);
  font-size: var(--dw-text-xs);
}

.messages-log {
  flex: 1;
  min-height: 0;
  overflow: auto;
  padding: var(--dw-space-4);
}

.messages-empty,
.messages-running,
.result-main-empty {
  margin: 0;
  padding: var(--dw-space-6);
  color: var(--dw-text-muted);
  font-size: var(--dw-text-sm);
}

.messages-running {
  display: flex;
  align-items: center;
  gap: var(--dw-space-3);
}

.messages-running__spinner {
  width: var(--dw-icon-size-xs);
  height: var(--dw-icon-size-xs);
  border: 2px solid color-mix(in srgb, var(--dw-link) 25%, transparent);
  border-top-color: var(--dw-link);
  border-radius: 50%;
  animation: batch-spin 0.8s linear infinite;
  flex-shrink: 0;
}

.result-main-empty {
  flex: 1;
}

.messages-entry {
  display: block;
  width: 100%;
  margin: 0 0 var(--dw-space-5);
  padding: var(--dw-space-4);
  border: 1px solid transparent;
  border-radius: var(--dw-control-radius-sm);
  background: var(--dw-bg);
  color: inherit;
  text-align: left;
  cursor: pointer;
}

.messages-entry:hover {
  border-color: var(--dw-border);
  background: var(--dw-bg-panel);
}

.messages-entry.is-active {
  border-color: color-mix(in srgb, var(--dw-primary) 35%, var(--dw-border));
  box-shadow: inset 2px 0 0 var(--dw-primary);
}

.messages-entry__title {
  margin-bottom: var(--dw-space-2);
  color: var(--dw-text);
  font-size: var(--dw-text-sm);
  font-weight: 600;
}

.messages-entry__sql {
  margin: 0 0 var(--dw-space-3);
  padding: 0;
  color: var(--dw-text);
  font-family: var(--dw-mono);
  font-size: var(--dw-text-xs);
  line-height: var(--dw-leading-relaxed);
  white-space: pre-wrap;
  word-break: break-word;
}

.messages-entry__status {
  margin: 0 0 var(--dw-space-1);
  color: var(--dw-text-secondary);
  font-size: var(--dw-text-xs);
}

.messages-entry.is-error .messages-entry__status {
  color: var(--dw-danger-fg);
}

.messages-entry__error {
  margin: 0 0 var(--dw-space-2);
  padding: var(--dw-space-2) var(--dw-space-3);
  border-radius: var(--dw-radius-xs);
  background: var(--dw-danger-soft);
  color: var(--dw-danger-fg);
  font-family: var(--dw-mono);
  font-size: var(--dw-text-2xs);
  white-space: pre-wrap;
  word-break: break-word;
}

.messages-entry__done {
  margin: 0;
  color: var(--dw-text-muted);
  font-size: var(--dw-text-xs);
}

.result-tab-bar {
  padding: 0 var(--dw-space-2);
}

.overview {
  flex: 1;
  min-height: 0;
  overflow: auto;
  padding: var(--dw-space-6) var(--dw-space-8);
  color: var(--dw-text-secondary);
  font-size: var(--dw-text-md);
}

.overview-head {
  margin: 0 0 var(--dw-space-5);
  color: var(--dw-text);
}

.query-duration--slow {
  color: var(--dw-danger);
  font-weight: 600;
}

.overview-empty {
  margin: 0;
  color: var(--dw-text-muted);
}

.result-grid-pane {
  display: flex;
  flex-direction: column;
  flex: 1;
  min-height: 0;
}

.explain-plan-pane {
  display: flex;
  flex-direction: column;
  flex: 1;
  min-height: 0;
}

.explain-plan-pane :deep(.explain-plan) {
  flex: 1;
  min-height: 0;
  overflow: auto;
}

.explain-plan-pane :deep(.result-ai-summary) {
  margin: var(--dw-space-4) var(--dw-space-6) 0;
}

.result-toolbar-btn {
  display: inline-flex;
  align-items: center;
  height: var(--dw-btn-height);
  padding: 0 var(--dw-space-5);
  flex-shrink: 0;
  border: 1px solid var(--dw-border);
  border-radius: var(--dw-control-radius-sm);
  background: var(--dw-bg-subtle);
  color: var(--dw-text);
  font-size: var(--dw-text-sm);
  white-space: nowrap;
}

.result-toolbar-btn:hover:not(:disabled) {
  background: var(--dw-bg-hover);
  border-color: var(--dw-border-strong);
}

.result-toolbar-btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.result-toolbar-btn--ai {
  border-color: color-mix(in srgb, var(--dw-primary) 14%, var(--dw-border));
  background: var(--dw-primary-softer);
}

.result-toolbar-btn--ai:hover:not(:disabled) {
  background: var(--dw-primary-soft);
  border-color: var(--dw-primary-ring);
  color: var(--dw-primary);
}

.result-grid-pane :deep(.data-grid),
.result-grid-pane :deep(.data-grid__dw-shell) {
  flex: 1;
  min-height: 0;
}

.overview-list {
  list-style: none;
  margin: 0;
  padding: 0;
}

.overview-item {
  display: flex;
  align-items: center;
  gap: var(--dw-gap);
  width: 100%;
  padding: var(--dw-pad-control);
  border: 1px solid var(--dw-border-light);
  border-radius: var(--dw-control-radius-sm);
  background: var(--dw-bg-panel);
  text-align: left;
  color: inherit;
}

.overview-list li + li {
  margin-top: var(--dw-space-3);
}

.overview-item:hover {
  border-color: var(--dw-border);
  background: var(--dw-bg-hover);
}

.overview-item--static {
  cursor: default;
}

.overview-item--static:hover {
  border-color: var(--dw-border-light);
  background: var(--dw-bg-panel);
}

.batch-entry-error {
  margin: var(--dw-space-3) 0 0;
  padding: var(--dw-pad-control);
  border-radius: var(--dw-control-radius-sm);
  background: color-mix(in srgb, var(--dw-danger) 8%, var(--dw-bg-panel));
  border: 1px solid color-mix(in srgb, var(--dw-danger) 25%, transparent);
  white-space: pre-wrap;
  word-break: break-word;
  font-family: var(--dw-font-mono);
  font-size: var(--dw-text-sm);
  line-height: var(--dw-leading-relaxed);
  color: var(--dw-text);
}

.batch-running {
  display: flex;
  align-items: center;
  gap: var(--dw-gap);
  margin: 0 0 var(--dw-space-5);
  color: var(--dw-text);
  font-weight: 500;
}

.batch-running__spinner,
.dw-tab__status--running {
  width: var(--dw-icon-size-xs);
  height: var(--dw-icon-size-xs);
  border: 2px solid color-mix(in srgb, var(--dw-link) 25%, transparent);
  border-top-color: var(--dw-link);
  border-radius: 50%;
  animation: batch-spin 0.8s linear infinite;
  flex-shrink: 0;
}

.dw-tab__status--running {
  width: var(--dw-icon-size-xs);
  height: var(--dw-icon-size-xs);
}

@keyframes batch-spin {
  to {
    transform: rotate(360deg);
  }
}

.overview-ok {
  flex-shrink: 0;
  color: var(--dw-success);
  font-weight: 700;
}

.overview-err {
  color: var(--dw-danger);
}

.batch-summary .error-title {
  margin: 0 0 var(--dw-space-4);
  font-weight: 600;
  color: var(--dw-danger);
}

.batch-summary .error-message {
  margin: 0 0 var(--dw-space-6);
  padding: var(--dw-pad-control-lg);
  border-radius: var(--dw-control-radius-sm);
  background: color-mix(in srgb, var(--dw-danger) 8%, var(--dw-bg-panel));
  border: 1px solid color-mix(in srgb, var(--dw-danger) 25%, transparent);
  white-space: pre-wrap;
  word-break: break-word;
  font-family: var(--dw-font-mono);
  font-size: var(--dw-text-sm);
  line-height: var(--dw-leading-relaxed);
}

.batch-summary .error-actions {
  display: flex;
  flex-wrap: wrap;
  gap: var(--dw-gap);
  margin-bottom: var(--dw-space-6);
}

.error-pane {
  flex: 1;
  min-height: 0;
  overflow: auto;
  padding: var(--dw-space-7) var(--dw-space-8) var(--dw-space-8);
  color: var(--dw-text);
  display: flex;
  flex-direction: column;
  gap: var(--dw-space-6);
}

.error-callout {
  display: flex;
  align-items: flex-start;
  gap: var(--dw-space-6);
  padding: var(--dw-space-7) var(--dw-space-7) var(--dw-space-6);
  border-radius: var(--dw-radius-lg);
  border: 1px solid color-mix(in srgb, var(--dw-danger) 28%, var(--dw-border-light));
  border-left: 3px solid var(--dw-danger);
  background: color-mix(in srgb, var(--dw-danger) 7%, var(--dw-bg-panel));
  box-shadow: 0 1px 0 color-mix(in srgb, var(--dw-danger) 10%, transparent);
}

.error-callout__icon {
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  width: 28px;
  height: var(--dw-btn-height);
  border-radius: var(--dw-radius-pill);
  background: color-mix(in srgb, var(--dw-danger) 14%, transparent);
  color: var(--dw-danger);
}

.error-callout__body {
  flex: 1;
  min-width: 0;
}

.error-callout__title {
  margin: 0 0 var(--dw-space-3);
  font-size: var(--dw-text-md);
  font-weight: 700;
  letter-spacing: 0.01em;
  color: var(--dw-danger);
}

.error-callout__message {
  margin: 0;
  white-space: pre-wrap;
  word-break: break-word;
  font-family: var(--dw-font-mono);
  font-size: var(--dw-text-sm);
  line-height: var(--dw-leading-loose);
  color: var(--dw-text);
}

.error-callout__actions {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: var(--dw-gap);
  margin-top: var(--dw-space-6);
}

.error-ai-fix {
  display: inline-flex;
  align-items: center;
  gap: var(--dw-gap-sm);
  padding: var(--dw-space-3) var(--dw-space-6);
  border: 1px solid color-mix(in srgb, var(--dw-primary) 24%, var(--dw-border));
  border-radius: var(--dw-control-radius-sm);
  background: var(--dw-primary-softer);
  color: var(--dw-text);
  cursor: pointer;
  font-size: var(--dw-text-sm);
  font-weight: 600;
  transition: var(--dw-transition-colors);
}

.error-ai-fix:hover:not(:disabled) {
  background: var(--dw-primary-soft);
  border-color: var(--dw-primary-ring);
  color: var(--dw-primary);
}

.error-ai-fix:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.error-jump {
  padding: var(--dw-space-3) var(--dw-space-5);
  border: 1px solid transparent;
  border-radius: var(--dw-control-radius-sm);
  background: transparent;
  color: var(--dw-text-secondary);
  cursor: pointer;
  font-size: var(--dw-text-sm);
  transition: background var(--dw-duration-fast) var(--dw-ease), color var(--dw-duration-fast) var(--dw-ease);
}

.error-jump:hover {
  background: color-mix(in srgb, var(--dw-text) 6%, transparent);
  color: var(--dw-text);
}

.error-sql {
  border: 1px solid var(--dw-border-light);
  border-radius: var(--dw-control-radius);
  background: color-mix(in srgb, var(--dw-bg-panel) 90%, var(--dw-bg));
  overflow: hidden;
}

.error-sql__summary {
  display: flex;
  align-items: center;
  gap: var(--dw-gap-sm);
  padding: var(--dw-space-4) var(--dw-space-6);
  color: var(--dw-text-secondary);
  font-size: var(--dw-text-xs);
  font-weight: 600;
  letter-spacing: 0.03em;
  text-transform: uppercase;
  cursor: pointer;
  list-style: none;
  user-select: none;
}

.error-sql__summary::-webkit-details-marker {
  display: none;
}

.error-sql__chevron {
  flex-shrink: 0;
  color: var(--dw-text-muted);
  transition: transform var(--dw-duration) var(--dw-ease);
}

.error-sql[open] .error-sql__chevron {
  transform: rotate(180deg);
}

.error-sql__code {
  margin: 0;
  padding: var(--dw-space-5) var(--dw-space-6) var(--dw-space-6);
  border-top: 1px solid var(--dw-border-light);
  white-space: pre-wrap;
  word-break: break-word;
  font-family: var(--dw-font-mono);
  font-size: var(--dw-text-sm);
  line-height: var(--dw-leading-loose);
  color: var(--dw-text-secondary);
}

.overview-meta {
  flex-shrink: 0;
  color: var(--dw-text);
  font-size: var(--dw-text-sm);
}

.overview-sql {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-family: var(--dw-font-mono);
  font-size: var(--dw-text-sm);
  color: var(--dw-text-muted);
}
</style>
