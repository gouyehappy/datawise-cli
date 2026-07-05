import {registerSqlCompletionProvider} from './completion/monaco/provider'
import {registerSqlEditorAiAssistCommand} from './completion/monaco/ai-assist-command'
import {preloadCompletionWorker} from './completion/completion-worker-client'

let initialized = false

/** 注册 Monaco SQL 补全（幂等，由插件安装或 SqlEditor 挂载时调用） */
export function ensureSqlEditorSetup() {
    if (initialized) return
    initialized = true
    preloadCompletionWorker()
    registerSqlEditorAiAssistCommand()
    registerSqlCompletionProvider()
}
