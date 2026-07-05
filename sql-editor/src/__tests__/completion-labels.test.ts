import {describe, it} from 'node:test'
import assert from 'node:assert/strict'
import {
    categoryCompletionLabel,
    columnCompletionLabel,
    completionItemKind,
    functionCompletionLabel,
    tableCompletionLabel,
    tableAliasPreview,
} from '../completion/completion-labels.ts'

describe('completion-labels — rich suggest presentation', () => {
    it('maps categories to Monaco icon kinds', () => {
        assert.equal(completionItemKind('table'), 5)
        assert.equal(completionItemKind('column'), 3)
        assert.equal(completionItemKind('function'), 1)
        assert.equal(completionItemKind('keyword'), 17)
        assert.equal(completionItemKind('snippet'), 28)
        assert.equal(completionItemKind('alias'), 4)
        assert.equal(completionItemKind('fk'), 21)
    })

    it('column label keeps clean single-column presentation', () => {
        const label = columnCompletionLabel('create_by', {type: 'varchar(64)'}, 'Column')
        assert.equal(label.label, 'create_by')
        assert.equal(label.detail, undefined)
        assert.equal(label.description, 'varchar(64)')
    })

    it('column label shows table alias in parentheses', () => {
        const label = columnCompletionLabel('id', {type: 'bigint', pk: true}, 'Column', 'cdt')
        assert.equal(label.label, 'id')
        assert.equal(label.detail, '(cdt)')
        assert.equal(label.description, 'PK · bigint')
    })

    it('table label does not render alias preview in title', () => {
        const label = tableCompletionLabel('app_ai_config', 'Table', 'aac')
        assert.equal(label.label, 'app_ai_config')
        assert.equal(label.detail, undefined)
        assert.equal(label.description, 'Table')
    })

    it('table label shows catalog in parentheses', () => {
        const label = tableCompletionLabel('orders', 'Table', 'ord', 'shop_db')
        assert.equal(label.label, 'orders')
        assert.equal(label.detail, '(shop_db)')
        assert.equal(label.description, 'Table')
    })

    it('table label shows right detail when provided', () => {
        const label = tableCompletionLabel('orders', 'Table', 'ord', 'shop_db', 'ord')
        assert.equal(label.description, 'ord')
    })

    it('function label merges signature and shows return type in description', () => {
        const label = functionCompletionLabel('SUM', 'Function', '([DISTINCT] expr)', 'number')
        assert.equal(label.label, 'SUM([DISTINCT] expr)')
        assert.equal(label.detail, undefined)
        assert.equal(label.description, 'number')
    })

    it('extracts alias preview from insert text', () => {
        assert.equal(tableAliasPreview('app_ai_config aac', 'app_ai_config'), 'aac')
        assert.equal(tableAliasPreview('users', 'users'), undefined)
    })

    it('category label supports inline detail', () => {
        const label = categoryCompletionLabel('status', 'Value', ' · int')
        assert.equal(label.label, 'status')
        assert.equal(label.detail, ' · int')
        assert.equal(label.description, 'Value')
    })
})
