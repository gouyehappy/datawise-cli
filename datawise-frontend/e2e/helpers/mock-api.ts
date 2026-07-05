import type {Page, Route} from '@playwright/test'

function apiBody(data: unknown) {
    return JSON.stringify({success: true, code: 0, data, msg: 'ok'})
}

const MOCK_EXPLORER_TREE = {
    tree: [
        {
            id: 'g1',
            label: 'Default',
            type: 'group',
            expanded: true,
            children: [
                {
                    id: 'conn-1',
                    label: 'Test MySQL',
                    type: 'connection',
                    dbType: 'mysql',
                    expanded: false,
                    children: [],
                },
            ],
        },
    ],
}

const MOCK_CATALOG = {
    version: 1,
    groups: [{id: 'g1', label: 'Default', sortOrder: 0, expanded: true}],
    connections: [
        {
            id: 'conn-1',
            groupId: 'g1',
            sortOrder: 0,
            config: {
                id: 'conn-1',
                name: 'Test MySQL',
                dbType: 'mysql',
                host: '127.0.0.1',
                port: 3306,
                userName: 'root',
                userPassword: '',
                databaseName: 'demo',
            },
        },
    ],
}

const MOCK_DATABASE_CHILDREN = {
    tree: [
        {
            id: 'conn-1:demo',
            label: 'demo',
            type: 'database',
            dbType: 'mysql',
            children: [],
        },
    ],
}

const MOCK_SQL_EXECUTE_RESULT = {
    sql: 'SELECT 1 AS id',
    rowCount: 1,
    durationMs: 12,
    columns: [{name: 'id', type: 'INT'}],
    rows: [{id: 1}],
}

const MOCK_PLUGINS = [
    {
        id: 'p-ai-workbench',
        name: 'AI Workbench',
        version: '1.0.0',
        author: 'DataWise',
        description: 'AI',
        enabled: true,
        category: 'ai',
    },
    {
        id: 'p-grid-export',
        name: 'Grid Export',
        version: '1.0.0',
        author: 'DataWise',
        description: 'Export',
        enabled: true,
        category: 'utility',
    },
    {
        id: 'p-sql-format',
        name: 'SQL Format',
        version: '1.0.0',
        author: 'DataWise',
        description: 'Format',
        enabled: true,
        category: 'utility',
    },
    {
        id: 'p-sql-history',
        name: 'SQL History',
        version: '1.0.0',
        author: 'DataWise',
        description: 'History',
        enabled: true,
        category: 'utility',
    },
    {
        id: 'p-sql-monitor',
        name: 'SQL Monitor',
        version: '1.0.0',
        author: 'DataWise',
        description: 'Monitor',
        enabled: true,
        category: 'utility',
    },
]

const AI_CHAT_SEED = {
    version: 1,
    activeSessionId: 'sess-e2e',
    sessions: [
        {
            id: 'sess-e2e',
            title: 'E2E',
            createdAt: Date.now(),
            updatedAt: Date.now(),
            selectedTargetIds: ['conn-1:__conn__'],
            messages: [{id: 'welcome', role: 'assistant', content: '', time: '', kind: 'welcome'}],
        },
    ],
}

export function buildAnalysisSseBody() {
    return [
        'event: step',
        'data: {"step":"intent","status":"ok","message":"数据源已确认"}',
        '',
        'event: step',
        'data: {"step":"summary","status":"ok","message":"摘要完成"}',
        '',
        'event: result',
        'data: {"reply":"分析完成","sql":"SELECT 1"}',
        '',
    ].join('\n')
}

export async function installWorkspaceE2eMocks(page: Page) {
    await page.addInitScript(() => {
        localStorage.setItem('dw-cli-onboarding-completed', '1')
    })
    await page.route('**/*', async (route: Route) => {
        const url = new URL(route.request().url())
        const path = url.pathname

        if (path === '/api/health') {
            return route.fulfill({
                status: 200,
                contentType: 'application/json',
                body: apiBody({status: 'ok', version: 'e2e', serverTime: new Date().toISOString()}),
            })
        }
        if (path === '/login/guest') {
            return route.fulfill({
                status: 200,
                contentType: 'application/json',
                body: apiBody({sessionId: 'session-e2e-guest', userName: 'guest'}),
            })
        }
        if (path === '/api/config/app') {
            return route.fulfill({
                status: 200,
                contentType: 'application/json',
                body: apiBody({
                    version: 1,
                    ai: {analysisMode: 'smart', skipSqlConfirmation: true},
                    sideRail: {visibleModules: ['database', 'dashboard', 'ai', 'plugin']},
                }),
            })
        }
        if (path === '/api/config/connections') {
            return route.fulfill({status: 200, contentType: 'application/json', body: apiBody(MOCK_CATALOG)})
        }
        if (path === '/api/explorer/tree') {
            return route.fulfill({
                status: 200,
                contentType: 'application/json',
                body: apiBody(MOCK_EXPLORER_TREE),
            })
        }
        if (path === '/api/plugins') {
            return route.fulfill({status: 200, contentType: 'application/json', body: apiBody(MOCK_PLUGINS)})
        }
        if (path === '/api/teams') {
            return route.fulfill({status: 200, contentType: 'application/json', body: apiBody([])})
        }
        if (path.startsWith('/api/explorer/connections/') && path.endsWith('/ping')) {
            return route.fulfill({
                status: 200,
                contentType: 'application/json',
                body: apiBody({ok: true, latencyMs: 3}),
            })
        }
        if (path.startsWith('/api/explorer/connections/') && path.endsWith('/children')) {
            return route.fulfill({
                status: 200,
                contentType: 'application/json',
                body: apiBody(MOCK_DATABASE_CHILDREN),
            })
        }
        if (path === '/api/sql/execute') {
            return route.fulfill({
                status: 200,
                contentType: 'application/json',
                body: apiBody(MOCK_SQL_EXECUTE_RESULT),
            })
        }
        if (path.startsWith('/api/workspace/')) {
            return route.fulfill({status: 200, contentType: 'application/json', body: apiBody([])})
        }
        if (path.startsWith('/api/notifications')) {
            return route.fulfill({status: 200, contentType: 'application/json', body: apiBody([])})
        }

        if (path.startsWith('/api/')) {
            return route.fulfill({status: 200, contentType: 'application/json', body: apiBody(null)})
        }

        return route.continue()
    })
}

export async function installAnalysisE2eMocks(page: Page, sseBody = buildAnalysisSseBody()) {
    await page.addInitScript(() => {
        localStorage.setItem('dw-cli-onboarding-completed', '1')
    })
    await page.addInitScript((seed) => {
        localStorage.setItem('dw-cli-ai-chat', JSON.stringify(seed))
    }, AI_CHAT_SEED)

    await page.route('**/*', async (route: Route) => {
        const url = new URL(route.request().url())
        const path = url.pathname

        if (path === '/api/health') {
            return route.fulfill({
                status: 200,
                contentType: 'application/json',
                body: apiBody({status: 'ok', version: 'e2e', serverTime: new Date().toISOString()}),
            })
        }
        if (path === '/login/guest') {
            return route.fulfill({
                status: 200,
                contentType: 'application/json',
                body: apiBody({sessionId: 'session-e2e-guest', userName: 'guest'}),
            })
        }
        if (path === '/api/config/app') {
            return route.fulfill({
                status: 200,
                contentType: 'application/json',
                body: apiBody({
                    version: 1,
                    ai: {analysisMode: 'smart', skipSqlConfirmation: true},
                    sideRail: {visibleModules: ['database', 'dashboard', 'ai', 'plugin']},
                }),
            })
        }
        if (path === '/api/config/connections') {
            return route.fulfill({status: 200, contentType: 'application/json', body: apiBody(MOCK_CATALOG)})
        }
        if (path === '/api/explorer/tree') {
            return route.fulfill({
                status: 200,
                contentType: 'application/json',
                body: apiBody(MOCK_EXPLORER_TREE),
            })
        }
        if (path === '/api/plugins') {
            return route.fulfill({status: 200, contentType: 'application/json', body: apiBody(MOCK_PLUGINS)})
        }
        if (path === '/api/teams') {
            return route.fulfill({status: 200, contentType: 'application/json', body: apiBody([])})
        }
        if (path.startsWith('/api/explorer/connections/') && path.endsWith('/children')) {
            return route.fulfill({
                status: 200,
                contentType: 'application/json',
                body: apiBody(MOCK_DATABASE_CHILDREN),
            })
        }
        if (path === '/api/sql/execute') {
            return route.fulfill({
                status: 200,
                contentType: 'application/json',
                body: apiBody(MOCK_SQL_EXECUTE_RESULT),
            })
        }
        if (path === '/api/ai/analyze/stream') {
            return route.fulfill({
                status: 200,
                headers: {'Content-Type': 'text/event-stream'},
                body: sseBody,
            })
        }
        if (path.startsWith('/api/workspace/')) {
            return route.fulfill({status: 200, contentType: 'application/json', body: apiBody([])})
        }
        if (path.startsWith('/api/notifications')) {
            return route.fulfill({status: 200, contentType: 'application/json', body: apiBody([])})
        }

        if (path.startsWith('/api/')) {
            return route.fulfill({status: 200, contentType: 'application/json', body: apiBody(null)})
        }

        return route.continue()
    })
}
