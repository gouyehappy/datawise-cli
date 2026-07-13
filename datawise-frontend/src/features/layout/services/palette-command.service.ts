import {SHORTCUT_DEFINITIONS} from '@/core/shortcuts/definitions'
import type {ShortcutActionId, ShortcutDefinition} from '@/core/shortcuts/types'
import {canExecuteShortcutAction} from '@/features/auth/services/feature-permission.service'

/** Palette 可执行的命令（复用快捷键动作，排除自身以免循环） */
const PALETTE_COMMAND_IDS = new Set<ShortcutActionId>([
    'workspace.newConsole',
    'workspace.runSql',
    'workspace.saveConsole',
    'workspace.aiPrompt',
    'explorer.refresh',
    'explorer.locate',
    'app.toggleTerminal',
    'app.toggleNotifications',
    'app.openSettings',
])

export interface PaletteCommandEntry {
    id: ShortcutActionId
    labelKey: string
}

const PALETTE_COMMANDS: PaletteCommandEntry[] = SHORTCUT_DEFINITIONS.filter((def) =>
    PALETTE_COMMAND_IDS.has(def.id),
).map((def) => ({id: def.id, labelKey: def.labelKey}))

function accessiblePaletteCommands(): PaletteCommandEntry[] {
    return PALETTE_COMMANDS.filter((def) => canExecuteShortcutAction(def.id))
}

export function listPaletteCommands(): PaletteCommandEntry[] {
    return accessiblePaletteCommands()
}

export function isPaletteCommandMode(query: string): boolean {
    return query.trimStart().startsWith('>')
}

export function paletteCommandQuery(query: string): string {
    return query.trimStart().slice(1).trim()
}

function matchesCommand(def: PaletteCommandEntry, query: string, labelOf: (key: string) => string): boolean {
    const needle = query.trim().toLowerCase()
    if (!needle) return true
    const label = labelOf(def.labelKey).toLowerCase()
    const id = def.id.toLowerCase()
    return label.includes(needle) || id.includes(needle)
}

export function searchPaletteCommands(
    query: string,
    labelOf: (key: string) => string,
): PaletteCommandEntry[] {
    const effective = isPaletteCommandMode(query) ? paletteCommandQuery(query) : query.trim()
    return accessiblePaletteCommands().filter((def) => matchesCommand(def, effective, labelOf))
}

export function shortcutDefinitionFor(id: ShortcutActionId): ShortcutDefinition | undefined {
    return SHORTCUT_DEFINITIONS.find((def) => def.id === id)
}
