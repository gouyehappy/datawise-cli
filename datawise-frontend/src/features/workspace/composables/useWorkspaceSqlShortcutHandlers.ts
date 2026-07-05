import {onUnmounted, watch, type WatchSource} from 'vue'
import {
    clearConsoleShortcutHandlers,
    registerConsoleShortcutHandlers,
} from '@/core/shortcuts/action-registry'

export interface WorkspaceSqlShortcutHandlers {
    onRun?: () => void
    onSave?: () => void
    onAiPrompt?: () => void
}

/** 活跃 SQL 编辑器 Tab 注册 Ctrl+R / Ctrl+S / / 等全局快捷键回调 */
export function useWorkspaceSqlShortcutHandlers(
    handlers: WatchSource<WorkspaceSqlShortcutHandlers>,
) {
    watch(
        handlers,
        (value) => {
            registerConsoleShortcutHandlers(value)
        },
        {immediate: true, deep: true},
    )

    onUnmounted(() => {
        clearConsoleShortcutHandlers()
    })
}
