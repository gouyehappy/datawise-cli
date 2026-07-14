/**
 * 工作区全局快捷键
 *
 * 在 SqlConsoleTab 里调用 useGlobalShortcuts({ onRun, onSave, onAiPrompt }) 注册回调。
 *
 * | 快捷键           | 作用           |
 * |------------------|----------------|
 * | Ctrl+Shift+L     | 新建控制台 Tab |
 * | Ctrl+R           | 执行 SQL       |
 * | Ctrl+S           | 保存控制台     |
 * | Alt+/            | 唤起 AI 输入框 |
 */
import {onMounted, onUnmounted} from 'vue'
import {useWorkspaceStore} from '@/features/workspace/stores/workspace'

type ShortcutHandler = () => void

const isMac = typeof navigator !== 'undefined' && /Mac/.test(navigator.platform)

function matchShortcut(
    e: KeyboardEvent,
    key: string,
    modifiers: { ctrl?: boolean; shift?: boolean; alt?: boolean },
) {
    const modKey = isMac ? e.metaKey : e.ctrlKey
    if (modifiers.ctrl !== undefined && modKey !== modifiers.ctrl) return false
    if (modifiers.shift !== undefined && e.shiftKey !== modifiers.shift) return false
    if (modifiers.alt !== undefined && e.altKey !== modifiers.alt) return false
    return e.key.toLowerCase() === key.toLowerCase()
}

export function useGlobalShortcuts(handlers?: {
    onRun?: ShortcutHandler
    onSave?: ShortcutHandler
    onAiPrompt?: ShortcutHandler
}) {
    const workspace = useWorkspaceStore()

    function onKeydown(e: KeyboardEvent) {
        if (matchShortcut(e, 'l', {ctrl: true, shift: true})) {
            e.preventDefault()
            workspace.openConsole()
            return
        }
        if (matchShortcut(e, 's', {ctrl: true}) && workspace.activeTab?.type === 'console') {
            e.preventDefault()
            handlers?.onSave?.()
            return
        }
        if (matchShortcut(e, 'r', {ctrl: true}) && workspace.activeTab?.type === 'console') {
            e.preventDefault()
            handlers?.onRun?.()
            return
        }
        if (
            matchShortcut(e, '/', {alt: true, ctrl: false})
            && workspace.activeTab?.type === 'console'
        ) {
            e.preventDefault()
            handlers?.onAiPrompt?.()
        }
    }

    onMounted(() => window.addEventListener('keydown', onKeydown))
    onUnmounted(() => window.removeEventListener('keydown', onKeydown))
}
