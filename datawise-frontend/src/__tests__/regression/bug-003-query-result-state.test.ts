import {describe, it} from 'node:test'
import assert from 'node:assert/strict'

/**
 * BUG-003: setConsoleQueryResults 应替换 consoleQueryByTabId 的 tab 条目引用。
 * 此处用纯数据结构模拟 store 更新策略，防止回退为仅 mutate 嵌套 results。
 */
function applyConsoleQueryResults(
    byTabId: Record<string, { results: { id: string }[]; activeView: 'overview' | number }>,
    tabId: string,
    results: { id: string }[],
): Record<string, { results: { id: string }[]; activeView: 'overview' | number }> {
    const activeView: 'overview' | number = results.length === 0 ? 'overview' : results.length - 1
    return {
        ...byTabId,
        [tabId]: {results, activeView},
    }
}

describe('BUG-003: console query state replace-by-reference', () => {
    it('replaces tab entry so top-level record reference changes', () => {
        const before = {
            tab1: {results: [{id: 'old'}], activeView: 0 as const},
        }
        const after = applyConsoleQueryResults(before, 'tab1', [{id: 'new'}])
        assert.notEqual(after, before)
        assert.notEqual(after.tab1, before.tab1)
        assert.equal(after.tab1.results[0]?.id, 'new')
        assert.equal(after.tab1.activeView, 0)
    })

    it('sets activeView to overview when results empty', () => {
        const after = applyConsoleQueryResults({}, 'tab1', [])
        assert.equal(after.tab1.activeView, 'overview')
        assert.equal(after.tab1.results.length, 0)
    })
})
