export type DashboardWidgetId =
    | 'quickActions'
    | 'connectionHealth'
    | 'onCallConnections'
    | 'recentSql'
    | 'openTabs'
    | 'savedConsoles'
    | 'enabledPlugins'
    | 'teamActivity'
    | 'recentAnalysis'

export type DashboardWidgetColumn = 'left' | 'main' | 'right'

export interface DashboardWidgetConfig {
    id: DashboardWidgetId
    column: DashboardWidgetColumn
    visible: boolean
}

export interface DashboardPreferences {
    widgets: DashboardWidgetConfig[]
}

export const DASHBOARD_WIDGET_IDS: DashboardWidgetId[] = [
    'quickActions',
    'connectionHealth',
    'onCallConnections',
    'recentSql',
    'openTabs',
    'savedConsoles',
    'enabledPlugins',
    'teamActivity',
    'recentAnalysis',
]

const DASHBOARD_WIDGET_COLUMNS: DashboardWidgetColumn[] = ['left', 'main', 'right']

export const DEFAULT_DASHBOARD_WIDGET_COLUMN: Record<DashboardWidgetId, DashboardWidgetColumn> = {
    quickActions: 'left',
    connectionHealth: 'left',
    onCallConnections: 'main',
    recentSql: 'main',
    openTabs: 'right',
    savedConsoles: 'right',
    enabledPlugins: 'right',
    teamActivity: 'right',
    recentAnalysis: 'main',
}

function isWidgetId(value: unknown): value is DashboardWidgetId {
    return typeof value === 'string' && DASHBOARD_WIDGET_IDS.includes(value as DashboardWidgetId)
}

function isWidgetColumn(value: unknown): value is DashboardWidgetColumn {
    return typeof value === 'string' && DASHBOARD_WIDGET_COLUMNS.includes(value as DashboardWidgetColumn)
}

export function createDefaultDashboardPreferences(): DashboardPreferences {
    return {
        widgets: DASHBOARD_WIDGET_IDS.map((id) => ({
            id,
            column: DEFAULT_DASHBOARD_WIDGET_COLUMN[id],
            visible: true,
        })),
    }
}

export function normalizeDashboardPreferences(
    raw: Partial<DashboardPreferences> | undefined,
): DashboardPreferences {
    const defaults = createDefaultDashboardPreferences()
    const byId = new Map<DashboardWidgetId, DashboardWidgetConfig>()
    for (const item of defaults.widgets) {
        byId.set(item.id, {...item})
    }

    if (Array.isArray(raw?.widgets)) {
        for (const item of raw.widgets) {
            if (!item || !isWidgetId(item.id)) continue
            const base = byId.get(item.id) ?? {
                id: item.id,
                column: DEFAULT_DASHBOARD_WIDGET_COLUMN[item.id],
                visible: true,
            }
            byId.set(item.id, {
                id: item.id,
                column: isWidgetColumn(item.column) ? item.column : base.column,
                visible: typeof item.visible === 'boolean' ? item.visible : base.visible,
            })
        }
    }

    return {
        widgets: DASHBOARD_WIDGET_IDS.map((id) => byId.get(id)!),
    }
}

export function widgetsForColumn(
    prefs: DashboardPreferences,
    column: DashboardWidgetColumn,
): DashboardWidgetConfig[] {
    return prefs.widgets.filter((widget) => widget.column === column && widget.visible)
}

export function visibleWidgetIdsForColumn(
    prefs: DashboardPreferences,
    column: DashboardWidgetColumn,
): DashboardWidgetId[] {
    return widgetsForColumn(prefs, column).map((widget) => widget.id)
}

export function reorderWidgetInColumn(
    prefs: DashboardPreferences,
    column: DashboardWidgetColumn,
    fromIndex: number,
    toIndex: number,
): DashboardPreferences {
    const widgets = [...prefs.widgets]
    const columnIndices = widgets
        .map((widget, index) => ({widget, index}))
        .filter((entry) => entry.widget.column === column)
        .map((entry) => entry.index)

    if (fromIndex < 0 || fromIndex >= columnIndices.length) return prefs
    if (toIndex < 0 || toIndex >= columnIndices.length) return prefs
    if (fromIndex === toIndex) return prefs

    const fromGlobal = columnIndices[fromIndex]!
    const toGlobal = columnIndices[toIndex]!
    const next = [...widgets]
    const [moved] = next.splice(fromGlobal, 1)
    next.splice(toGlobal, 0, moved)
    return {widgets: next}
}

export function setWidgetVisibility(
    prefs: DashboardPreferences,
    id: DashboardWidgetId,
    visible: boolean,
): DashboardPreferences {
    return {
        widgets: prefs.widgets.map((widget) =>
            widget.id === id ? {...widget, visible} : widget,
        ),
    }
}

export function setWidgetColumn(
    prefs: DashboardPreferences,
    id: DashboardWidgetId,
    column: DashboardWidgetColumn,
): DashboardPreferences {
    const widgets = [...prefs.widgets]
    const index = widgets.findIndex((widget) => widget.id === id)
    if (index < 0) return prefs
    const current = widgets[index]!
    if (current.column === column) return prefs

    widgets.splice(index, 1)
    const lastInColumn = widgets.reduce(
        (last, widget, widgetIndex) => (widget.column === column ? widgetIndex : last),
        -1,
    )
    const insertAt = lastInColumn >= 0 ? lastInColumn + 1 : widgets.length
    widgets.splice(insertAt, 0, {...current, column})
    return {widgets}
}

export function replaceDashboardWidgets(widgets: DashboardWidgetConfig[]): DashboardPreferences {
    return normalizeDashboardPreferences({widgets})
}

/** 同列排序或跨列移动 widget 到目标索引 */
export function moveWidget(
    prefs: DashboardPreferences,
    id: DashboardWidgetId,
    targetColumn: DashboardWidgetColumn,
    targetIndex: number,
): DashboardPreferences {
    const sourceColumn = prefs.widgets.find((widget) => widget.id === id)?.column
    if (!sourceColumn) return prefs

    let next = sourceColumn === targetColumn
        ? prefs
        : setWidgetColumn(prefs, id, targetColumn)

    const columnIds = visibleWidgetIdsForColumn(next, targetColumn)
    const currentIndex = columnIds.indexOf(id)
    if (currentIndex < 0) return next

    const clampedIndex = Math.max(0, Math.min(targetIndex, columnIds.length - 1))
    if (currentIndex === clampedIndex) return next
    return reorderWidgetInColumn(next, targetColumn, currentIndex, clampedIndex)
}
