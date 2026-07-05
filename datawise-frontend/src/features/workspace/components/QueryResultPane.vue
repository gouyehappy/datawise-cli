<script setup lang="ts">
import {computed, ref, watch} from 'vue'
import {useI18n} from 'vue-i18n'
import {CollapseButton} from '@/core/components'
import {DwIcon} from '@/core/icons'
import {ContextMenuHost} from '@/core/context-menu'
import TabBar from '@/core/components/TabBar.vue'
import TabItem from '@/core/components/TabItem.vue'
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

const OVERVIEW_TAB_ID = 'overview'

const {t} = useI18n()

const props = withDefaults(
    defineProps<{
      results?: QueryResultItem[]
      activeView?: 'overview' | number
      alwaysShowOverview?: boolean
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
    }>(),
    {
      showFilter: true,
      alwaysShowOverview: false,
      closableResults: false,
      exportName: 'query_result.csv',
      editable: false,
      canDelete: false,
      canUpdate: false,
      columnDetails: () => [],
      pkColumns: () => [],
      enableDmlGenerate: false,
      showExport: true,
    },
)

const emit = defineEmits<{
  'update:activeView': ['overview' | number]
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
}>()

const layout = useLayoutStore()
const pluginStore = usePluginStore()
const editorSettings = useEditorSettingsStore()
const tabBarRef = ref<InstanceType<typeof TabBar>>()
const batchSummaryRef = ref<HTMLElement | null>(null)

const isConsoleMode = computed(() => props.results !== undefined)

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

const showOverviewTab = computed(() => {
  if (normalizedResults.value.some((item) => item.batchEntries != null)) return false
  return props.alwaysShowOverview || normalizedResults.value.length > 1
})

const currentView = computed({
  get: () => {
    if (props.activeView !== undefined) return props.activeView
    return showOverviewTab.value ? 'overview' : 0
  },
  set: (value: 'overview' | number) => emit('update:activeView', value),
})

const activeTabId = computed<string | null>(() => {
  if (currentView.value === 'overview') return OVERVIEW_TAB_ID
  const item = normalizedResults.value[currentView.value as number]
  return item?.id ?? null
})

const tabsSignature = computed(() => normalizedResults.value.map((item) => item.id).join(','))

const overflowItems = computed(() => {
  const items = []
  if (showOverviewTab.value) {
    items.push({id: OVERVIEW_TAB_ID, label: t('queryResult.overview')})
  }
  for (const item of normalizedResults.value) {
    items.push({id: item.id, label: item.label})
  }
  return items
})

const activeResult = computed(() => {
  if (currentView.value === 'overview') return null
  const index = currentView.value as number
  return normalizedResults.value[index] ?? null
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
        layout.showToast(t('queryResult.diffUnavailable'))
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

const overviewSummary = computed(() => {
  const items = normalizedResults.value
  const totalRows = items.reduce((sum, item) => sum + item.total, 0)
  const totalDuration = items.reduce((sum, item) => sum + item.durationMs, 0)
  return {count: items.length, totalRows, totalDuration}
})

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
  if (tabId === OVERVIEW_TAB_ID) {
    currentView.value = 'overview'
    return
  }
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
  if (currentView.value === 'overview') return
  const index = currentView.value as number
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

const activeResultIndex = computed(() =>
    currentView.value === 'overview' ? -1 : (currentView.value as number),
)

const gridHasMore = computed(() => {
  if (props.resultHasMore != null) return props.resultHasMore
  return Boolean(activeResult.value?.hasMore && activeResult.value?.cursorId)
})

const gridCursorLoading = computed(() => props.cursorLoading ?? false)

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
</script>

<template>
  <div class="result-pane">
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
            v-if="showOverviewTab"
            :tab-id="OVERVIEW_TAB_ID"
            :title="t('queryResult.overview')"
            :active="currentView === 'overview'"
            :set-ref="bindTabRef(OVERVIEW_TAB_ID)"
            @select="handleTabSelect(OVERVIEW_TAB_ID)"
        />
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
            <span v-else-if="item.status === 'error'" class="dw-tab__status dw-tab__status--error"
                  aria-hidden="true">✕</span>
          </template>
        </TabItem>
      </template>
      <template v-if="collapsible" #actions>
        <CollapseButton @click="emit('collapse')"/>
      </template>
    </TabBar>

    <div v-if="currentView === 'overview'" class="overview">
      <p v-if="normalizedResults.length" class="overview-head">
        {{
          t('queryResult.overviewSummaryPrefix', {
            count: overviewSummary.count,
            rows: overviewSummary.totalRows,
          })
        }}
        <span
            class="query-duration"
            :class="{ 'query-duration--slow': isSlowQueryDuration(overviewSummary.totalDuration) }"
        >{{ overviewSummary.totalDuration }}ms</span>{{ t('queryResult.overviewDurationSuffix') }}
      </p>
      <p v-else class="overview-empty">{{ t('queryResult.overviewEmpty') }}</p>
      <ul v-if="normalizedResults.length" class="overview-list">
        <li v-for="(item, index) in normalizedResults" :key="item.id">
          <button class="overview-item" type="button" @click="selectResult(index)">
            <span
                class="overview-ok"
                :class="{ 'overview-err': item.status === 'error' }"
                aria-hidden="true"
            >{{ item.status === 'error' ? '✕' : '✓' }}</span>
            <span class="overview-meta">
              {{
                t('queryResult.overviewItemPrefix', {
                  label: item.label,
                  rows: item.total,
                })
              }}
              <span
                  class="query-duration"
                  :class="{ 'query-duration--slow': isSlowQueryDuration(item.durationMs) }"
              >{{ item.durationMs }}ms</span>
            </span>
            <span class="overview-sql">{{ item.sql }}</span>
          </button>
        </li>
      </ul>
    </div>

    <div
        v-else-if="activeResult?.batchEntries && batchSummaryStats"
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
          full-toolbar
          :has-more="gridHasMore"
          :cursor-loading="gridCursorLoading"
          @exported="onExported"
          @refresh="onRefreshGrid"
          @load-more="onLoadMoreRows"
          @generate-dml="onGenerateDml"
      >
        <template v-if="canRequestAiSummary" #toolbar-extra>
          <button
              type="button"
              class="result-ai-summary-btn"
              :disabled="aiSummaryLoading"
              @click="onRequestAiSummary"
          >
            {{ aiSummaryLoading ? t('queryResult.aiSummaryLoading') : t('queryResult.aiSummary') }}
          </button>
        </template>
      </DataGrid>
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

.result-tab-bar {
  padding: 0 4px;
}

.overview {
  flex: 1;
  min-height: 0;
  overflow: auto;
  padding: 12px 16px;
  color: var(--dw-text-secondary);
  font-size: 13px;
}

.overview-head {
  margin: 0 0 10px;
  color: var(--dw-text);
}

.query-duration--slow {
  color: rgb(239, 68, 68);
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
  margin: 8px 12px 0;
}

.result-ai-summary-btn {
  display: inline-flex;
  align-items: center;
  height: 28px;
  padding: 0 10px;
  flex-shrink: 0;
  border: 1px solid color-mix(in srgb, var(--dw-primary) 14%, var(--dw-border));
  border-radius: 6px;
  background: var(--dw-primary-softer);
  color: var(--dw-text);
  font-size: 12px;
  white-space: nowrap;
}

.result-ai-summary-btn:hover:not(:disabled) {
  background: var(--dw-primary-soft);
  border-color: var(--dw-primary-ring);
  color: var(--dw-primary);
}

.result-ai-summary-btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
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
  gap: 8px;
  width: 100%;
  padding: 8px 10px;
  border: 1px solid var(--dw-border-light);
  border-radius: 6px;
  background: var(--dw-bg-panel);
  text-align: left;
  color: inherit;
}

.overview-list li + li {
  margin-top: 6px;
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
  margin: 6px 0 0;
  padding: 8px 10px;
  border-radius: 6px;
  background: color-mix(in srgb, #ef4444 8%, var(--dw-bg-panel));
  border: 1px solid color-mix(in srgb, #ef4444 25%, transparent);
  white-space: pre-wrap;
  word-break: break-word;
  font-family: var(--dw-font-mono, ui-monospace, monospace);
  font-size: 12px;
  line-height: 1.5;
  color: var(--dw-text);
}

.batch-running {
  display: flex;
  align-items: center;
  gap: 8px;
  margin: 0 0 10px;
  color: var(--dw-text);
  font-weight: 500;
}

.batch-running__spinner,
.dw-tab__status--running {
  width: 12px;
  height: 12px;
  border: 2px solid color-mix(in srgb, var(--dw-accent, #0969da) 25%, transparent);
  border-top-color: var(--dw-accent, #0969da);
  border-radius: 50%;
  animation: batch-spin 0.8s linear infinite;
  flex-shrink: 0;
}

.dw-tab__status--running {
  width: 10px;
  height: 10px;
}

@keyframes batch-spin {
  to {
    transform: rotate(360deg);
  }
}

.overview-ok {
  flex-shrink: 0;
  color: #22c55e;
  font-weight: 700;
}

.overview-err {
  color: #ef4444;
}

.batch-summary .error-title {
  margin: 0 0 8px;
  font-weight: 600;
  color: #ef4444;
}

.batch-summary .error-message {
  margin: 0 0 12px;
  padding: 10px 12px;
  border-radius: 6px;
  background: color-mix(in srgb, #ef4444 8%, var(--dw-bg-panel));
  border: 1px solid color-mix(in srgb, #ef4444 25%, transparent);
  white-space: pre-wrap;
  word-break: break-word;
  font-family: var(--dw-font-mono, ui-monospace, monospace);
  font-size: 12px;
  line-height: 1.5;
}

.batch-summary .error-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-bottom: 12px;
}

.error-pane {
  flex: 1;
  min-height: 0;
  overflow: auto;
  padding: 14px 16px 16px;
  color: var(--dw-text);
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.error-callout {
  display: flex;
  align-items: flex-start;
  gap: 12px;
  padding: 14px 14px 12px;
  border-radius: 10px;
  border: 1px solid color-mix(in srgb, #ef4444 28%, var(--dw-border-light));
  border-left: 3px solid #ef4444;
  background: color-mix(in srgb, #ef4444 7%, var(--dw-bg-panel));
  box-shadow: 0 1px 0 color-mix(in srgb, #ef4444 10%, transparent);
}

.error-callout__icon {
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  width: 28px;
  height: 28px;
  border-radius: 999px;
  background: color-mix(in srgb, #ef4444 14%, transparent);
  color: #ef4444;
}

.error-callout__body {
  flex: 1;
  min-width: 0;
}

.error-callout__title {
  margin: 0 0 6px;
  font-size: 13px;
  font-weight: 700;
  letter-spacing: 0.01em;
  color: #ef4444;
}

.error-callout__message {
  margin: 0;
  white-space: pre-wrap;
  word-break: break-word;
  font-family: var(--dw-font-mono, ui-monospace, monospace);
  font-size: 12px;
  line-height: 1.55;
  color: var(--dw-text);
}

.error-callout__actions {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
  margin-top: 12px;
}

.error-ai-fix {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 6px 12px;
  border: 1px solid color-mix(in srgb, var(--dw-primary) 24%, var(--dw-border));
  border-radius: 7px;
  background: var(--dw-primary-softer);
  color: var(--dw-text);
  cursor: pointer;
  font-size: 12px;
  font-weight: 600;
  transition: background 0.12s ease, border-color 0.12s ease, color 0.12s ease;
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
  padding: 6px 10px;
  border: 1px solid transparent;
  border-radius: 7px;
  background: transparent;
  color: var(--dw-text-secondary);
  cursor: pointer;
  font-size: 12px;
  transition: background 0.12s ease, color 0.12s ease;
}

.error-jump:hover {
  background: color-mix(in srgb, var(--dw-text) 6%, transparent);
  color: var(--dw-text);
}

.error-sql {
  border: 1px solid var(--dw-border-light);
  border-radius: 8px;
  background: color-mix(in srgb, var(--dw-bg-panel) 90%, var(--dw-bg));
  overflow: hidden;
}

.error-sql__summary {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 8px 12px;
  color: var(--dw-text-secondary);
  font-size: 11px;
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
  transition: transform 0.15s ease;
}

.error-sql[open] .error-sql__chevron {
  transform: rotate(180deg);
}

.error-sql__code {
  margin: 0;
  padding: 10px 12px 12px;
  border-top: 1px solid var(--dw-border-light);
  white-space: pre-wrap;
  word-break: break-word;
  font-family: var(--dw-font-mono, ui-monospace, monospace);
  font-size: 12px;
  line-height: 1.55;
  color: var(--dw-text-secondary);
}

.overview-meta {
  flex-shrink: 0;
  color: var(--dw-text);
  font-size: 12px;
}

.overview-sql {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-family: var(--dw-font-mono, ui-monospace, monospace);
  font-size: 12px;
  color: var(--dw-text-muted);
}
</style>
