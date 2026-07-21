/**
 * 网格 WHERE / ORDER BY 辅助（WHERE 为 SQL 片段；ORDER BY 仍为字段排序）
 */

import {whereIdentifierPrefixAtCaret} from '@/features/workspace/services/grid-where-expression.service'

export type ClauseColumnHint = {
  name: string
  type?: string
}

export type ParsedOrderClause = {
  column: string
  direction: 'asc' | 'desc'
}

/** 解析 `field` / `field ASC` / `field DESC` */
export function parseOrderClause(input: string): ParsedOrderClause | null {
  const text = input.trim()
  if (!text) return null
  const match = text.match(
      /^\s*(?:`([^`]+)`|"([^"]+)"|'([^']+)'|([A-Za-z_][\w$]*))\s*(asc|desc)?\s*$/i,
  )
  if (!match) return null
  const column = (match[1] ?? match[2] ?? match[3] ?? match[4] ?? '').trim()
  if (!column) return null
  const dir = (match[5] ?? 'asc').toLowerCase()
  return {column, direction: dir === 'desc' ? 'desc' : 'asc'}
}

export function formatOrderClause(column: string, direction: 'asc' | 'desc' | null | undefined): string {
  if (!column) return ''
  if (!direction || direction === 'asc') return column
  return `${column} DESC`
}

export type ClauseSuggestResult = {
  query: string
  suggestions: ClauseColumnHint[]
}

/** WHERE：光标处字段名前缀；ORDER BY：整段字段名 */
export function suggestClauseColumns(
    columns: ClauseColumnHint[] | string[],
    input: string,
    caret: number,
    mode: 'where' | 'order',
): ClauseSuggestResult {
  const hints = normalizeColumnHints(columns)
  if (mode === 'where') {
    const prefix = whereIdentifierPrefixAtCaret(input, caret)
    if (prefix == null || !prefix) return {query: '', suggestions: []}
    return {
      query: prefix,
      suggestions: filterColumnSuggestions(hints, prefix),
    }
  }
  const before = input.slice(0, Math.max(0, caret))
  const stripped = before.replace(/\s+(asc|desc)\s*$/i, '').trim()
  return {
    query: stripped,
    suggestions: filterColumnSuggestions(hints, stripped),
  }
}

function normalizeColumnHints(columns: ClauseColumnHint[] | string[]): ClauseColumnHint[] {
  return columns.map((entry) =>
      typeof entry === 'string' ? {name: entry} : {name: entry.name, type: entry.type},
  )
}

function filterColumnSuggestions(columns: ClauseColumnHint[], query: string): ClauseColumnHint[] {
  const q = query.trim().toLowerCase()
  if (!q) return []
  const starts = columns.filter((col) => col.name.toLowerCase().startsWith(q))
  const contains = columns.filter(
      (col) => !col.name.toLowerCase().startsWith(q) && col.name.toLowerCase().includes(q),
  )
  return [...starts, ...contains].slice(0, 12)
}
