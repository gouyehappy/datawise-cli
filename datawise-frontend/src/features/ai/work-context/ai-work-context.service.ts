import type {AiWorkContext, BuildAiWorkContextInput} from '@/features/ai/work-context/ai-work-context.types'

export function buildAiWorkContext(input: BuildAiWorkContextInput): AiWorkContext {
    return {
        connectionId: input.connectionId?.trim() || undefined,
        database: input.database?.trim() || undefined,
        dbType: input.dbType,
        connectionLabel: input.connectionLabel?.trim() || undefined,
        sql: input.sql?.trim() || undefined,
        selection: input.selection?.trim() || undefined,
        lastError: input.lastError?.trim() || undefined,
        errorLine: input.errorLine,
    }
}

/** 将工作上下文格式化为 SQL 生成 API 的 prompt（修复 / 解释等场景复用） */
export function formatAiWorkContextPrompt(
    context: AiWorkContext,
    intent: 'fix' | 'explain' | 'optimize',
): string {
    const targetSql = context.selection || context.sql
    if (!targetSql) {
        return intent === 'fix'
            ? 'Fix the SQL error.'
            : intent === 'optimize'
                ? 'Optimize the SQL.'
                : 'Explain the SQL.'
    }

    const header = intent === 'fix'
        ? 'Fix the following SQL so it runs without error.'
        : intent === 'optimize'
            ? 'Optimize the following SQL for performance.'
            : 'Explain the following SQL.'

    const parts = [header, '', '```sql', targetSql, '```']

    if (context.lastError) {
        parts.push('', 'Database error:', context.lastError)
    }

    parts.push(
        '',
        'Reply with corrected SQL only (no markdown fences). Preserve the original intent.',
    )

    return parts.join('\n')
}

export function formatAiFixPrompt(context: AiWorkContext): string {
    return formatAiWorkContextPrompt(context, 'fix')
}

export function formatAiIndexSuggestPrompt(options: {
    sql: string
    planSummary?: string
    heuristicSql?: string
    dbType?: string
    database?: string
}): string {
    const parts = [
        'Suggest CREATE INDEX statements (draft DDL only) to improve the query below.',
        'Reply with SQL only: one CREATE INDEX per statement, include trailing semicolons.',
        'Do not execute or modify data. Prefer covering WHERE, JOIN, and ORDER BY columns.',
        '',
        '```sql',
        options.sql.trim(),
        '```',
    ]
    if (options.dbType || options.database) {
        parts.push('', `Database: ${options.database ?? '—'} (${options.dbType ?? 'unknown'})`)
    }
    if (options.planSummary?.trim()) {
        parts.push('', 'Execution plan hints:', options.planSummary.trim())
    }
    if (options.heuristicSql?.trim()) {
        parts.push('', 'Heuristic drafts (refine or replace):', options.heuristicSql.trim())
    }
    return parts.join('\n')
}
