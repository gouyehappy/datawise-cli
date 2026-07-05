export type ShortcutCategory = 'explorer' | 'workspace' | 'app'

export type ShortcutActionId =
    | 'explorer.search'
    | 'explorer.refresh'
    | 'explorer.locate'
    | 'explorer.openNode'
    | 'explorer.editNode'
    | 'explorer.deleteNode'
    | 'explorer.openDatabaseSql'
    | 'explorer.openRecentDatabaseSql'
    | 'explorer.newDatabaseSql'
    | 'explorer.openDatabaseConsole'
    | 'explorer.toggleColumnComment'
    | 'explorer.toggleTableComment'
    | 'explorer.toggleAllComments'
    | 'workspace.newConsole'
    | 'workspace.runSql'
    | 'workspace.saveConsole'
    | 'workspace.aiPrompt'
    | 'app.openSettings'
    | 'app.toggleTerminal'
    | 'app.toggleNotifications'
    | 'app.globalObjectSearch'

export interface ShortcutDefinition {
    id: ShortcutActionId
    category: ShortcutCategory
    labelKey: string
    defaultBinding: string
    icon: string
}

export type ShortcutPreferences = Partial<Record<ShortcutActionId, string>>
