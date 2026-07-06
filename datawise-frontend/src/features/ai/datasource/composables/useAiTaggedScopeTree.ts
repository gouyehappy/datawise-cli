import {computed, ref, type Ref} from 'vue'
import type {TreeNode} from '@/core/types'
import {buildAiTaggedScopeFlatNodes} from '@/features/ai/tag/services/ai-tagged-scope.service'
import type {AiTaggedScopeGroup} from '@/features/ai/tag/types/ai-table-tag.types'

export function useAiTaggedScopeTree(
    groups: Ref<AiTaggedScopeGroup[]>,
    search: Ref<string>,
    selectedIds: Ref<string[]>,
) {
    const collapsedIds = ref<Set<string>>(new Set())

    const flatNodes = computed(() =>
        buildAiTaggedScopeFlatNodes(groups.value, search.value, collapsedIds.value),
    )

    const visibleTableIds = computed(() =>
        flatNodes.value
            .filter(({node}) => node.type === 'table')
            .map(({node}) => node.id),
    )

    const allVisibleSelected = computed(() =>
        visibleTableIds.value.length > 0
        && visibleTableIds.value.every((id) => selectedIds.value.includes(id)),
    )

    function toggleExpand(nodeId: string) {
        const next = new Set(collapsedIds.value)
        if (next.has(nodeId)) next.delete(nodeId)
        else next.add(nodeId)
        collapsedIds.value = next
    }

    function isCheckable(node: TreeNode) {
        return node.type === 'table'
    }

    function isChecked(node: TreeNode) {
        return selectedIds.value.includes(node.id)
    }

    function toggleCheck(node: TreeNode) {
        if (node.type !== 'table') return
        if (selectedIds.value.includes(node.id)) {
            selectedIds.value = selectedIds.value.filter((id) => id !== node.id)
            return
        }
        selectedIds.value = [...selectedIds.value, node.id]
    }

    function selectAllVisible() {
        selectedIds.value = Array.from(new Set([...selectedIds.value, ...visibleTableIds.value]))
    }

    function clearVisible() {
        const visible = new Set(visibleTableIds.value)
        selectedIds.value = selectedIds.value.filter((id) => !visible.has(id))
    }

    return {
        flatNodes,
        allVisibleSelected,
        toggleExpand,
        isCheckable,
        isChecked,
        toggleCheck,
        selectAllVisible,
        clearVisible,
    }
}
