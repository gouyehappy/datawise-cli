export default {
    title: 'Getting started',
    subtitle: 'A guided tour of the core workspace areas',
    stepOf: 'Step {current} of {total}',
    skip: 'Skip',
    back: 'Back',
    next: 'Next',
    finish: 'Get started',
    steps: {
        welcome: {
            title: 'Welcome',
            body: 'This tour highlights key areas of the interface so you can connect data, write SQL, and use AI analysis with confidence.',
        },
        home: {
            title: 'Your profile',
            body: 'Open Home to access sign-in, profile, settings, and reopen this tour anytime.',
            hint: 'Profile menu',
        },
        database: {
            title: 'Database workbench',
            body: 'Your primary workspace. Opens the database module: connection tree on the left, SQL workspace on the right.',
            hint: 'Left rail',
        },
        explorer: {
            title: 'Connections & tree',
            body: 'Expand connection → instance → tables. Double-click a table for data; manage scripts under Workspaces.',
            hint: 'Explorer panel',
        },
        workspace: {
            title: 'SQL workspace',
            body: 'Create consoles, write and run SQL, and review results in the grid below. Drop .sql files to open them.',
            hint: 'Main editor',
        },
        ai: {
            title: 'AI assistant',
            body: 'Switch to AI for natural-language SQL, explain/optimize, and DataAgent analysis with charts.',
            hint: 'AI entry',
        },
        terminal: {
            title: 'Built-in terminal',
            body: 'Open the terminal panel at the bottom for shell commands alongside your workflow.',
            hint: 'Terminal button',
        },
        tips: {
            title: 'Productivity tip',
            body: 'Press Ctrl+K for the command palette — jump between modules or create a console quickly. Customize shortcuts in Settings.',
        },
        insightWelcome: {
            title: 'Connection ready — start your first insight',
            body: 'Your first connection is configured. Follow these 3 steps: select a table, ask a question, and review the result.',
        },
        insightExplorer: {
            title: 'Select a target table in Explorer',
            body: 'Start with one primary business table (orders, users, payments). Focused context improves AI SQL quality.',
            hint: 'Choose data scope',
        },
        insightAi: {
            title: 'Switch to AI and ask a business question',
            body: 'For example: "Show order trends and anomalies for the last 7 days." You get SQL, a summary, and a chart — results can be sent to the console.',
            hint: 'Ask a business question',
        },
        insightDone: {
            title: 'First insight complete',
            body: 'Next: save the result as an analysis canvas and schedule a rerun so insights stay up to date.',
        },
    },
}
