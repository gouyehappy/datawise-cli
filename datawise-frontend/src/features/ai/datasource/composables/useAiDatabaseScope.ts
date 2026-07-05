import {computed} from 'vue'
import {storeToRefs} from 'pinia'
import {
    extractDatabaseTargets,
    formatTargetLabel,
} from '@/features/ai/shared/utils/database-targets'
import {useAiChatStore} from '@/features/ai/stores/ai-chat'
import {useExplorerStore} from '@/features/explorer/stores/explorer'

/** AI 聊天：数据库目标选择与范�?*/
export function useAiDatabaseScope() {
    const explorer = useExplorerStore()
    const aiChat = useAiChatStore()
    const {activeSession} = storeToRefs(aiChat)

    const allTargets = computed(() => extractDatabaseTargets(explorer.tree))

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
