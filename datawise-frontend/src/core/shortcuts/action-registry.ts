type ConsoleHandlers = {
    onRun?: () => void
    onSave?: () => void
    onAiPrompt?: () => void
}

let consoleHandlers: ConsoleHandlers = {}
let focusExplorerSearch: (() => void) | null = null
let scrollExplorerToNode: ((nodeId: string) => void) | null = null

export function registerConsoleShortcutHandlers(handlers: ConsoleHandlers) {
    consoleHandlers = handlers
}

export function clearConsoleShortcutHandlers() {
    consoleHandlers = {}
}

export function getConsoleShortcutHandlers() {
    return consoleHandlers
}

export function registerExplorerSearchFocus(handler: () => void) {
    focusExplorerSearch = handler
}

export function clearExplorerSearchFocus() {
    focusExplorerSearch = null
}

export function focusExplorerSearchInput() {
    focusExplorerSearch?.()
}

export function registerExplorerNodeScroll(handler: (nodeId: string) => void) {
    scrollExplorerToNode = handler
}

export function clearExplorerNodeScroll() {
    scrollExplorerToNode = null
}

export function scrollExplorerNodeIntoView(nodeId: string) {
    scrollExplorerToNode?.(nodeId)
}
