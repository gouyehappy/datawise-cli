import type {SqlEditorSchema} from '@sql-editor/types'
import {collectUsedAliases, nextTableAlias, preferredAlias} from '@sql-editor/utils/alias'
import {fkJoinConditions, relatedTablesForJoin} from '@sql-editor/utils/schema-columns'

export interface FkJoinLineCandidate {
    targetTable: string
    sourceTable: string
    condition: string
    sourceAlias: string
    targetAlias: string
}

/** 基于当前已引用表，生成可一键插入的 FK JOIN 行候选 */
export function fkJoinLineCandidates(
    schema: SqlEditorSchema,
    inQuery: string[],
    aliases: Record<string, string>,
    sql: string,
    currentLine: string,
    cursorOffset?: number,
): FkJoinLineCandidate[] {
    if (!inQuery.length) return []

    const inSet = new Set(inQuery.map((t) => t.toLowerCase()))
    const related = relatedTablesForJoin(schema, inQuery)
    const results: FkJoinLineCandidate[] = []
    const seen = new Set<string>()

    const used = collectUsedAliases(aliases, sql, currentLine, cursorOffset)

    for (const targetTable of related) {
        const targetKey = targetTable.toLowerCase()
        if (inSet.has(targetKey)) continue

        for (const sourceTable of inQuery) {
            const sourceAlias = preferredAlias(sourceTable, aliases)
            const targetAlias = nextTableAlias(targetTable, aliases, sql, currentLine, used, cursorOffset)
            used.add(targetAlias.toLowerCase())
            const conditions = fkJoinConditions(
                schema,
                sourceTable,
                sourceAlias,
                targetTable,
                targetAlias,
            )
            for (const condition of conditions) {
                const dedupe = `${targetKey}:${condition}`.toLowerCase()
                if (seen.has(dedupe)) continue
                seen.add(dedupe)
                results.push({
                    targetTable,
                    sourceTable,
                    condition,
                    sourceAlias,
                    targetAlias,
                })
            }
        }
    }

    return results.sort(
        (a, b) => a.targetTable.localeCompare(b.targetTable) || a.condition.localeCompare(b.condition),
    )
}

export function buildInnerJoinLine(candidate: FkJoinLineCandidate): string {
    return `INNER JOIN ${candidate.targetTable} ${candidate.targetAlias} ON ${candidate.condition}`
}

export function buildLeftJoinLine(candidate: FkJoinLineCandidate): string {
    return `LEFT JOIN ${candidate.targetTable} ${candidate.targetAlias} ON ${candidate.condition}`
}
