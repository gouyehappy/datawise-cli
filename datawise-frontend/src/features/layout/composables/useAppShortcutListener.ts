import {onMounted, onUnmounted} from 'vue'
import {SHORTCUT_DEFINITIONS} from '@/core/shortcuts/definitions'
import {executeShortcutAction} from '@/core/shortcuts/execute-action'
import {
    isEditableTarget,
    isTerminalTarget,
    matchesBinding,
    stripTrailingShortcutHint,
} from '@/core/shortcuts/shortcut.service'
import type {ShortcutActionId} from '@/core/shortcuts/types'
import {useShortcutSettingsStore} from '@/features/settings/stores/shortcut-settings-store'
import {useAppPalette} from '@/features/layout/composables/useAppPalette'

/** Monaco / 输入框内仍需响应（与 SQL 编辑器 Tab 注册的 handler 联动） */
const EDITABLE_TARGET_SHORTCUTS: ShortcutActionId[] = [
    'explorer.search',
    'workspace.newConsole',
    'workspace.runSql',
    'workspace.saveConsole',
    'workspace.aiPrompt',
]

export function useAppShortcutListener() {
    const shortcuts = useShortcutSettingsStore()
    const {togglePalette} = useAppPalette()

    function tryExecuteShortcuts(event: KeyboardEvent, actionIds: ShortcutActionId[]): boolean {
        for (const actionId of actionIds) {
            const binding = shortcuts.getBinding(actionId)
            if (!binding || !matchesBinding(event, binding)) continue
            event.preventDefault()
            event.stopImmediatePropagation()
            executeShortcutAction(actionId)
            return true
        }
        return false
    }

    function onKeydown(event: KeyboardEvent) {
        const key = event.key.toLowerCase()
        if ((event.ctrlKey || event.metaKey) && key === 'k') {
            event.preventDefault()
            togglePalette()
            return
        }

        // SSH / xterm: never steal `/`, Ctrl+R, etc. — xterm uses a textarea that would
        // otherwise match EDITABLE_TARGET_SHORTCUTS and swallow the key before the PTY.
        if (isTerminalTarget(event.target)) {
            return
        }

        if (isEditableTarget(event.target)) {
            if (tryExecuteShortcuts(event, EDITABLE_TARGET_SHORTCUTS)) return
            return
        }

        if (tryExecuteShortcuts(event, SHORTCUT_DEFINITIONS.map((def) => def.id))) return
    }

    onMounted(() => window.addEventListener('keydown', onKeydown, true))
    onUnmounted(() => window.removeEventListener('keydown', onKeydown, true))
}

export function formatShortcutLabel(actionId: ShortcutActionId): string {
    const shortcuts = useShortcutSettingsStore()
    return shortcuts.getDisplayBinding(actionId)
}

export function shortcutTooltip(label: string, actionId: ShortcutActionId): string {
    const hint = formatShortcutLabel(actionId)
    const base = stripTrailingShortcutHint(label)
    return hint ? `${base} (${hint})` : base
}
