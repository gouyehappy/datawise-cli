import {computed, type Ref} from 'vue'
import type {TreeNode} from '@/core/types'
import {resolveTargetIdFromNode} from '@/features/ai/shared/utils/database-targets'
import {useDataSourceFlatNodes} from '@/features/explorer/composables/useDataSourceFlatNodes'
import {isScopeSelectableNode} from '@/features/explorer/utils/scope-tree'

export function useAiDataSourceTree(options: {
    selectedIds: Ref<string[]>
    search: Ref<string>
}) {
    const {explorer, flatNodes} = useDataSourceFlatNodes(options.search)

    const selectableIds = computed(() => {
        const ids: string[] = []
        for (const {node} of flatNodes.value) {
            if (!isScopeSelectableNode(node)) continue
            const id = resolveTargetIdFromNode(explorer.tree, node.id)
            if (id) ids.push(id)
        }
        return ids
    })

    function targetIdForNode(node: TreeNode) {
        if (!isScopeSelectableNode(node)) return null
        return resolveTargetIdFromNode(explorer.tree, node.id)
    }

    function isChecked(node: TreeNode) {
        const id = targetIdForNode(node)
        return id ? options.selectedIds.value.includes(id) : false
    }

    function toggleCheck(node: TreeNode) {
        const id = targetIdForNode(node)
        if (!id) return

        if (options.selectedIds.value.includes(id)) {
            options.selectedIds.value = options.selectedIds.value.filter((item) => item !== id)
            return
        }
        options.selectedIds.value = [...options.selectedIds.value, id]
    }

    function toggleExpand(nodeId: string) {
        explorer.toggleExpand(nodeId)
    }

    function selectAllVisible() {
        const merged = new Set([...options.selectedIds.value, ...selectableIds.value])
        options.selectedIds.value = Array.from(merged)
    }

    function clearVisible() {
        const visible = new Set(selectableIds.value)
        options.selectedIds.value = options.selectedIds.value.filter((id) => !visible.has(id))
    }

    const allVisibleSelected = computed(
        () =>
            selectableIds.value.length > 0 &&
            selectableIds.value.every((id) => options.selectedIds.value.includes(id)),
    )

    return {
        explorer,
        flatNodes,
        selectableIds,
        allVisibleSelected,
        isChecked,
        isCheckable: isScopeSelectableNode,
        toggleCheck,
        toggleExpand,
        selectAllVisible,
        clearVisible,
    }
}
