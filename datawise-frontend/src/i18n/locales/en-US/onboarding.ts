export default {
    title: 'Getting started',
    subtitle: 'Follow the spotlight to learn the essentials',
    stepOf: 'Step {current} of {total}',
    skip: 'Skip',
    back: 'Back',
    next: 'Next',
    finish: 'Get started',
    steps: {
        welcome: {
            title: 'Welcome',
            body: 'We will highlight key areas on screen — connect to data, write SQL, and use AI in just a few steps.',
        },
        home: {
            title: 'Your profile',
            body: 'Tap Home to open the menu: sign in, profile, settings, and reopen this tour anytime.',
            hint: 'Look here',
        },
        database: {
            title: 'Database workbench',
            body: 'Your daily starting point. Opens the database module: connection tree on the left, SQL workspace on the right.',
            hint: 'Left rail',
        },
        explorer: {
            title: 'Connections & tree',
            body: 'Expand connection → instance → tables. Double-click a table for data; manage scripts under Workspaces.',
            hint: 'Explorer panel',
        },
        workspace: {
            title: 'SQL workspace',
            body: 'Create consoles, write and run SQL, view results in the grid below. Drop .sql files to open them.',
            hint: 'Main editor',
        },
        ai: {
            title: 'AI assistant',
            body: 'Switch to AI for natural-language SQL, explain/optimize, and DataAgent smart analysis with charts.',
            hint: 'AI entry',
        },
        terminal: {
            title: 'Built-in terminal',
            body: 'Open the terminal panel at the bottom for shell commands alongside your workflow.',
            hint: 'Terminal button',
        },
        tips: {
            title: 'Pro tip',
            body: 'Press Ctrl+K for the command palette — jump modules or create a console instantly. Customize shortcuts in Settings.',
        },
        insightWelcome: {
            title: 'Connection ready — get insight in 30 seconds',
            body: 'Great, your first connection is live. Follow this 3-step path: pick scope, ask AI, and get a result fast.',
        },
        insightExplorer: {
            title: 'Pick your core table in Explorer',
            body: 'Start with one business table (orders, users, payments). AI SQL quality improves with focused context.',
            hint: 'Choose data scope first',
        },
        insightAi: {
            title: 'Ask AI a business question',
            body: 'Try: "Show order trend and anomalies for the last 7 days." You get SQL, summary, and chart in one flow.',
            hint: 'Ask one business question',
        },
        insightDone: {
            title: 'You completed the first insight loop',
            body: 'Next best step: save as analysis canvas and schedule rerun for automatic weekly insights.',
        },
    },
}
