import {describe, it} from 'node:test'
import assert from 'node:assert/strict'
import type {TreeNode} from '@/core/types'
import {
    collectPathNodeIds,
    markExpandedPath,
    shouldCollapseOnToggle,
    shouldCollapseOnDoubleClick,
    shouldLoadOnSelect,
    shouldLoadOnNodeSelect,
} from '@/features/explorer/services/explorer-tree-expansion'
import {needsLazyLoad} from '@/features/explorer/services/explorer-lazy-load'

function node(partial: Partial<TreeNode> & Pick<TreeNode, 'id' | 'label' | 'type'>): TreeNode {
    return {...partial}
}

const tree: TreeNode[] = [
    {
        id: 'conn-trino',
        label: 'trino',
        type: 'connection',
        dbType: 'trino',
        children: [
            {
                id: 'cat-kudu',
                label: 'kudu',
                type: 'database',
                children: [
                    {
                        id: 'schema-a003',
                        label: 'a003',
                        type: 'schema',
                        expanded: true,
                        children: [],
                    },
                ],
            },
            {
                id: 'cat-hive',
                label: 'hive',
                type: 'database',
                children: [
                    node({
                        id: 'schema-hive-a003',
                        label: 'a003',
                        type: 'schema',
                        children: [
                            node({id: 'folder-tables', label: 'tables', type: 'folder', children: []}),
                        ],
                    }),
                ],
            },
        ],
    },
    {
        id: 'conn-mongo',
        label: 'mongo',
        type: 'connection',
        dbType: 'mongodb',
        children: [
            {
                id: 'db-admin',
                label: 'admin',
                type: 'database',
                children: [
                    node({id: 'folder-tables-mongo', label: 'tables', type: 'folder', children: []}),
                ],
            },
        ],
    },
]

describe('explorer-tree-expansion', () => {
    it('collects path from root to target', () => {
        assert.deepEqual(collectPathNodeIds(tree, 'schema-a003'), [
            'conn-trino',
            'cat-kudu',
            'schema-a003',
        ])
    })

    it('does not collapse expanded node when children are still unloaded', () => {
        const schema = tree[0].children![0].children![0]
        assert.equal(shouldCollapseOnToggle(schema, 'trino'), false)
    })

    it('collapses expanded hive flat database when folder children are loaded', () => {
        const hiveDb = node({
            id: 'db-a003',
            label: 'a003',
            type: 'database',
            expanded: true,
            children: [
                node({id: 'folder-tables', label: 'tables', type: 'folder', children: []}),
                node({id: 'folder-models', label: 'models', type: 'folder', children: []}),
            ],
        })
        assert.equal(needsLazyLoad(hiveDb, 'hive'), false)
        assert.equal(shouldCollapseOnToggle(hiveDb, 'hive'), true)
    })

    it('collapses expanded node when children are loaded', () => {
        const mongoDb = tree[1].children![0]
        mongoDb.expanded = true
        assert.equal(shouldCollapseOnToggle(mongoDb, 'mongodb'), true)
    })

    it('collapses on double click when node is expanded', () => {
        const connection = tree[0]
        connection.expanded = true
        assert.equal(shouldCollapseOnDoubleClick(connection), true)
    })

    it('does not collapse on double click when node is collapsed', () => {
        const connection = tree[0]
        connection.expanded = false
        assert.equal(shouldCollapseOnDoubleClick(connection), false)
    })

    it('does not collapse expanded table on double click', () => {
        const table = node({
            id: 'tbl-users',
            label: 'users',
            type: 'table',
            expanded: true,
            children: [
                node({id: 'folder-cols', label: 'columns', type: 'columns', children: []}),
            ],
        })
        assert.equal(shouldCollapseOnDoubleClick(table), false)
    })

    it('does not collapse non-expandable nodes on double click', () => {
        const column = node({id: 'col-1', label: 'id', type: 'column'})
        column.expanded = true
        assert.equal(shouldCollapseOnDoubleClick(column), false)
    })

    it('loads on select when expanded flag is stale', () => {
        const schema = tree[0].children![0].children![0]
        assert.equal(shouldLoadOnSelect(schema, 'trino'), true)
    })

    it('loads on select when node is collapsed', () => {
        const catalog = tree[0].children![1]
        catalog.expanded = false
        assert.equal(shouldLoadOnSelect(catalog, 'trino'), true)
    })

    it('does not load connection on single select', () => {
        const connection = tree[0]
        connection.expanded = false
        assert.equal(shouldLoadOnNodeSelect(connection, 'trino'), false)
    })

    it('does not load non-connection nodes on single select', () => {
        const catalog = tree[0].children![1]
        catalog.expanded = false
        assert.equal(shouldLoadOnNodeSelect(catalog, 'trino'), false)
    })

    it('markExpandedPath only toggles UI flags', () => {
        const catalog = tree[0].children![1]
        catalog.expanded = false
        markExpandedPath(tree, 'schema-hive-a003')
        assert.equal(catalog.expanded, true)
    })
})
