import {describe, it} from 'node:test'
import assert from 'node:assert/strict'
import type {TreeNode} from '@/core/types'
import {
    clearExplorerFolderLoadedIds,
    markExplorerFolderLoaded,
    mergeLoadedChildren,
    needsLazyLoad,
    stripFolderLoadedMetaFromNodes,
} from '@/features/explorer/services/explorer-lazy-load'

function folder(id: string, label: string, meta?: string, children?: TreeNode[]): TreeNode {
    return {id, label, type: 'folder', meta, children}
}

describe('BUG-004 explorer tables folder loaded marker', () => {
    it('treats backend :loaded meta as loaded for empty tables folder', () => {
        clearExplorerFolderLoadedIds()
        const tables = folder('folder-tables-conn-1-a003', 'tables', 'tables:loaded', [])
        assert.equal(needsLazyLoad(tables, 'trino'), false)
    })

    it('strips :loaded meta when merging schema children from backend cache', () => {
        clearExplorerFolderLoadedIds()
        const schema = folder('schema-1', 'schema')
        mergeLoadedChildren(schema, [
            folder('folder-views-1', 'views', 'views:loaded', []),
        ])
        assert.equal(schema.children?.[0]?.meta, undefined)
        assert.equal(needsLazyLoad(schema.children![0], 'trino'), true)
    })

    it('skips lazy load only after frontend marks folder loaded', () => {
        clearExplorerFolderLoadedIds()
        const tables = folder('folder-tables-conn-1-a003', 'tables', undefined, [])
        markExplorerFolderLoaded(tables)
        assert.equal(tables.meta, 'tables:loaded')
        assert.equal(needsLazyLoad(tables, 'trino'), false)
    })

    it('stripFolderLoadedMetaFromNodes removes nested folder markers', () => {
        const nodes = stripFolderLoadedMetaFromNodes([
            folder('folder-tables-1', 'tables', 'tables:loaded', []),
        ])
        assert.equal(nodes[0]?.meta, undefined)
    })
})
