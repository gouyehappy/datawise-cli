import {useLayoutStore} from '@/features/layout/stores/layout'
import {useWorkspaceStore} from '@/features/workspace/stores/workspace'
import {extractSqlFromContent} from '@/features/ai/chat/services/ai-chat.service'
import type {AiDatabaseTarget} from '@/features/ai/shared/utils/database-targets'
import {useI18n} from 'vue-i18n'
import type {Ref} from 'vue'

/** �?AI 回复中的 SQL 打开到工作区控制�?*/
export function useAiConsoleBridge(selectedTargets: Ref<AiDatabaseTarget[]>) {
    const {t} = useI18n()
    const layout = useLayoutStore()
    const workspace = useWorkspaceStore()

    function openInConsole(content: string) {
        const sql = extractSqlFromContent(content)
        if (!sql) {
            layout.showToast(t('ai.noSqlInReply'))
            return
        }

        const target = selectedTargets.value[0]
        layout.setModule('database')
        workspace.openConsole({
            sql,
            connectionId: target?.connectionId,
            connectionName: target?.connectionLabel,
            instanceId: target && target.databaseId !== '__conn__' ? target.databaseId : null,
        })
    }

    return {extractSqlFromContent, openInConsole}
}
