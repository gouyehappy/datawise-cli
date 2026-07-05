/** 工作区根目录下固定子目录（相对路径不可单独配置） */
export const DATA_DIRECTORY_SUBDIRS = [
    {id: 'scripts', segment: 'scripts', labelKey: 'settings.basic.workspaceRoot.subdirs.scripts', hintKey: 'settings.basic.workspaceRoot.subdirs.scriptsHint'},
    {id: 'logs', segment: 'logs', labelKey: 'settings.basic.workspaceRoot.subdirs.logs', hintKey: 'settings.basic.workspaceRoot.subdirs.logsHint'},
    {id: 'plugins', segment: 'plugins', labelKey: 'settings.basic.workspaceRoot.subdirs.plugins', hintKey: 'settings.basic.workspaceRoot.subdirs.pluginsHint'},
    {id: 'drivers', segment: 'drivers', labelKey: 'settings.basic.workspaceRoot.subdirs.drivers', hintKey: 'settings.basic.workspaceRoot.subdirs.driversHint'},
    {id: 'cache', segment: 'cache', labelKey: 'settings.basic.workspaceRoot.subdirs.cache', hintKey: 'settings.basic.workspaceRoot.subdirs.cacheHint'},
] as const

export type DataDirectorySubdirId = (typeof DATA_DIRECTORY_SUBDIRS)[number]['id']

export interface ResolvedDataDirectoryLayout {
    root: string
    entries: Array<{
        id: DataDirectorySubdirId
        segment: string
        labelKey: string
        hintKey: string
        resolved: string
    }>
}

function joinRootSegment(root: string, segment: string): string {
    const trimmedRoot = root.replace(/[/\\]+$/, '')
    if (!trimmedRoot) return segment
    const separator = trimmedRoot.includes('\\') ? '\\' : '/'
    return `${trimmedRoot}${separator}${segment}`
}

/** 由工作区根路径与 health 中的 scripts 路径生成只读目录布局 */
export function resolveDataDirectoryLayout(
    root: string,
    scriptsPath?: string,
): ResolvedDataDirectoryLayout {
    return {
        root,
        entries: DATA_DIRECTORY_SUBDIRS.map((entry) => ({
            ...entry,
            resolved: entry.id === 'scripts' && scriptsPath
                ? scriptsPath
                : joinRootSegment(root, entry.segment),
        })),
    }
}
