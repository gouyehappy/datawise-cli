import {ref} from 'vue'
import {useI18n} from 'vue-i18n'
import {useLayoutStore} from '@/features/layout/stores/layout'
import {useShortcutPanelStore} from '@/features/layout/stores/shortcut-panel-store'

export type BookmarkDefaults = {
    name: string
    connectionName: string
    sql: string
}

export function useQueryBookmarkSave(resolveDefaults: () => BookmarkDefaults) {
    const {t} = useI18n()
    const layout = useLayoutStore()
    const shortcutPanel = useShortcutPanelStore()

    const bookmarkDialogOpen = ref(false)
    const bookmarkSaving = ref(false)
    const bookmarkDefaults = ref<BookmarkDefaults>({
        name: '',
        connectionName: '',
        sql: '',
    })

    function openSaveBookmarkDialog() {
        bookmarkDefaults.value = resolveDefaults()
        bookmarkDialogOpen.value = true
    }

    async function onSaveBookmark(payload: {
        name: string
        connectionName: string
        sql: string
        folder: string
        tags: string[]
    }) {
        bookmarkSaving.value = true
        try {
            await shortcutPanel.saveConsole(payload)
            bookmarkDialogOpen.value = false
            layout.showToast(t('shortcut.bookmarks.saveSuccess'))
        } catch {
            layout.showToast(t('shortcut.bookmarks.saveFailed'))
        } finally {
            bookmarkSaving.value = false
        }
    }

    return {
        bookmarkDialogOpen,
        bookmarkSaving,
        bookmarkDefaults,
        openSaveBookmarkDialog,
        onSaveBookmark,
    }
}
