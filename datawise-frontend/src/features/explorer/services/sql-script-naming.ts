const SCRIPT_NAME_PATTERN = /^script-(\d+)\.sql$/i

export function nextScriptFileName(files: { fileName: string }[]): string {
    const numbers = files
        .map((file) => SCRIPT_NAME_PATTERN.exec(file.fileName)?.[1])
        .filter((value): value is string => !!value)
        .map((value) => Number.parseInt(value, 10))
        .filter((value) => Number.isFinite(value))

    const next = numbers.length > 0 ? Math.max(...numbers) + 1 : 1
    return `Script-${next}.sql`
}
