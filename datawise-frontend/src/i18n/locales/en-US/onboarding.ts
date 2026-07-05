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
            title: 'Welcome to DataWise',
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
    },
}
