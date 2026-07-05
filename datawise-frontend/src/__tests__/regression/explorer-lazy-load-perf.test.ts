import {describe, it} from 'node:test'
import assert from 'node:assert/strict'
import type {TreeNode} from '@/core/types'
import {
    TABLES_FOLDER_LOADED_META,
    buildExplorerLoadChildKey,
    clearExplorerFolderLoadedIds,
    folderLoadedMeta,
    isExplorerFolderLoaded,
    isTablesFolderLoaded,
    markExplorerFolderLoaded,
    needsLazyLoad,
} from '@/features/explorer/services/explorer-lazy-load'

function folder(label: string, id: string, meta?: string, children?: TreeNode[]): TreeNode {
    return {id, label, type: 'folder', meta, children}
}

describe('explorer-lazy-load-perf', () => {
    it('buildExplorerLoadChildKey separates refresh and offset', () => {
        assert.equal(
            buildExplorerLoadChildKey('conn-1', 'node-a'),
            'conn-1:node-a:0:0',
        )
        assert.equal(
            buildExplorerLoadChildKey('conn-1', 'node-a', {offset: 500}),
            'conn-1:node-a:500:0',
        )
        assert.equal(
            buildExplorerLoadChildKey('conn-1', 'node-a', {refresh: true}),
            'conn-1:node-a:0:1',
        )
    })

    it('needsLazyLoad skips tables folder marked as loaded with empty children', () => {
        clearExplorerFolderLoadedIds()
        const tables = folder('tables', 'folder-tables-1', undefined, [])
        markExplorerFolderLoaded(tables)
        assert.equal(isTablesFolderLoaded(tables), true)
        assert.equal(needsLazyLoad(tables, 'mysql'), false)
    })

    it('needsLazyLoad skips workspaces and views folders when marked loaded', () => {
        clearExplorerFolderLoadedIds()
        const workspaces = folder('workspaces', 'folder-ws-1', undefined, [])
        const views = folder('views', 'folder-views-1', undefined, [])
        markExplorerFolderLoaded(workspaces)
        markExplorerFolderLoaded(views)
        assert.equal(needsLazyLoad(workspaces, 'mysql'), false)
        assert.equal(needsLazyLoad(views, 'mysql'), false)
    })

    it('folderLoadedMeta normalizes label casing', () => {
        assert.equal(folderLoadedMeta('Tables'), 'tables:loaded')
        assert.equal(folderLoadedMeta('WORKSPACES'), 'workspaces:loaded')
    })

    it('needsLazyLoad skips tables folder marked via meta', () => {
        clearExplorerFolderLoadedIds()
        const tables = folder('tables', 'folder-tables-meta', TABLES_FOLDER_LOADED_META, [])
        assert.equal(isTablesFolderLoaded(tables), true)
        assert.equal(needsLazyLoad(tables, 'mysql'), false)
    })

    it('markExplorerFolderLoaded sets meta aligned with backend ExplorerTreeMarkers', () => {
        clearExplorerFolderLoadedIds()
        const workspaces = folder('workspaces', 'folder-ws-meta', undefined, [])
        markExplorerFolderLoaded(workspaces)
        assert.equal(workspaces.meta, 'workspaces:loaded')
        assert.equal(isExplorerFolderLoaded(workspaces), true)
    })

    it('needsLazyLoad still loads empty tables folder without loaded marker', () => {
        clearExplorerFolderLoadedIds()
        const tables = folder('tables', 'folder-tables-2', undefined, [])
        assert.equal(needsLazyLoad(tables, 'mysql'), true)
    })
})
