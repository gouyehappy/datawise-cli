#!/usr/bin/env node
import {McpServer} from '@modelcontextprotocol/sdk/server/mcp.js'
import {StdioServerTransport} from '@modelcontextprotocol/sdk/server/stdio.js'
import {z} from 'zod'

const BASE_URL = (process.env.DATAWISE_API_URL ?? 'http://localhost:18421').replace(/\/$/, '')
const SESSION_ID = process.env.DATAWISE_SESSION_ID ?? ''
const API_TOKEN = process.env.DATAWISE_API_TOKEN ?? ''

async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
    const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        ...(init?.headers as Record<string, string> | undefined),
    }
    if (SESSION_ID) headers['X-Session-Id'] = SESSION_ID
    if (API_TOKEN) headers['Authorization'] = `Bearer ${API_TOKEN}`

    const response = await fetch(`${BASE_URL}${path}`, {...init, headers})
    const body = await response.json() as {code?: number; data?: T; msg?: string}
    if (!response.ok || (body.code != null && body.code !== 0)) {
        throw new Error(body.msg ?? `HTTP ${response.status}`)
    }
    return body.data as T
}

const server = new McpServer({
    name: 'datawise',
    version: '0.1.0',
})

server.tool(
    'list_connections',
    'List visible database connections in DataWise',
    {},
    async () => {
        const rows = await apiFetch<Array<Record<string, string>>>('/api/platform/mcp/connections')
        return {content: [{type: 'text', text: JSON.stringify(rows, null, 2)}]}
    },
)

server.tool(
    'list_tables',
    'List tables for a connection and database',
    {
        connectionId: z.string(),
        database: z.string(),
    },
    async ({connectionId, database}) => {
        const params = new URLSearchParams({connectionId, database})
        const tables = await apiFetch<string[]>(`/api/platform/mcp/schema/tables?${params}`)
        return {content: [{type: 'text', text: JSON.stringify(tables, null, 2)}]}
    },
)

server.tool(
    'review_sql',
    'Review SQL for safety issues before execution',
    {
        sql: z.string(),
        connectionId: z.string(),
        database: z.string().optional(),
    },
    async (args) => {
        const result = await apiFetch<unknown>('/api/platform/mcp/sql/review', {
            method: 'POST',
            body: JSON.stringify(args),
        })
        return {content: [{type: 'text', text: JSON.stringify(result, null, 2)}]}
    },
)

server.tool(
    'execute_readonly_sql',
    'Execute read-only SQL through DataWise safety layer',
    {
        sql: z.string(),
        connectionId: z.string(),
        database: z.string().optional(),
        maxRows: z.number().optional(),
    },
    async (args) => {
        const result = await apiFetch<unknown>('/api/platform/mcp/sql/execute-readonly', {
            method: 'POST',
            body: JSON.stringify({
                sql: args.sql,
                connectionId: args.connectionId,
                database: args.database,
                maxRows: args.maxRows ?? 200,
            }),
        })
        return {content: [{type: 'text', text: JSON.stringify(result, null, 2)}]}
    },
)

server.tool(
    'compare_schema',
    'Compare schema drift between source and target environments',
    {
        sourceConnectionId: z.string(),
        sourceDatabase: z.string().optional(),
        targetConnectionId: z.string(),
        targetDatabase: z.string().optional(),
        tablePattern: z.string().optional(),
    },
    async (args) => {
        const result = await apiFetch<unknown>('/api/platform/mcp/schema-drift/compare', {
            method: 'POST',
            body: JSON.stringify(args),
        })
        return {content: [{type: 'text', text: JSON.stringify(result, null, 2)}]}
    },
)

async function main() {
    const transport = new StdioServerTransport()
    await server.connect(transport)
}

main().catch((error) => {
    console.error(error)
    process.exit(1)
})
