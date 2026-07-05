import {computed, type Ref} from 'vue'
import {useI18n} from 'vue-i18n'
import {collectSearchTreeVisibility, flattenVisibleTree} from '@/core/utils/tree'
import {useExplorerStore} from '@/features/explorer/stores/explorer'
import {matchesExplorerTreeSearch} from '@/features/explorer/services/explorer-catalog-label.service'
import {buildExplorerFavoritesGroup} from '@/features/explorer/services/explorer-favorites-group.service'
import {readPinnedTableFavorites} from '@/features/explorer/services/pinned-table-favorites.service'

/** Explorer / AI 共用：同一棵数据源树的可见扁平列表 */
export function useDataSourceFlatNodes(search: Ref<string>) {
    const explorer = useExplorerStore()
    const {t} = useI18n()

    const tableFavorites = computed(() => {
        void explorer.pinnedNodeIds
        return readPinnedTableFavorites()
    })

    const searchVisibility = computed(() => {
        const query = search.value.trim()
        if (!query) return null
        return collectSearchTreeVisibility(explorer.tree, query, (node, q) =>
            matchesExplorerTreeSearch(node, q, t),
        )
    })

    const visibleTree = computed(() => {
        if (search.value.trim()) return explorer.tree

        const favoritesGroup = buildExplorerFavoritesGroup(
            explorer.tree,
            tableFavorites.value,
            {
                group: t('explorer.favoritesGroup'),
                viewAll: (count) => t('explorer.favoritesViewAll', {count}),
                tableSubtitle: (favorite) => t('explorer.favoritesTableSubtitle', {
                    connection: favorite.connectionLabel ?? favorite.connectionId,
                    database: favorite.database,
                }),
            },
            {
                expanded: explorer.favoritesGroupExpanded,
                showAll: explorer.favoritesShowAll,
            },
        )

        if (!favoritesGroup) return explorer.tree
        return [favoritesGroup, ...explorer.tree]
    })

    const flatNodes = computed(() =>
        flattenVisibleTree(visibleTree.value, 0, searchVisibility.value),
    )

    return {explorer, visibleTree, flatNodes}
}
