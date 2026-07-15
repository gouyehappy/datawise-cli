<script setup lang="ts">
import {computed, nextTick, ref, toRef, watch, watchEffect} from 'vue'
import {useDebouncedRef} from '@/core/utils/debounced-ref'
import {useGridVirtualWindow} from '@/core/composables/useGridVirtualWindow'
import {useI18n} from 'vue-i18n'
import IconButton from '@/core/components/IconButton.vue'
import DwDataGrid from '@/core/components/DwDataGrid.vue'
import {DwIcon} from '@/core/icons'
import GridCellDetailDialog from '@/core/components/GridCellDetailDialog.vue'
import type {SelectOption} from '@/core/components/select.types'
import {
  useGridPendingEdit,
  type GridDisplayRow,
  type GridPendingBatch,
} from '@/core/composables/useGridPendingEdit'
import type {TableColumn, TableRow} from '@/core/types'
import type {TableColumnDetail} from '@/shared/api/types'
import {columnRowKey, readRowCell} from '@/core/utils/query-result-column'
import {
  formatCellFullValue,
  formatCellPreviewValue,
  isExpandableCellValue,
} from '@/core/utils/cell-value-format'
import {
  applyGridViewStateToRows,
  cellMatchesFilter,
  clearGridViewState,
  compareCellValues,
  toggleGridSort,
  type GridViewState,
} from '@/features/workspace/services/grid-view-state.service'
import {
  downloadGridExport,
  type GridExportFormat,
  type GridExportOptions,
} from '@/features/workspace/services/grid-export.service'
import GridExportDialog from '@/features/workspace/components/GridExportDialog.vue'
import {usePluginStore} from '@/features/plugin/stores/plugin-store'
import {applyPluginRenderGrid} from '@/features/plugin/services/plugin-hook.service'
import {ContextMenuHost} from '@/core/context-menu'
import {useContextMenuAnchor} from '@/core/context-menu/useContextMenuAnchor'
import type {ContextMenuItem} from '@/core/types'
import {useLayoutStore} from '@/features/layout/stores/layout'
import {
  buildWhereEqualsClause,
  buildWhereInClause,
  readGridCellValue,
} from '@/features/workspace/services/grid-cell-context.service'
import {
  computeGridColumnStats,
  formatGridColumnStatsLines,
  type GridColumnStats,
} from '@/features/workspace/services/grid-column-stats.service'
import {CONSOLE_GRID_PAGE_SIZE_OPTIONS} from '@/features/settings/constants/editor-presets'
import {resolveGridPageSizeOption} from '@/features/settings/services/grid-pagination.service'
import {CURSOR_LOADED_ROWS_WARN_THRESHOLD} from '@/features/workspace/constants/query-result-limits'

const {t} = useI18n()
const pluginStore = usePluginStore()
const layout = useLayoutStore()

const renderedGrid = computed(() =>
    applyPluginRenderGrid(
        props.columns,
        props.rows,
        {
            connectionId: props.connectionId,
            database: props.database,
        },
        (pluginId) => pluginStore.isEnabled(pluginId),
    ),
)

const gridColumns = computed(() => renderedGrid.value.columns)
const gridRows = computed(() => renderedGrid.value.rows)

const props = withDefaults(
    defineProps<{
      columns: TableColumn[]
      rows: TableRow[]
      total?: number
      where?: string
      orderBy?: string
      showFilter?: boolean
      fullToolbar?: boolean
      exportBaseName?: string
      exportTableName?: string
      /** 生产环境等场景建议默认开启脱敏导出 */
      suggestExportMask?: boolean
      editable?: boolean
      /** 只读原因（数据源不支持 DML 等）；非 editable 时在工具栏下展示 */
      readOnlyHint?: string
      canDelete?: boolean
      canUpdate?: boolean
      columnDetails?: TableColumnDetail[]
      pkColumns?: string[]
      tableAutoIncrement?: string | null
      onSubmitChanges?: (batch: GridPendingBatch) => Promise<boolean>
      hasMore?: boolean
      cursorLoading?: boolean
      /** 滑动窗口丢弃的最早行数，用于行号顺延 */
      cursorTrimmedRows?: number
      /** 生产环境性能模式已收紧行数策略 */
      productionPerfActive?: boolean
      showDmlActions?: boolean
      connectionId?: string
      database?: string
      showExport?: boolean
    }>(),
    {
      total: 0,
      showFilter: false,
      fullToolbar: false,
      exportBaseName: 'query_result',
      editable: false,
      canDelete: false,
      canUpdate: false,
      columnDetails: () => [],
      pkColumns: () => [],
      showDmlActions: false,
      suggestExportMask: false,
      showExport: true,
    },
)

const pageSizeModel = ref(resolveGridPageSizeOption(CONSOLE_GRID_PAGE_SIZE_OPTIONS))
const currentPage = ref(1)
const pageSizeOptions = CONSOLE_GRID_PAGE_SIZE_OPTIONS
const exportDialogOpen = ref(false)
const exportSubmitting = ref(false)
const wrapCells = ref(false)
const cellDetailOpen = ref(false)
const cellDetail = ref<{ columnName: string; rowLabel: string; content: string } | null>(null)

const emit = defineEmits<{
  refresh: []
  exported: [fileName: string]
  'load-more': []
  'generate-dml': [rows: TableRow[]]
}>()

const viewState = defineModel<GridViewState>('viewState')

const columnFiltersEnabled = computed(() => viewState.value !== undefined)

const filterColumnOptions = computed(() => gridColumns.value.map((col) => col.name))

const filterColumnSelectOptions = computed<SelectOption[]>(() =>
    filterColumnOptions.value.map((name) => ({value: name, label: name})),
)

const filterColumnName = ref('')

watch(
    () => gridColumns.value,
    (columns) => {
        if (!columns.length) {
            filterColumnName.value = ''
            return
        }
        if (!filterColumnName.value || !columns.some((col) => col.name === filterColumnName.value)) {
            filterColumnName.value = columns[0].name
        }
    },
    {immediate: true},
)

function resolveFilterColumnKey(columnName: string): string {
    const column = gridColumns.value.find((col) => col.name === columnName)
    return column ? columnRowKey(column) : ''
}

const GRID_COLUMN_FILTER_DEBOUNCE_MS = 180
const filterDraft = ref('')
const debouncedFilterDraft = useDebouncedRef(filterDraft, GRID_COLUMN_FILTER_DEBOUNCE_MS)

function readFilterDraftFromViewState(): string {
    if (!viewState.value) return ''
    const columnKey = resolveFilterColumnKey(filterColumnName.value)
    if (!columnKey) return ''
    return viewState.value.columnFilters[columnKey] ?? ''
}

function applyFilterDraftToViewState(value: string) {
    if (!viewState.value) return
    const columnKey = resolveFilterColumnKey(filterColumnName.value)
    if (!columnKey) return
    const trimmed = value.trim()
    viewState.value = {
        ...viewState.value,
        columnFilters: trimmed ? {[columnKey]: value} : {},
    }
}

watch(filterColumnName, () => {
    filterDraft.value = readFilterDraftFromViewState()
}, {immediate: true})

watch(debouncedFilterDraft, (value) => {
    applyFilterDraftToViewState(value)
})

watchEffect(() => {
    if (!viewState.value) return
    const columnKey = resolveFilterColumnKey(filterColumnName.value)
    if (!columnKey) return
    const stored = viewState.value.columnFilters[columnKey] ?? ''
    if (stored !== debouncedFilterDraft.value && stored !== filterDraft.value) {
        filterDraft.value = stored
    }
})

const hasSortActive = computed(() =>
    Boolean(viewState.value?.sortColumn && viewState.value?.sortDirection),
)

const inlineEnabled = computed(() => props.editable && props.columnDetails.length > 0)

// 表数据编辑：本地暂存 + 批量保存（见 useGridPendingEdit）
const pendingEdit = useGridPendingEdit({
  columns: () => gridColumns.value,
  rows: () => gridRows.value,
  columnDetails: () => props.columnDetails,
  editable: () => inlineEnabled.value,
  pkColumns: () => props.pkColumns,
  tableAutoIncrement: () => props.tableAutoIncrement,
  onSubmit: async (batch) => props.onSubmitChanges?.(batch) ?? false,
})

const {
  displayRows,
  hasPendingChanges,
  pendingCount,
  submitting,
  selectedRowId,
  editingCell,
  cellInputRef,
  selectRow,
  isRowSelected,
  isRowModified,
  isRowPendingDelete,
  getCellDisplayText,
  isCellEditing,
  startEditCell,
  stopEditCell,
  setCellValue,
  addInsertRow,
  markDeleteSelected,
  submitPending,
  discardPending,
} = pendingEdit

const pageSize = computed(() => {
  const parsed = Number(pageSizeModel.value)
  if (Number.isFinite(parsed) && parsed > 0) return parsed
  return Number(resolveGridPageSizeOption(pageSizeOptions))
})

function readRawDisplayRowCell(item: GridDisplayRow, column: TableColumn): unknown {
  if (item.kind === 'insert') {
    const text = getCellDisplayText(item, column.name)
    return text === '' ? null : text
  }
  if (item.originalRow) return readRowCell(item.originalRow, column)
  return null
}

function filterAndSortDisplayRows(rows: GridDisplayRow[], state: GridViewState): GridDisplayRow[] {
  const activeFilters = Object.entries(state.columnFilters).filter(([, value]) => value.trim())
  let result = rows

  if (activeFilters.length) {
    result = result.filter((item) =>
        activeFilters.every(([columnKey, filter]) => {
          const column = gridColumns.value.find(
              (entry) => columnRowKey(entry) === columnKey || entry.name === columnKey,
          )
          if (!column) return true
          const value = readRawDisplayRowCell(item, column)
          const text = formatCellFullValue(value)
          return cellMatchesFilter(text, filter)
        }),
    )
  }

  if (state.sortColumn && state.sortDirection) {
    const column = gridColumns.value.find(
        (entry) => columnRowKey(entry) === state.sortColumn || entry.name === state.sortColumn,
    )
    if (column) {
      const direction = state.sortDirection === 'asc' ? 1 : -1
      result = [...result].sort(
          (left, right) =>
              compareCellValues(readRawDisplayRowCell(left, column), readRawDisplayRowCell(right, column))
              * direction,
      )
    }
  }

  return result
}

const viewFilteredDisplayRows = computed(() => {
  if (!columnFiltersEnabled.value || !viewState.value) return displayRows.value
  return filterAndSortDisplayRows(displayRows.value, viewState.value)
})

const totalPages = computed(() =>
    Math.max(1, Math.ceil(viewFilteredDisplayRows.value.length / pageSize.value)),
)

const displayTotal = computed(() => String(viewFilteredDisplayRows.value.length))

const loadedRowsWarning = computed(() =>
    gridRows.value.length >= CURSOR_LOADED_ROWS_WARN_THRESHOLD,
)

const cursorWindowTrimmed = computed(() => (props.cursorTrimmedRows ?? 0) > 0)

const pagedRows = computed(() => {
  const start = (currentPage.value - 1) * pageSize.value
  return viewFilteredDisplayRows.value.slice(start, start + pageSize.value)
})

const rowOffset = computed(
    () => (props.cursorTrimmedRows ?? 0) + (currentPage.value - 1) * pageSize.value,
)

const gridBodyRef = ref<HTMLElement | null>(null)
const pagedRowsRef = toRef(pagedRows)
const virtualScrollEnabled = computed(() => !wrapCells.value)
const {
  useVirtual: useGridVirtual,
  visibleRows: virtualPagedRows,
  paddingTop: virtualPaddingTop,
  paddingBottom: virtualPaddingBottom,
  scrollToRowIndex,
} = useGridVirtualWindow(gridBodyRef, pagedRowsRef, {enabled: virtualScrollEnabled})

const tableColumnCount = computed(() => gridColumns.value.length + 1)

const exportEnabled = computed(() => pluginStore.isEnabled('p-grid-export'))
const maskExportEnabled = computed(() => pluginStore.isEnabled('p-export-mask'))

function resolveExportRows(): TableRow[] {
  if (columnFiltersEnabled.value && viewState.value) {
    return applyGridViewStateToRows(gridRows.value, gridColumns.value, viewState.value)
  }
  return gridRows.value
}

const exportDialogRows = computed(() => resolveExportRows())

const deleteEnabled = computed(
    () => props.editable && props.canDelete && pendingEdit.selectedRowId.value != null && !submitting.value,
)

const submitEnabled = computed(
    () => inlineEnabled.value && hasPendingChanges.value && !submitting.value,
)

watch(
    () => props.rows,
    () => {
      currentPage.value = 1
    },
)

watch(pageSizeModel, () => {
  currentPage.value = 1
})

watch(currentPage, () => {
  gridBodyRef.value?.scrollTo({top: 0})
})

watch(totalPages, (pages) => {
  if (currentPage.value > pages) currentPage.value = pages
})

watch(displayRows, () => {
  if (currentPage.value > totalPages.value) {
    currentPage.value = totalPages.value
  }
})

watch(
    viewFilteredDisplayRows,
    () => {
      if (currentPage.value > totalPages.value) {
        currentPage.value = totalPages.value
      }
    },
)

watch(
    () => viewState.value,
    () => {
      currentPage.value = 1
    },
    {deep: true},
)

const showFilterBar = computed(() => props.showFilter && !!(props.where || props.orderBy))

function openExportDialog() {
  if (!exportEnabled.value || !gridColumns.value.length) return
  exportDialogOpen.value = true
}

async function onExportConfirm(payload: { format: GridExportFormat; mask?: GridExportOptions['mask'] }) {
  exportSubmitting.value = true
  try {
    const resolved = await downloadGridExport(
        gridColumns.value,
        exportDialogRows.value,
        payload.format,
        props.exportBaseName,
        props.exportTableName,
        {mask: payload.mask},
    )
    emit('exported', resolved)
  } finally {
    exportSubmitting.value = false
  }
}

function onGenerateDmlClick() {
  emit('generate-dml', resolveExportRows())
}

function onHeaderSort(columnKey: string) {
  if (!viewState.value) return
  viewState.value = toggleGridSort(viewState.value, columnKey)
}

function sortIndicator(columnKey: string): string | null {
  if (!viewState.value || viewState.value.sortColumn !== columnKey || !viewState.value.sortDirection) {
    return null
  }
  return viewState.value.sortDirection === 'asc' ? '↑' : '↓'
}

function clearViewState() {
  if (!viewState.value) return
  viewState.value = clearGridViewState()
  filterDraft.value = ''
}

async function onAddRowClick() {
  addInsertRow()
  await nextTick()
  currentPage.value = totalPages.value // 新增行在列表末尾
  await nextTick()
  cellInputRef.value?.focus()
  if (useGridVirtual.value) {
    scrollToRowIndex(pagedRows.value.length - 1)
    return
  }
  gridBodyRef.value?.scrollTo({ top: gridBodyRef.value.scrollHeight, behavior: 'smooth' })
}

/** v-for 下多个 input 时，只把当前编辑格绑定到 cellInputRef 用于 focus */
function bindEditingInput(
    el: unknown,
    item: typeof displayRows.value[number],
    columnName: string,
) {
  if (!(el instanceof HTMLInputElement)) return
  const editing = editingCell.value
  if (editing?.rowId === item.id && editing.column === columnName) {
    cellInputRef.value = el
  }
}

function isCellInputVisible(item: typeof displayRows.value[number], columnName: string) {
  // 新增行始终显示输入框；已有行仅双击的单元格进入编辑
  return item.kind === 'insert' || isCellEditing(item, columnName)
}

/** 底层占位文字：编辑时用透明 span 撑住列宽，避免切换 input 时表格抖动 */
function cellBackingText(item: typeof displayRows.value[number], columnName: string) {
  const column = gridColumns.value.find((col) => col.name === columnName)
  if (!column) return ''
  if (item.kind === 'insert' || isCellInputVisible(item, columnName)) {
    const text = getCellDisplayText(item, columnName)
    if (text) return text
    if (item.kind === 'insert') return '\u00a0'
    return t('common.nullValue')
  }
  const preview = formatCellPreviewValue(readRawDisplayRowCell(item, column))
  if (preview) return preview
  return t('common.nullValue')
}

function canExpandCell(item: typeof displayRows.value[number], column: TableColumn): boolean {
  return isExpandableCellValue(readRawDisplayRowCell(item, column))
}

function openCellDetail(item: typeof displayRows.value[number], column: TableColumn, rowIndex: number) {
  cellDetail.value = {
    columnName: column.name,
    rowLabel: `#${rowOffset.value + rowIndex + 1}`,
    content: formatCellFullValue(readRawDisplayRowCell(item, column)),
  }
  cellDetailOpen.value = true
}

function closeCellDetail() {
  cellDetailOpen.value = false
  cellDetail.value = null
}

function onCellExpandClick(
    event: MouseEvent,
    item: typeof displayRows.value[number],
    column: TableColumn,
    rowIndex: number,
) {
  event.stopPropagation()
  openCellDetail(item, column, rowIndex)
}

function onCellDblClick(
    item: typeof displayRows.value[number],
    columnName: string,
    event: MouseEvent,
    rowIndex: number,
) {
  const column = gridColumns.value.find((col) => col.name === columnName)
  if (!column) return
  const expandable = canExpandCell(item, column)
  if (event.altKey && expandable) {
    openCellDetail(item, column, rowIndex)
    return
  }
  if (!inlineEnabled.value || !props.canUpdate || item.pendingDelete) {
    if (expandable) openCellDetail(item, column, rowIndex)
    return
  }
  void startEditCell(item, columnName)
}

function onDeleteRowClick() {
  markDeleteSelected()
}

async function onSubmitClick() {
  await submitPending()
}

function onDiscardClick() {
  discardPending()
}

function toggleWrapCells() {
  wrapCells.value = !wrapCells.value
}

function onCellInput(item: typeof displayRows.value[number], columnName: string, value: string) {
  setCellValue(item, columnName, value)
}

function onCellKeydownEnter(event: KeyboardEvent) {
  event.preventDefault()
  stopEditCell()
}

const activeCell = ref<{ rowId: string; column: string } | null>(null)

watch(selectedRowId, (rowId) => {
  if (!rowId) activeCell.value = null
})

watch(hasPendingChanges, (pending) => {
  if (!pending) activeCell.value = null
})

function onIndexColClick(item: typeof displayRows.value[number]) {
  if (!inlineEnabled.value) return
  selectRow(item)
  activeCell.value = null
}

function onCellClick(item: typeof displayRows.value[number], columnName: string) {
  if (!inlineEnabled.value) return
  selectRow(item)
  activeCell.value = {rowId: item.id, column: columnName}
}

function isCellActive(item: typeof displayRows.value[number], columnName: string) {
  const cell = activeCell.value
  return cell?.rowId === item.id && cell.column === columnName
}

function onCellInputBlur(item: typeof displayRows.value[number]) {
  if (item.kind !== 'insert') stopEditCell()
}

function onInsertCellFocus(item: typeof displayRows.value[number], columnName: string) {
  if (item.kind !== 'insert') return
  selectRow(item)
  activeCell.value = {rowId: item.id, column: columnName}
  editingCell.value = {rowId: item.id, column: columnName}
}

const {
  visible: cellMenuVisible,
  pos: cellMenuPos,
  target: cellMenuTarget,
  open: openCellMenu,
  close: closeCellMenu,
} = useContextMenuAnchor<{ item: GridDisplayRow; column: TableColumn }>()

const cellMenuItems = computed<ContextMenuItem[]>(() => [
  {id: 'copy-cell', label: t('dataGrid.contextMenu.copyCell')},
  {id: 'copy-where-equals', label: t('dataGrid.contextMenu.copyWhereEquals')},
  {id: 'copy-where-in', label: t('dataGrid.contextMenu.copyWhereIn')},
])

function onCellContextMenu(event: MouseEvent, item: GridDisplayRow, column: TableColumn) {
  event.preventDefault()
  openCellMenu(event, {item, column})
}

function resolveContextPageRows(): TableRow[] {
  return pagedRows.value
      .filter((row) => row.kind !== 'insert' && row.originalRow)
      .map((row) => row.originalRow!)
}

async function copyGridContextText(
    text: string,
    toastKey: 'copied' | 'whereCopied' | 'statsCopied',
) {
  if (!text.trim()) return
  await navigator.clipboard.writeText(text)
  layout.showToast(t(`dataGrid.contextMenu.${toastKey}`))
}

async function onCellMenuSelect(id: string) {
  const target = cellMenuTarget.value
  closeCellMenu()
  if (!target) return
  const {item, column} = target
  const cellValue = item.originalRow ? readGridCellValue(item.originalRow, column) : null

  if (id === 'copy-cell') {
    await copyGridContextText(formatCellFullValue(cellValue), 'copied')
    return
  }
  if (id === 'copy-where-equals') {
    await copyGridContextText(buildWhereEqualsClause(column.name, cellValue), 'whereCopied')
    return
  }
  if (id === 'copy-where-in') {
    const clause = buildWhereInClause(column.name, resolveContextPageRows(), column)
    if (clause) await copyGridContextText(clause, 'whereCopied')
  }
}

const {
  visible: headerMenuVisible,
  pos: headerMenuPos,
  target: headerMenuTarget,
  open: openHeaderMenu,
  close: closeHeaderMenu,
} = useContextMenuAnchor<TableColumn>()

const statsColumnName = ref<string | null>(null)

const headerMenuItems = computed<ContextMenuItem[]>(() => [
  {id: 'toggle-column-stats', label: t('dataGrid.contextMenu.toggleColumnStats')},
  {id: 'copy-column-stats', label: t('dataGrid.contextMenu.copyColumnStats')},
])

function resolveStatsRows(): TableRow[] {
  return viewFilteredDisplayRows.value
      .filter((row) => row.kind !== 'insert' && row.originalRow)
      .map((row) => row.originalRow!)
}

const activeColumnStats = computed<GridColumnStats | null>(() => {
  const name = statsColumnName.value
  if (!name) return null
  const column = gridColumns.value.find((entry) => entry.name === name)
  if (!column) return null
  return computeGridColumnStats(column, resolveStatsRows())
})

function onHeaderContextMenu(event: MouseEvent, column: TableColumn) {
  event.preventDefault()
  openHeaderMenu(event, column)
}

async function onHeaderMenuSelect(id: string) {
  const column = headerMenuTarget.value
  closeHeaderMenu()
  if (!column) return

  if (id === 'toggle-column-stats') {
    statsColumnName.value = statsColumnName.value === column.name ? null : column.name
    return
  }

  if (id === 'copy-column-stats') {
    const stats = computeGridColumnStats(column, resolveStatsRows())
    await copyGridContextText(formatGridColumnStatsLines(stats).join('\n'), 'statsCopied')
  }
}

function dismissColumnStats() {
  statsColumnName.value = null
}
</script>

<template>
  <div class="data-grid" :class="{ 'is-wrap-cells': wrapCells }">
    <DwDataGrid
        shell-only
        v-model:current-page="currentPage"
        v-model:page-size="pageSizeModel"
        v-model:filter="filterDraft"
        v-model:filter-column="filterColumnName"
        :rows="[]"
        :columns="[]"
        :selectable="false"
        :show-search="columnFiltersEnabled"
        column-filter
        :filter-column-options="filterColumnSelectOptions"
        :show-pagination="fullToolbar"
        :total-count="Number(displayTotal)"
        :page-size-options="pageSizeOptions"
        :labels="{ total: t('dataGrid.total', { count: displayTotal }) }"
        class="data-grid__dw-shell"
    >
      <template #toolbar-actions>
        <template v-if="!fullToolbar">
          <span class="page-indicator page-indicator--solo">{{ currentPage }}</span>
          <span class="pager-total">{{ t('dataGrid.total', {count: displayTotal}) }}</span>
        </template>
        <IconButton
            class="grid-action-neutral"
            :active="wrapCells"
            :title="wrapCells ? t('dataGrid.unwrapCells') : t('dataGrid.wrapCells')"
            @click="toggleWrapCells"
        >
          <DwIcon class="grid-glyph" name="format" fit :stroke-width="1.35"/>
        </IconButton>
        <template v-if="fullToolbar">
          <IconButton class="grid-action-neutral" :title="t('dataGrid.refresh')" @click="emit('refresh')">
            <DwIcon class="grid-glyph" name="refresh" fit :stroke-width="1.35"/>
          </IconButton>
          <button
              v-if="columnFiltersEnabled && hasSortActive"
              class="clear-filters-btn"
              type="button"
              @click="clearViewState"
          >
            {{ t('dataGrid.clearFilters') }}
          </button>
        </template>
      </template>

      <template v-if="fullToolbar" #toolbar-end>
        <span v-if="loadedRowsWarning" class="loaded-rows-hint">
          {{ t('dataGrid.loadedRowsWarning', {count: gridRows.length}) }}
        </span>
        <span v-if="cursorWindowTrimmed" class="loaded-rows-hint">
          {{ t('dataGrid.cursorWindowTrimmed', {count: cursorTrimmedRows ?? 0}) }}
        </span>
        <span v-if="productionPerfActive" class="loaded-rows-hint">
          {{ t('dataGrid.productionPerfActive') }}
        </span>
        <button
            v-if="hasMore"
            class="load-more-btn"
            type="button"
            :disabled="cursorLoading"
            @click="emit('load-more')"
        >
          {{ cursorLoading ? t('dataGrid.loadingMore') : t('dataGrid.loadMore') }}
        </button>
        <template v-if="editable">
          <span class="action-divider"/>
          <IconButton
              class="grid-action-save"
              :title="t('dataGrid.submitChanges', { count: pendingCount })"
              :disabled="!submitEnabled"
              @click="onSubmitClick"
          >
            <DwIcon class="grid-glyph grid-glyph--save" name="submit" fit :stroke-width="1.5"/>
          </IconButton>
          <IconButton
              class="grid-action-cancel"
              :title="t('dataGrid.discardChanges')"
              :disabled="!hasPendingChanges || submitting"
              @click="onDiscardClick"
          >
            <DwIcon class="grid-glyph grid-glyph--cancel" name="rollback" fit :stroke-width="1.35"/>
          </IconButton>
          <IconButton class="grid-action-neutral" :title="t('dataGrid.addRow')" @click="onAddRowClick">
            <DwIcon class="grid-glyph" name="plus" fit :stroke-width="1.5"/>
          </IconButton>
          <IconButton
              class="grid-action-neutral"
              :title="t('dataGrid.deleteRow')"
              :disabled="!deleteEnabled"
              @click="onDeleteRowClick"
          >
            <DwIcon class="grid-glyph" name="minus" fit :stroke-width="1.5"/>
          </IconButton>
          <span
              v-if="inlineEnabled"
              class="grid-hint-tip"
              :title="t('dataGrid.editHint')"
              :aria-label="t('dataGrid.editHint')"
          >
            <DwIcon class="grid-glyph" name="explain" fit :stroke-width="1.35"/>
          </span>
        </template>
        <span
            v-if="readOnlyHint && !editable"
            class="grid-hint-tip"
            :title="readOnlyHint"
            :aria-label="readOnlyHint"
        >
          <DwIcon class="grid-glyph" name="explain" fit :stroke-width="1.35"/>
        </span>
        <span v-if="showDmlActions" class="action-divider"/>
        <IconButton
            v-if="showDmlActions"
            class="grid-action-neutral"
            :title="t('dataGrid.generateDml')"
            @click="onGenerateDmlClick"
        >
          <DwIcon class="grid-glyph" name="ddl" fit :stroke-width="1.35"/>
        </IconButton>
        <span v-if="$slots['toolbar-extra']" class="action-divider"/>
        <slot name="toolbar-extra"/>
        <button
            v-if="exportEnabled && showExport"
            class="export-btn"
            type="button"
            :title="t('dataGrid.export')"
            @click="openExportDialog"
        >
          <DwIcon name="export" size="sm" :stroke-width="1.6"/>
          <span>{{ t('dataGrid.export') }}</span>
        </button>
      </template>

      <template #body>
        <div v-if="activeColumnStats" class="grid-column-stats">
          <div class="grid-column-stats__head">
            <span class="grid-column-stats__title">
              {{ t('dataGrid.columnStatsTitle', {column: activeColumnStats.columnName}) }}
            </span>
            <span class="grid-column-stats__scope">{{ t('dataGrid.columnStatsScope') }}</span>
            <button class="grid-column-stats__close" type="button" @click="dismissColumnStats">
              {{ t('common.close') }}
            </button>
          </div>
          <div class="grid-column-stats__body">
            <span class="grid-column-stats__pill">
              {{ t('dataGrid.columnStatsRows', {count: activeColumnStats.rowCount}) }}
            </span>
            <span class="grid-column-stats__pill">
              {{ t('dataGrid.columnStatsNulls', {count: activeColumnStats.nullCount}) }}
            </span>
            <span class="grid-column-stats__pill">
              {{ t('dataGrid.columnStatsDistinct', {count: activeColumnStats.distinctCount}) }}
            </span>
            <span
                v-if="activeColumnStats.numericMin !== undefined && activeColumnStats.numericMax !== undefined"
                class="grid-column-stats__pill"
            >
              {{ t('dataGrid.columnStatsRange', {
                min: activeColumnStats.numericMin,
                max: activeColumnStats.numericMax,
              }) }}
            </span>
            <span v-if="activeColumnStats.numericAvg !== undefined" class="grid-column-stats__pill">
              {{ t('dataGrid.columnStatsAvg', {value: activeColumnStats.numericAvg.toFixed(2)}) }}
            </span>
            <span
                v-for="item in activeColumnStats.topValues"
                :key="`${item.value}:${item.count}`"
                class="grid-column-stats__pill grid-column-stats__pill--muted"
            >
              {{ item.value }} × {{ item.count }}
            </span>
          </div>
        </div>

        <div v-if="showFilterBar" class="filter-bar">
          <div class="filter-left">
            <DwIcon class="filter-icon" name="filter" size="xs" :stroke-width="1.6"/>
            <span class="keyword">WHERE</span>
            <span v-if="where" class="expr">{{ where }}</span>
          </div>
          <div class="filter-right">
            <span class="keyword">ORDER BY</span>
            <DwIcon class="sort-icon" name="arrow-up-down" size="xs" :stroke-width="1.4"/>
            <span v-if="orderBy" class="expr">{{ orderBy }}</span>
          </div>
        </div>

        <div ref="gridBodyRef" class="grid-body">
      <table class="grid-table">
        <colgroup>
          <col class="col-index"/>
          <col v-for="col in columns" :key="columnRowKey(col)" class="col-data"/>
        </colgroup>
        <thead>
        <tr>
          <th class="index-col">#</th>
          <th
              v-for="col in columns"
              :key="columnRowKey(col)"
              :class="{
                'is-sortable': columnFiltersEnabled,
                'is-sorted': viewState?.sortColumn === columnRowKey(col),
                'is-stats-active': statsColumnName === col.name,
              }"
              @click="columnFiltersEnabled ? onHeaderSort(columnRowKey(col)) : undefined"
              @contextmenu="onHeaderContextMenu($event, col)"
          >
            <span class="th-label">{{ col.name }}</span>
            <span v-if="sortIndicator(columnRowKey(col))" class="th-sort">{{ sortIndicator(columnRowKey(col)) }}</span>
          </th>
        </tr>
        </thead>
        <tbody>
        <tr v-if="useGridVirtual && virtualPaddingTop > 0" class="grid-virtual-spacer" aria-hidden="true">
          <td :colspan="tableColumnCount" :style="{ height: `${virtualPaddingTop}px`, padding: 0, border: 'none' }"/>
        </tr>
        <tr
            v-for="{ item, index: rowIndex } in virtualPagedRows"
            :key="item.id"
            :class="{
              'is-selected': isRowSelected(item),
              'is-modified': isRowModified(item),
              'is-insert-row': item.kind === 'insert',
              'is-pending-delete': isRowPendingDelete(item),
              'is-selectable-row': inlineEnabled,
            }"
        >
          <td class="index-col index-col--selectable" @click="onIndexColClick(item)">
            {{ rowOffset + rowIndex + 1 }}
          </td>
          <td
              v-for="col in columns"
              :key="columnRowKey(col)"
              class="data-cell"
              :class="{
                'is-cell-active': isCellActive(item, col.name) && item.kind !== 'insert',
                'is-cell-editing': isCellInputVisible(item, col.name),
              }"
              @click="onCellClick(item, col.name)"
              @dblclick="onCellDblClick(item, col.name, $event, rowIndex)"
              @contextmenu="onCellContextMenu($event, item, col)"
          >
            <div class="cell-shell" :class="{ 'has-expand': canExpandCell(item, col) }">
              <button
                  v-if="canExpandCell(item, col) && !isCellInputVisible(item, col.name)"
                  class="cell-expand-btn"
                  type="button"
                  :title="t('dataGrid.viewCellDetail')"
                  @click="onCellExpandClick($event, item, col, rowIndex)"
              >
                <DwIcon name="open-external" size="xs" :stroke-width="1.4"/>
              </button>
              <!-- 透明 span 占位 + 绝对定位 input，避免编辑时列宽变化 -->
                <span
                    class="cell-text"
                    :class="{
                    null: !getCellDisplayText(item, col.name) && item.kind !== 'insert',
                    'cell-text--backing': isCellInputVisible(item, col.name),
                  }"
                    aria-hidden="true"
                >
                  {{ cellBackingText(item, col.name) }}
                </span>
              <input
                  v-show="isCellInputVisible(item, col.name)"
                  :ref="(el) => bindEditingInput(el, item, col.name)"
                  class="cell-input"
                  type="text"
                  :value="getCellDisplayText(item, col.name)"
                  @input="onCellInput(item, col.name, ($event.target as HTMLInputElement).value)"
                  @keydown.enter="onCellKeydownEnter"
                  @blur="onCellInputBlur(item)"
                  @focus="onInsertCellFocus(item, col.name)"
                  @click.stop
              />
            </div>
          </td>
        </tr>
        <tr v-if="useGridVirtual && virtualPaddingBottom > 0" class="grid-virtual-spacer" aria-hidden="true">
          <td :colspan="tableColumnCount" :style="{ height: `${virtualPaddingBottom}px`, padding: 0, border: 'none' }"/>
        </tr>
        </tbody>
      </table>
        </div>
      </template>
    </DwDataGrid>

    <GridCellDetailDialog
        :open="cellDetailOpen"
        :column-name="cellDetail?.columnName ?? ''"
        :row-label="cellDetail?.rowLabel ?? ''"
        :content="cellDetail?.content ?? ''"
        @close="closeCellDetail"
    />

    <ContextMenuHost
        :visible="cellMenuVisible"
        :x="cellMenuPos.x"
        :y="cellMenuPos.y"
        :items="cellMenuItems"
        @select="onCellMenuSelect"
        @close="closeCellMenu"
    />

    <ContextMenuHost
        :visible="headerMenuVisible"
        :x="headerMenuPos.x"
        :y="headerMenuPos.y"
        :items="headerMenuItems"
        @select="onHeaderMenuSelect"
        @close="closeHeaderMenu"
    />

    <GridExportDialog
        v-model:open="exportDialogOpen"
        :columns="columns"
        :suggest-mask="suggestExportMask"
        :mask-export-enabled="maskExportEnabled"
        :exporting="exportSubmitting"
        @export="onExportConfirm"
    />
  </div>
</template>

<style scoped>
.data-grid {
  display: flex;
  flex-direction: column;
  height: 100%;
  min-height: 0;
}

.data-grid__dw-shell {
  flex: 1;
  min-height: 0;
}

.data-grid :deep(.dw-data-grid__toolbar-left .grid-action-neutral.dw-icon-btn),
.data-grid :deep(.dw-data-grid__toolbar-right .grid-action-save.dw-icon-btn),
.data-grid :deep(.dw-data-grid__toolbar-right .grid-action-cancel.dw-icon-btn),
.data-grid :deep(.dw-data-grid__toolbar-right .grid-action-neutral.dw-icon-btn) {
  width: 30px;
  height: var(--dw-control-h-sm);
}

.data-grid :deep(.dw-data-grid__toolbar-right .grid-action-save.dw-icon-btn),
.data-grid :deep(.dw-data-grid__toolbar-right .grid-action-cancel.dw-icon-btn) {
  color: inherit;
}

.data-grid :deep(.dw-data-grid__toolbar-right .grid-action-save.dw-icon-btn:hover:not(:disabled)) {
  background: color-mix(in srgb, var(--dw-success) 10%, transparent);
  border-color: transparent;
}

.data-grid :deep(.dw-data-grid__toolbar-right .grid-action-cancel.dw-icon-btn:hover:not(:disabled)) {
  background: color-mix(in srgb, var(--dw-danger) 10%, transparent);
  border-color: transparent;
}

.data-grid :deep(.dw-data-grid__toolbar-right .grid-action-save.dw-icon-btn:disabled .grid-glyph--save),
.data-grid :deep(.dw-data-grid__toolbar-right .grid-action-cancel.dw-icon-btn:disabled .grid-glyph--cancel) {
  opacity: 0.42;
}

.data-grid :deep(.dw-data-grid__toolbar-left .grid-action-neutral.dw-icon-btn:hover:not(:disabled)),
.data-grid :deep(.dw-data-grid__toolbar-right .grid-action-neutral.dw-icon-btn:hover:not(:disabled)) {
  color: var(--dw-text-secondary);
}

.toolbar-filter {
  width: min(100%, 300px);
}

.grid-column-stats {
  flex-shrink: 0;
  padding: var(--dw-pad-control);
  border-bottom: 1px solid var(--dw-border-light);
  background: var(--dw-bg-muted);
}

.grid-column-stats__head {
  display: flex;
  align-items: center;
  gap: var(--dw-gap);
  margin-bottom: var(--dw-space-3);
}

.grid-column-stats__title {
  font-size: var(--dw-text-sm);
  font-weight: 600;
  color: var(--dw-text);
}

.grid-column-stats__scope {
  font-size: var(--dw-text-xs);
  color: var(--dw-text-muted);
}

.grid-column-stats__close {
  margin-left: auto;
  padding: var(--dw-pad-chip);
  border: 1px solid var(--dw-border-light);
  border-radius: var(--dw-control-radius-sm);
  background: var(--dw-bg);
  color: var(--dw-text-secondary);
  font-size: var(--dw-text-xs);
}

.grid-column-stats__body {
  display: flex;
  flex-wrap: wrap;
  gap: var(--dw-gap-sm);
}

.grid-column-stats__pill {
  display: inline-flex;
  align-items: center;
  padding: var(--dw-pad-chip);
  border-radius: var(--dw-radius-pill);
  border: 1px solid var(--dw-border-light);
  background: var(--dw-bg-panel);
  color: var(--dw-text-secondary);
  font-size: var(--dw-text-xs);
  line-height: var(--dw-leading);
}

.grid-column-stats__pill--muted {
  font-family: var(--dw-font-mono);
}

th.is-stats-active .th-label {
  color: var(--dw-primary);
}

.grid-toolbar--compact {
  display: none;
}

.filter-combo {
  width: 100%;
}

.action-divider {
  flex-shrink: 0;
  width: 1px;
  height: var(--dw-icon-size-lg);
  margin: 0 var(--dw-space-2);
  background: var(--dw-border);
}

.grid-hint-tip {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: var(--dw-btn-height);
  flex-shrink: 0;
  color: var(--dw-text-muted);
  cursor: help;
}

.grid-hint-tip:hover {
  color: var(--dw-text-secondary);
}

.data-grid :deep(.dw-data-grid__toolbar-right .grid-hint-tip) {
  width: 28px;
  height: var(--dw-btn-height);
}

.export-btn {
  display: inline-flex;
  align-items: center;
  gap: var(--dw-gap-sm);
  height: var(--dw-btn-height);
  padding: 0 var(--dw-space-5);
  flex-shrink: 0;
  border: 1px solid var(--dw-border);
  border-radius: var(--dw-control-radius-sm);
  color: var(--dw-text-secondary);
  font-size: var(--dw-text-sm);
  white-space: nowrap;
}

.pager-total {
  color: var(--dw-text-muted);
  font-size: var(--dw-text-sm);
  white-space: nowrap;
}

.grid-glyph {
  display: block;
  width: 20px;
  height: 20px;
  line-height: 1;
}

.grid-glyph--save {
  color: var(--dw-success);
}

.grid-glyph--cancel {
  color: var(--dw-danger);
}

.page-indicator--solo {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 32px;
  height: var(--dw-control-h-sm);
  padding: 0 var(--dw-space-3);
  border: 1px solid var(--dw-border);
  color: var(--dw-text);
  font-size: var(--dw-text-sm);
  font-weight: 500;
}

.filter-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--dw-space-8);
  height: var(--dw-btn-height);
  padding: 0 var(--dw-space-6);
  border-bottom: 1px solid var(--dw-border-light);
  background: var(--dw-bg-panel);
  font-size: var(--dw-text-sm);
}

.filter-combo__control {
  display: flex;
  align-items: center;
  width: 100%;
  height: var(--dw-btn-height);
  border: 1px solid var(--dw-border);
  border-radius: var(--dw-control-radius-sm);
  background: var(--dw-bg);
  transition: var(--dw-transition-colors);
}

.filter-combo.is-active .filter-combo__control {
  border-color: var(--dw-primary-border);
  background: color-mix(in srgb, var(--dw-primary-soft) 18%, var(--dw-bg));
}

.filter-combo__control:focus-within {
  border-color: var(--dw-primary-border);
  box-shadow: 0 0 0 2px var(--dw-primary-soft);
}

.filter-combo__select-wrap {
  position: relative;
  display: flex;
  align-items: center;
  flex-shrink: 0;
  max-width: 46%;
  height: var(--dw-control-h-xs);
  margin: var(--dw-space-1) 0 var(--dw-space-1) var(--dw-space-1);
  padding: 0 var(--dw-space-1);
  border-radius: var(--dw-radius-sm);
  background: var(--dw-bg-muted);
}

.filter-combo__select-wrap :deep(.dw-select) {
  height: 100%;
}

.filter-combo__divider {
  flex-shrink: 0;
  width: 1px;
  height: var(--dw-icon-size-md);
  margin: 0 var(--dw-space-1);
  background: var(--dw-border-light);
}

.filter-combo__search {
  flex-shrink: 0;
  margin-left: var(--dw-space-3);
  color: var(--dw-text-muted);
}

.filter-combo.is-active .filter-combo__search {
  color: var(--dw-primary);
}

.filter-combo__input {
  flex: 1;
  min-width: 0;
  height: 100%;
  padding: 0 var(--dw-space-3);
  border: none;
  background: transparent;
  color: var(--dw-text);
  font-size: var(--dw-text-sm);
  outline: none;
}

.filter-combo__input::placeholder {
  color: var(--dw-text-muted);
  font-size: var(--dw-text-xs);
}

.filter-combo__input::-webkit-search-cancel-button {
  display: none;
}

.filter-combo__clear {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  width: 20px;
  height: 20px;
  margin-right: var(--dw-space-2);
  border: none;
  border-radius: var(--dw-radius-sm);
  background: transparent;
  color: var(--dw-text-muted);
  cursor: pointer;
}

.filter-combo__clear:hover {
  background: var(--dw-bg-muted);
  color: var(--dw-text-secondary);
}

.filter-left,
.filter-right {
  display: inline-flex;
  align-items: center;
  gap: var(--dw-gap-sm);
  min-width: 0;
}

.filter-right {
  margin-left: auto;
}

.keyword {
  color: var(--dw-primary);
  font-weight: 600;
  font-size: var(--dw-text-xs);
}

.expr {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  color: var(--dw-text-secondary);
  font-family: var(--dw-mono);
  font-size: var(--dw-text-xs);
}

.grid-body {
  flex: 1;
  overflow: auto;
  min-height: 0;
}

tr.grid-virtual-spacer td {
  padding: 0 !important;
  border: none !important;
  line-height: 0;
  pointer-events: none;
}

table.grid-table {
  width: 100%;
  min-width: 100%;
  /* 固定列宽：编辑态叠加 input 时不因内容长短撑开列 */
  table-layout: fixed;
  border-collapse: collapse;
}

col.col-index {
  width: 48px;
}

col.col-data {
  width: 120px;
}

th,
td {
  height: var(--dw-control-h-sm);
  max-height: var(--dw-control-h-sm);
  padding: 0;
  border-bottom: 1px solid var(--dw-border-light);
  text-align: left;
  white-space: nowrap;
  font-size: var(--dw-text-sm);
  vertical-align: middle;
  overflow: hidden;
}

.index-col {
  width: 48px;
  padding: 0 var(--dw-space-4);
  color: var(--dw-text-muted);
  text-align: center;
  font-size: var(--dw-text-xs);
}

.index-col--selectable {
  cursor: pointer;
}

th {
  position: sticky;
  top: 0;
  z-index: 1;
  background: var(--dw-bg-muted);
  color: var(--dw-text-secondary);
  font-weight: 500;
  font-size: var(--dw-text-xs);
  padding: 0 var(--dw-space-4);
}

th.is-sortable {
  cursor: pointer;
  user-select: none;
}

th.is-sortable:hover {
  background: color-mix(in srgb, var(--dw-primary) 6%, var(--dw-bg-muted));
}

th.is-sorted .th-label {
  color: var(--dw-primary);
}

.th-sort {
  margin-left: var(--dw-space-2);
  color: var(--dw-primary);
  font-size: var(--dw-text-xs);
}

.clear-filters-btn {
  height: var(--dw-control-h-sm);
  padding: 0 var(--dw-space-4);
  border: 1px solid var(--dw-border-light);
  border-radius: var(--dw-control-radius-sm);
  background: var(--dw-bg-panel);
  color: var(--dw-text-secondary);
  font-size: var(--dw-text-xs);
  white-space: nowrap;
  cursor: pointer;
}

.loaded-rows-hint {
  max-width: 220px;
  margin-right: var(--dw-space-3);
  color: var(--dw-warning);
  font-size: var(--dw-text-xs);
  line-height: var(--dw-leading-snug);
  text-align: right;
}

.load-more-btn {
  height: var(--dw-control-h-sm);
  padding: 0 var(--dw-space-5);
  border: 1px solid color-mix(in srgb, var(--dw-primary) 28%, var(--dw-border-light));
  border-radius: var(--dw-control-radius-sm);
  background: color-mix(in srgb, var(--dw-primary) 8%, var(--dw-bg-panel));
  color: var(--dw-primary);
  font-size: var(--dw-text-xs);
  font-weight: 600;
  white-space: nowrap;
  cursor: pointer;
}

.load-more-btn:disabled {
  opacity: 0.6;
  cursor: wait;
}

.data-cell {
  cursor: default;
  position: relative;
  /* 配合 table-layout:fixed，让 ellipsis 按列宽截断 */
  max-width: 0;
}

.data-cell.is-cell-active .cell-shell {
  box-shadow: inset 0 0 0 2px color-mix(in srgb, var(--dw-text) 80%, transparent);
}

.data-cell.is-cell-editing .cell-shell {
  box-shadow: inset 0 0 0 2px var(--dw-primary);
}

.cell-shell {
  position: relative;
  display: block;
  height: var(--dw-control-h-sm);
  max-height: var(--dw-control-h-sm);
  min-width: 0;
  padding: 0 var(--dw-space-4);
  box-sizing: border-box;
  overflow: hidden;
}

.cell-text {
  display: block;
  height: var(--dw-control-h-sm);
  line-height: var(--dw-control-h-sm);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  user-select: text;
  cursor: text;
}

.cell-text--backing {
  /* 编辑时保留占位宽度，文字透明；用户看到的是上层 input */
  color: transparent;
  user-select: none;
  pointer-events: none;
}

.cell-text.null {
  color: var(--dw-text-muted);
  font-style: italic;
}

.cell-text.null.cell-text--backing {
  color: transparent;
}

.cell-input {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  margin: 0;
  padding: 0 var(--dw-space-4);
  border: none;
  border-radius: 0;
  background: var(--dw-bg-panel);
  color: var(--dw-text);
  font: inherit;
  line-height: var(--dw-control-h-sm);
  outline: none;
  box-sizing: border-box;
}

tbody tr.is-selected {
  background: color-mix(in srgb, var(--dw-primary) 10%, var(--dw-bg-editor));
}

tbody tr.is-pending-delete {
  background: color-mix(in srgb, var(--dw-danger) 12%, var(--dw-bg));
  color: var(--dw-danger-fg);
}

tbody tr.is-pending-delete .index-col,
tbody tr.is-pending-delete .cell-text.null {
  color: var(--dw-danger-fg);
}

tbody tr.is-pending-delete.is-selected {
  background: color-mix(in srgb, var(--dw-danger) 22%, var(--dw-bg));
}

tbody tr.is-modified {
  background: color-mix(in srgb, var(--dw-warning) 10%, var(--dw-bg-editor));
}

tbody tr.is-insert-row {
  background: color-mix(in srgb, var(--dw-success) 8%, var(--dw-bg-editor));
}

.data-grid.is-wrap-cells table.grid-table {
  table-layout: auto;
}

.data-grid.is-wrap-cells th,
.data-grid.is-wrap-cells td {
  height: auto;
  max-height: none;
  white-space: pre-wrap;
  word-break: break-word;
}

.data-grid.is-wrap-cells .data-cell {
  max-width: none;
}

.data-grid.is-wrap-cells .cell-shell {
  height: auto;
  max-height: none;
  min-height: var(--dw-control-h-sm);
  overflow: visible;
}

.data-grid.is-wrap-cells .cell-text {
  height: auto;
  line-height: var(--dw-leading);
  padding: var(--dw-space-2) 0;
  overflow: visible;
  text-overflow: unset;
  white-space: pre-wrap;
  word-break: break-word;
}

.cell-shell.has-expand {
  padding-right: var(--dw-space-10);
}

.cell-expand-btn {
  position: absolute;
  top: 50%;
  right: 2px;
  z-index: var(--dw-z-raised);
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 20px;
  height: 20px;
  margin: 0;
  padding: 0;
  border: 1px solid transparent;
  border-radius: var(--dw-radius-sm);
  background: transparent;
  color: var(--dw-text-muted);
  opacity: 0;
  transform: translateY(-50%);
  cursor: pointer;
}

.cell-shell.has-expand:hover .cell-expand-btn,
.cell-expand-btn:focus-visible {
  opacity: 1;
  border-color: var(--dw-border);
  background: var(--dw-bg-panel);
  color: var(--dw-primary);
}

.cell-expand-btn:hover {
  border-color: color-mix(in srgb, var(--dw-primary) 30%, var(--dw-border));
  background: color-mix(in srgb, var(--dw-primary) 8%, var(--dw-bg-panel));
}
</style>
