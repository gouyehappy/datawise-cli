import type {ContextMenuItem} from '@/core/types'
import type {ShortcutActionId} from '@/core/shortcuts/types'
import type {ComposerTranslation} from 'vue-i18n'

interface ExplorerSettingsState {
    showColumnComment: boolean
    showTableComment: boolean
    showSemanticLayer: boolean
    allCommentsVisible: boolean
}

export function getExplorerSettingsMenuItems(
    t: ComposerTranslation,
    state: ExplorerSettingsState,
    shortcutLabel: (actionId: ShortcutActionId) => string,
): ContextMenuItem[] {
    return [
        {
            id: 'toggle-column-comment',
            label: state.showColumnComment
                ? t('explorer.hideColumnComment')
                : t('explorer.showColumnComment'),
            icon: 'pin',
            shortcut: shortcutLabel('explorer.toggleColumnComment') || undefined,
        },
        {
            id: 'toggle-table-comment',
            label: state.showTableComment
                ? t('explorer.hideTableComment')
                : t('explorer.showTableComment'),
            icon: 'table',
            shortcut: shortcutLabel('explorer.toggleTableComment') || undefined,
        },
        {
            id: 'toggle-semantic-layer',
            label: state.showSemanticLayer
                ? t('explorer.hideSemanticLayer')
                : t('explorer.showSemanticLayer'),
            icon: 'format',
        },
        {id: 'divider-1', label: '', divider: true},
        {
            id: 'toggle-all-comments',
            label: state.allCommentsVisible
                ? t('explorer.hideAllComments')
                : t('explorer.showAllComments'),
            icon: 'format',
            shortcut: shortcutLabel('explorer.toggleAllComments') || undefined,
        },
    ]
}
