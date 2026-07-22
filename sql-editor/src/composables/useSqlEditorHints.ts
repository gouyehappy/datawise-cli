import {computed, onUnmounted, shallowRef, watch, type Ref} from 'vue'
import {
    analyzeSqlCompletionContext,
    effectiveCompletionSlot,
    hasSignal,
    hasTablesInQuery
} from '@sql-editor/completion/context'
import {scheduleSqlCompletionAnalysis, disposeCompletionWorker} from '@sql-editor/completion/completion-worker-client'
import {getSqlEditorShortcutsSettings, sqlEditorSettingsVersion} from '@sql-editor/config/snippets/cache'
import {resolveQuickActionsForSlot} from '@sql-editor/constants/slot-quick-actions'
import {resolveAiQuickActionsForContext} from '@sql-editor/ai/hint-quick-actions'
import {resolveCompletionPlan} from '@sql-editor/completion/grammar/index'
import {
    formatKeybindingsTooltip,
    listHintKeybindings,
    summarizeKeybindingsForHint
} from '@sql-editor/editor/shortcut-config'
import {listQueryAliases} from '@sql-editor/utils/alias'
import {schemaColumnCount} from '@sql-editor/utils/schema-metrics'
import {sqlEditorT} from '@sql-editor/i18n'
import type {
    SqlCompletionSlot,
    SqlEditorContextInfo,
    SqlEditorSchema,
    SqlEditorLocale,
    SqlStatementKind
} from '@sql-editor/types'

const STATEMENT_LABEL: Record<SqlStatementKind, string> = {
    empty: '—',
    select: 'SELECT',
    insert: 'INSERT',
    update: 'UPDATE',
    delete: 'DELETE',
    ddl: 'DDL',
    unknown: 'SQL',
}

const SLOT_LABEL_KEY: Record<SqlCompletionSlot, string> = {
    statement_start: 'slot.label.statement_start',
    select_list: 'slot.label.select_list',
    from: 'slot.label.from',
    join: 'slot.label.join',
    on: 'slot.label.on',
    where: 'slot.label.where',
    group_by: 'slot.label.group_by',
    having: 'slot.label.having',
    order_by: 'slot.label.order_by',
    tail: 'slot.label.tail',
    set: 'slot.label.set',
    values: 'slot.label.values',
    insert_columns: 'slot.label.insert_columns',
    update_table: 'slot.label.update_table',
    column_ref: 'slot.label.column_ref',
}

const SLOT_HINT_KEY: Record<SqlCompletionSlot, string> = {
    statement_start: 'hint.slot.statement_start',
    select_list: 'hint.slot.select_list',
    from: 'hint.slot.from',
    join: 'hint.slot.join',
    on: 'hint.slot.on',
    where: 'hint.slot.where',
    group_by: 'hint.slot.group_by',
    having: 'hint.slot.having',
    order_by: 'hint.slot.order_by',
    tail: 'hint.slot.tail',
    set: 'hint.slot.set',
    values: 'hint.slot.values',
    insert_columns: 'hint.slot.insert_columns',
    update_table: 'hint.slot.update_table',
    column_ref: 'hint.slot.column_ref',
}

function buildHint(
    ctx: ReturnType<typeof analyzeSqlCompletionContext>,
    locale: SqlEditorLocale,
): string {
    if (hasSignal(ctx, 'after_comma') && (ctx.slot === 'select_list' || ctx.slot === 'where')) {
        return sqlEditorT(locale, 'hint.after_comma')
    }
    if (ctx.fromJoin?.awaitingJoinTable || ctx.fromJoin?.awaitingTableName) {
        return sqlEditorT(locale, 'hint.awaiting_join_table')
    }
    if (ctx.fromJoin?.awaitingOnClause) {
        return sqlEditorT(locale, 'hint.awaiting_on')
    }
    if (ctx.fromJoin?.tableClauseComplete) {
        const table = ctx.fromJoin.resolvedTable ?? ''
        if (ctx.statement === 'delete') {
            return sqlEditorT(locale, 'hint.after_delete_table', {table})
        }
        if (ctx.statement === 'update') {
            return sqlEditorT(locale, 'hint.after_update_table', {table})
        }
        if (ctx.statement === 'insert') {
            return sqlEditorT(locale, 'hint.after_insert_table', {table})
        }
        return sqlEditorT(locale, 'hint.after_table', {table})
    }
    if (hasSignal(ctx, 'after_complete_column_ref')) {
        return sqlEditorT(locale, 'hint.after_column')
    }
    if (hasSignal(ctx, 'after_predicate_operator')) {
        return sqlEditorT(locale, 'hint.after_operator')
    }
    if (hasSignal(ctx, 'after_condition_connector')) {
        return sqlEditorT(locale, 'hint.after_connector')
    }
    if (ctx.slot === 'column_ref' && !hasSignal(ctx, 'after_complete_column_ref')) {
        if (ctx.resolvedTable && ctx.qualifier) {
            return sqlEditorT(locale, 'hint.column_ref.resolved', {
                alias: ctx.qualifier,
                table: ctx.resolvedTable,
            })
        }
        if (ctx.qualifier) {
            return sqlEditorT(locale, 'hint.column_ref.unresolved', {alias: ctx.qualifier})
        }
    }
    if (ctx.slot === 'select_list' && !hasTablesInQuery(ctx)) {
        return sqlEditorT(locale, 'hint.select_list.no_tables')
    }
    if (ctx.slot === 'statement_start') {
        return `${sqlEditorT(locale, SLOT_HINT_KEY.statement_start)} · ${sqlEditorT(locale, 'hint.snippet_tips')}`
    }
    return sqlEditorT(locale, SLOT_HINT_KEY[ctx.slot])
}

/** Build context hint from SQL text and cursor offset */
export function useSqlEditorHints(
    sql: Ref<string>,
    cursorOffset: Ref<number>,
    schema: Ref<SqlEditorSchema>,
    locale: Ref<SqlEditorLocale>,
    dialect?: Ref<string | undefined>,
    aiCompletionReady?: Ref<boolean>,
    hasSelection?: Ref<boolean>,
) {
    const analyzedContext = shallowRef<ReturnType<typeof analyzeSqlCompletionContext> | null>(null)

    watch(
        [sql, cursorOffset, schema, dialect],
        () => {
            scheduleSqlCompletionAnalysis(
                sql.value,
                cursorOffset.value,
                schema.value.tables,
                schema.value.columns,
                (ctx) => {
                    analyzedContext.value = ctx
                },
                dialect?.value ?? 'mysql',
            )
        },
        {flush: 'post', immediate: true},
    )

    onUnmounted(() => disposeCompletionWorker())

    const shortcutHints = computed(() => {
        void sqlEditorSettingsVersion.value
        const settings = getSqlEditorShortcutsSettings()
        const loc = locale.value
        const labelOf = (key: string) =>
            sqlEditorT(loc, key as Parameters<typeof sqlEditorT>[1])
        return {
            shortcutItems: listHintKeybindings(settings.keybindings, labelOf),
            shortcutHint: summarizeKeybindingsForHint(settings.keybindings, labelOf),
            shortcutHintTitle: formatKeybindingsTooltip(settings.keybindings, labelOf),
        }
    })

    const contextInfo = computed<SqlEditorContextInfo>(() => {
        const ctx =
            analyzedContext.value ??
            analyzeSqlCompletionContext(
                sql.value,
                cursorOffset.value,
                schema.value.tables,
                schema.value.columns,
            )
        const effSlot = effectiveCompletionSlot(ctx)
        const settings = getSqlEditorShortcutsSettings()
        const loc = locale.value
        const plan = resolveCompletionPlan(ctx)

        const quickActions = resolveQuickActionsForSlot(effSlot, {
            dialect: dialect?.value,
            settings,
        }).filter((action) => {
            if (hasSignal(ctx, 'after_condition_connector') && (action.id === 'and' || action.id === 'or')) {
                return false
            }
            if (hasSignal(ctx, 'after_predicate_operator')) {
                return false
            }
            return true
        })

        if (aiCompletionReady?.value) {
            quickActions.push(
                ...resolveAiQuickActionsForContext(ctx, plan, {
                    aiReady: true,
                    hasSelection: hasSelection?.value ?? false,
                    locale: loc,
                }),
            )
        }

        return {
            statement: ctx.statement,
            slot: ctx.slot,
            slotLabel: sqlEditorT(locale.value, SLOT_LABEL_KEY[effSlot] as Parameters<typeof sqlEditorT>[1]),
            hint: buildHint(ctx, locale.value),
            tableCount: schema.value.tables.length,
            columnCount: schemaColumnCount(schema.value),
            aliases: listQueryAliases(ctx.aliases),
            quickActions,
            ...shortcutHints.value,
        }
    })

    const statementLabel = computed(() => STATEMENT_LABEL[contextInfo.value.statement])

    return {
        contextInfo,
        statementLabel,
        shortcutHints,
    }
}
