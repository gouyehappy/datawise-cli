import {computed} from 'vue'
import {storeToRefs} from 'pinia'
import {formatTargetLabel} from '@/features/ai/shared/utils/database-targets'
import {
    type AiTaggedScopeContext,
    useAiTaggedScopeContext,
} from '@/features/ai/datasource/composables/ai-tagged-scope.context'
import {useAiChatStore} from '@/features/ai/stores/ai-chat'

/** AI 聊天：基于已打标表的数据范围选择 */
export function useAiDatabaseScope(scope?: AiTaggedScopeContext) {
    const aiChat = useAiChatStore()
    const {activeSession} = storeToRefs(aiChat)
    const {allTargets} = scope ?? useAiTaggedScopeContext()

    const selectedTargetIds = computed({
        get: () => activeSession.value?.selectedTargetIds ?? [],
        set: (ids: string[]) => aiChat.setSelectedTargetIds(ids),
    })

    const selectedTargets = computed(() =>
        allTargets.value.filter((target) => selectedTargetIds.value.includes(target.id)),
    )

    function removeTarget(id: string) {
        selectedTargetIds.value = selectedTargetIds.value.filter((item) => item !== id)
    }

    return {
        allTargets,
        selectedTargetIds,
        selectedTargets,
        removeTarget,
        formatTargetLabel,
    }
}
