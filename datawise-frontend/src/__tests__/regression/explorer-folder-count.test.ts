import assert from 'node:assert/strict'
import {describe, test} from 'node:test'
import type {TreeNode} from '@/core/types'
import {
    resolveFolderItemCount,
    syncFolderChildCount,
} from '@/features/explorer/services/explorer-folder-count.service'

describe('explorer-folder-count', () => {
    test('shows backend count for empty catalog folders', () => {
        const views: TreeNode = {id: 'v1', label: 'views', type: 'folder', childCount: 0, children: []}
        assert.equal(resolveFolderItemCount(views), 0)
    })

    test('shows table count from preloaded children', () => {
        const tables: TreeNode = {
            id: 't1',
            label: 'tables',
            type: 'folder',
            childCount: 2,
            children: [
                {id: 'tb1', label: 'users', type: 'table'},
                {id: 'tb2', label: 'orders', type: 'table'},
            ],
        }
        assert.equal(resolveFolderItemCount(tables), 2)
    })

    test('sync updates count after lazy load', () => {
        const views: TreeNode = {
            id: 'v1',
            label: 'views',
            type: 'folder',
            childCount: 0,
            children: [],
            meta: 'views:loaded',
        }
        views.children = [{id: 'vw1', label: 'active_users', type: 'view'}]
        syncFolderChildCount(views)
        assert.equal(views.childCount, 1)
        assert.equal(resolveFolderItemCount(views), 1)
    })

    test('preserves total count when tables folder is paginated', () => {
        const tables: TreeNode = {
            id: 't1',
            label: 'tables',
            type: 'folder',
            childCount: 120,
            children: [
                {id: 'tb1', label: 'users', type: 'table'},
                {id: 'lm', label: 'Load more', type: 'load_more', meta: '50'},
            ],
        }
        syncFolderChildCount(tables)
        assert.equal(tables.childCount, 120)
        assert.equal(resolveFolderItemCount(tables), 120)
    })

    test('ignores custom folders without catalog key', () => {
        const group: TreeNode = {id: 'g1', label: '业务目录', type: 'folder', children: []}
        assert.equal(resolveFolderItemCount(group), null)
    })
})
