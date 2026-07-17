export interface VisualQueryCanvasNode {
    id: string
    kind: 'from' | 'join'
    joinIndex?: number
    table: string
    alias: string
    joinType?: string
    x: number
    y: number
    width: number
    height: number
}

export interface VisualQueryCanvasEdge {
    id: string
    fromId: string
    toId: string
    label: string
}

export interface VisualQueryCanvasLayout {
    nodes: VisualQueryCanvasNode[]
    edges: VisualQueryCanvasEdge[]
    width: number
    height: number
}

const NODE_W = 168
const NODE_H = 72
const GAP_X = 56
const PAD = 24

export function layoutVisualQueryCanvas(input: {
    fromTable: string
    fromAlias: string
    joins: Array<{table: string; alias: string; type: string}>
}): VisualQueryCanvasLayout {
    const nodes: VisualQueryCanvasNode[] = []
    const edges: VisualQueryCanvasEdge[] = []

    if (!input.fromTable.trim()) {
        return {nodes, edges, width: 480, height: 200}
    }

    nodes.push({
        id: 'from',
        kind: 'from',
        table: input.fromTable,
        alias: input.fromAlias || 't',
        x: PAD,
        y: PAD + 40,
        width: NODE_W,
        height: NODE_H,
    })

    let prevId = 'from'
    input.joins.forEach((join, index) => {
        if (!join.table.trim()) return
        const id = `join-${index}`
        nodes.push({
            id,
            kind: 'join',
            joinIndex: index,
            table: join.table,
            alias: join.alias || `t${index + 2}`,
            joinType: join.type,
            x: PAD + (index + 1) * (NODE_W + GAP_X),
            y: PAD + 40,
            width: NODE_W,
            height: NODE_H,
        })
        edges.push({
            id: `edge-${prevId}-${id}`,
            fromId: prevId,
            toId: id,
            label: join.type || 'JOIN',
        })
        prevId = id
    })

    const width = Math.max(
        480,
        PAD * 2 + nodes.length * NODE_W + Math.max(0, nodes.length - 1) * GAP_X,
    )
    const height = PAD * 2 + NODE_H + 80
    return {nodes, edges, width, height}
}
