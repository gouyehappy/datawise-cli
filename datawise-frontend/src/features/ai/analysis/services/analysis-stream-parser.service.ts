export function parseSseBlock(block: string): { event: string; data: string } | null {
    const lines = block.split('\n')
    let event = 'message'
    const dataLines: string[] = []
    for (const line of lines) {
        if (line.startsWith('event:')) {
            event = line.slice(6).trim()
        } else if (line.startsWith('data:')) {
            dataLines.push(line.slice(5).trim())
        }
    }
    if (!dataLines.length) return null
    return {event, data: dataLines.join('\n')}
}
