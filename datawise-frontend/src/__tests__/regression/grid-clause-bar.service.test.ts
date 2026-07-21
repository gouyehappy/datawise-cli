import {describe, expect, it} from 'vitest'
import {
  formatOrderClause,
  parseOrderClause,
  suggestClauseColumns,
} from '@/features/workspace/services/grid-clause-bar.service'
import {
  compileWhereExpression,
  rowMatchesWhereExpression,
} from '@/features/workspace/services/grid-where-expression.service'

describe('grid-clause-bar.service', () => {
  it('parses order by with optional direction', () => {
    expect(parseOrderClause('create_date')).toEqual({column: 'create_date', direction: 'asc'})
    expect(parseOrderClause('name DESC')).toEqual({column: 'name', direction: 'desc'})
    expect(parseOrderClause('')).toBeNull()
  })

  it('formats order clause', () => {
    expect(formatOrderClause('name', 'asc')).toBe('name')
    expect(formatOrderClause('name', 'desc')).toBe('name DESC')
  })

  it('suggests columns for where identifier prefixes only', () => {
    const columns = [
      {name: 'id', type: 'VARCHAR'},
      {name: 'name', type: 'VARCHAR'},
      {name: 'status', type: 'BIT'},
    ]
    expect(suggestClauseColumns(columns, '', 0, 'where').suggestions).toEqual([])
    expect(suggestClauseColumns(columns, 'na', 2, 'where').suggestions).toEqual([
      {name: 'name', type: 'VARCHAR'},
    ])
    expect(suggestClauseColumns(columns, "name LIKE '%x'", 12, 'where').suggestions).toEqual([])
    expect(suggestClauseColumns(columns, 'st', 2, 'order').suggestions).toEqual([
      {name: 'status', type: 'BIT'},
    ])
  })
})

describe('grid-where-expression.service', () => {
  const row = (values: Record<string, unknown>) => (column: string) => {
    const key = Object.keys(values).find((name) => name.toLowerCase() === column.toLowerCase())
    return key == null ? undefined : values[key]
  }

  it('supports equals and like', () => {
    expect(compileWhereExpression('name like "%test%"').ok).toBe(true)
    expect(rowMatchesWhereExpression('name like "%test%"', row({name: 'test_john'}))).toBe(true)
    expect(rowMatchesWhereExpression("name LIKE '%bug%'", row({name: 'ssss'}))).toBe(false)
    expect(rowMatchesWhereExpression("status = '1'", row({status: 1}))).toBe(true)
  })

  it('tolerates LIKE = typo from field=value muscle memory', () => {
    expect(compileWhereExpression("name like = '%test%'").ok).toBe(true)
    expect(rowMatchesWhereExpression("name like = '%test%'", row({name: 'test_john_0312_1'}))).toBe(true)
    expect(rowMatchesWhereExpression("name like = '%test%'", row({name: 'ssss'}))).toBe(false)
    expect(rowMatchesWhereExpression("name like = '%test%'", row({name: 'bug'}))).toBe(false)
    expect(rowMatchesWhereExpression("name ILIKE = '%TEST%'", row({name: 'test 0314'}))).toBe(true)
  })

  it('supports and / or / not / in / is null', () => {
    expect(
        rowMatchesWhereExpression(
            "name LIKE '%test%' AND del_flag = 0",
            row({name: 'test_a', del_flag: 0}),
        ),
    ).toBe(true)
    expect(
        rowMatchesWhereExpression(
            "status IN ('active', 'open')",
            row({status: 'open'}),
        ),
    ).toBe(true)
    expect(rowMatchesWhereExpression('remark IS NULL', row({remark: null}))).toBe(true)
    expect(rowMatchesWhereExpression("NOT name = 'bug'", row({name: 'ok'}))).toBe(true)
  })

  it('rejects invalid fragments', () => {
    expect(compileWhereExpression('name like').ok).toBe(false)
    expect(compileWhereExpression('name === 1').ok).toBe(false)
  })
})
