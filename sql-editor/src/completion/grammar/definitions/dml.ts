import type {StatementGrammar} from './types'
import {PREDICATE_CHAIN_STATES} from './transitions'

const P = PREDICATE_CHAIN_STATES

export const INSERT_STATEMENT_GRAMMAR: StatementGrammar = {
    statement: 'insert',
    fallback: 'statement.start',
    globalRules: [],
    clauses: [
        {
            id: 'insert_columns',
            slot: 'insert_columns',
            markers: ['INTO'],
            states: [
                {
                    id: 'table_complete',
                    when: 'from_table_clause_complete',
                    stage: 'insert.after_table',
                    hint: 'INSERT INTO 表后 → VALUES / 列名',
                },
                {
                    id: 'pick_table',
                    when: 'always',
                    stage: 'insert.columns',
                    hint: 'INSERT INTO 后 → 表名',
                },
            ],
        },
        {
            id: 'values',
            slot: 'values',
            markers: ['VALUES'],
            states: [
                {
                    id: 'default',
                    when: 'always',
                    stage: 'insert.values',
                    hint: 'VALUES 后 → 字面量 / 关键字',
                },
            ],
        },
    ],
}

export const UPDATE_STATEMENT_GRAMMAR: StatementGrammar = {
    statement: 'update',
    fallback: 'statement.start',
    globalRules: [
        {
            id: 'global_where_complete',
            when: 'after_complete_where_predicate',
            stage: 'predicate.after_where_complete',
            hint: P.whereComplete.hint,
        },
    ],
    clauses: [
        {
            id: 'update_table',
            slot: 'update_table',
            markers: ['UPDATE'],
            states: [
                {
                    id: 'table_complete',
                    when: 'from_table_clause_complete',
                    stage: 'update.after_table',
                    hint: 'UPDATE 表后 → SET',
                },
                {
                    id: 'pick_table',
                    when: 'always',
                    stage: 'update.pick_table',
                    hint: 'UPDATE 后 → 表名',
                },
            ],
        },
        {
            id: 'set',
            slot: 'set',
            markers: ['SET'],
            states: [
                {...P.pickValue, id: 'set_pick_value'},
                {...P.afterColumn, id: 'set_after_column'},
                {
                    id: 'pick_column',
                    when: 'always',
                    stage: 'update.set',
                    hint: 'SET 后 → 列 = 值',
                },
            ],
        },
        {
            id: 'where',
            slot: 'where',
            markers: ['WHERE'],
            states: [
                {...P.whereComplete, id: 'where_complete'},
                {...P.pickValue, id: 'where_pick_value'},
                {...P.afterColumn, id: 'where_after_column'},
                {...P.afterConnector, id: 'where_after_connector'},
                {
                    id: 'pick_column',
                    when: 'always',
                    stage: 'predicate.pick_column',
                    hint: 'WHERE 后 → 列名',
                },
            ],
        },
    ],
}

export const DELETE_STATEMENT_GRAMMAR: StatementGrammar = {
    statement: 'delete',
    fallback: 'statement.start',
    globalRules: [
        {
            id: 'global_where_complete',
            when: 'after_complete_where_predicate',
            stage: 'predicate.after_where_complete',
            hint: P.whereComplete.hint,
        },
    ],
    clauses: [
        {
            id: 'from',
            slot: 'from',
            markers: ['FROM'],
            states: [
                {
                    id: 'table_complete',
                    when: 'from_table_clause_complete',
                    stage: 'table.clause_next',
                    hint: 'DELETE FROM 表后 → WHERE',
                },
                {
                    id: 'pick_table',
                    when: 'always',
                    stage: 'delete.from',
                    hint: 'DELETE FROM 后 → 表名',
                },
            ],
        },
        {
            id: 'where',
            slot: 'where',
            markers: ['WHERE'],
            states: [
                {...P.whereComplete, id: 'where_complete'},
                {...P.pickValue, id: 'where_pick_value'},
                {...P.afterColumn, id: 'where_after_column'},
                {...P.afterConnector, id: 'where_after_connector'},
                {
                    id: 'pick_column',
                    when: 'always',
                    stage: 'predicate.pick_column',
                    hint: 'WHERE 后 → 列名',
                },
            ],
        },
    ],
}

export const EMPTY_STATEMENT_GRAMMAR: StatementGrammar = {
    statement: 'empty',
    fallback: 'statement.start',
    globalRules: [],
    clauses: [
        {
            id: 'start',
            slot: 'statement_start',
            markers: [],
            states: [
                {
                    id: 'default',
                    when: 'always',
                    stage: 'statement.start',
                    hint: '空编辑器 → 语句模板 / 关键字',
                },
            ],
        },
    ],
}

export const DDL_STATEMENT_GRAMMAR: StatementGrammar = {
    statement: 'ddl',
    fallback: 'ddl.keywords',
    globalRules: [],
    clauses: [
        {
            id: 'ddl_start',
            slot: 'statement_start',
            markers: [],
            states: [
                {
                    id: 'default',
                    when: 'always',
                    stage: 'ddl.keywords',
                    hint: 'DDL → 片段 / 关键字',
                },
            ],
        },
        {
            id: 'ddl_column_type',
            slot: 'tail',
            markers: ['ADD COLUMN', 'MODIFY COLUMN', 'CHANGE COLUMN', 'ALTER COLUMN'],
            states: [
                {
                    id: 'column_type',
                    when: 'ddl_awaiting_column_type',
                    stage: 'ddl.column_type',
                    hint: 'DDL → 列数据类型',
                },
                {
                    id: 'before_type',
                    when: 'always',
                    stage: 'ddl.create_rest',
                    hint: 'DDL → 列名（无额外补全）',
                },
            ],
        },
        {
            id: 'ddl_create_body',
            slot: 'tail',
            markers: ['CREATE TABLE IF NOT EXISTS', 'CREATE TABLE'],
            states: [
                {
                    id: 'column_type',
                    when: 'ddl_awaiting_column_type',
                    stage: 'ddl.column_type',
                    hint: 'CREATE TABLE → 列数据类型',
                },
                {
                    id: 'create_rest',
                    when: 'always',
                    stage: 'ddl.create_rest',
                    hint: 'CREATE TABLE → 表名/列名（无额外补全）',
                },
            ],
        },
        {
            id: 'ddl_table_object',
            slot: 'from',
            markers: [
                'DROP TABLE IF EXISTS',
                'DROP TABLE',
                'TRUNCATE TABLE',
                'ALTER TABLE',
                'RENAME TABLE',
            ],
            states: [
                {
                    id: 'pick_table',
                    when: 'always',
                    stage: 'ddl.pick_table',
                    hint: 'DDL → 已有表名',
                },
            ],
        },
    ],
}

export const UNKNOWN_STATEMENT_GRAMMAR: StatementGrammar = {
    statement: 'unknown',
    fallback: 'statement.start',
    globalRules: [],
    clauses: EMPTY_STATEMENT_GRAMMAR.clauses,
}
