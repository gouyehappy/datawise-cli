# DataWise

[简体中文](./README.zh-CN.md)

**Open-source polyglot database workbench** — Explorer, SQL console, table migration, AI analytics, and a desktop client in one monorepo.

Develop in the browser; ship a Windows desktop app with embedded backend and JRE. Plug in connectors as JARs. Embed the SQL editor in your own Vue 3 app.

---

## Preview

**SQL editor** ([`@datawise/sql-editor`](./sql-editor/)) — grammar-driven completion, schema-aware hints, FK JOIN snippets:

![SQL editor demo — CTE, JOIN, completion](sql-editor/docs/demo.gif)

> The full workbench adds connection tree, multi-tab consoles, AI analysis, and Electron packaging. Clone and follow **Quick start** below to run locally.

---

## Why DataWise

| | |
|---|---|
| **30+ data sources** | MySQL, PostgreSQL, Oracle, ClickHouse, Hive, Redis, Kafka, Elasticsearch, Doris, OceanBase, … — one Explorer and SQL entry point |
| **First-party SQL editor** | Publishable npm package; same completion engine powers the main app |
| **AI workbench** | Chat analysis, Text-to-SQL, streaming plans, knowledge base; push generated SQL to the console |
| **Table migration** | Cross-database schema + data wizard with batch runs and resume |
| **Plugin architecture** | Connector SPI on the server; feature plugin center on the client |
| **Three ways to use** | Web dev · all-in-one Windows desktop · [VS Code extension](./datawise-vscode/) / [headless CLI](./headless-cli/) |

---

## What you can do

- **Explore** — lazy-loaded connection tree, unified command palette (`Ctrl+K`), table grid, DDL  
- **Query** — Monaco tabs, execution plans, sessions/transactions, bookmarks & history  
- **Operate** — migrations, schema compare, cross-env sampling, CSV import/export  
- **Analyze with AI** — pick tables as context; get SQL, charts, and reports back in the workbench  
- **Collaborate** — shared connections, approvals, environment labels; capability-gated EXPLAIN / kill session  

---

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│  datawise-frontend (Vue 3 · Electron)                   │
│  Explorer · Workspace · AI · Dashboard · Plugin Center  │
└──────────────────────────┬──────────────────────────────┘
                           │ REST / SSE
┌──────────────────────────▼──────────────────────────────┐
│  datawise-server (Spring Boot)                          │
│  database · workspace · ai · connectors                 │
└──────────────────────────┬──────────────────────────────┘
                           │ JDBC / plugin SPI
┌──────────────────────────▼──────────────────────────────┐
│  config/plugins/*.jar  +  config/drivers/*.jar            │
└─────────────────────────────────────────────────────────┘

sql-editor/  ──►  standalone npm package (grammar completion)
```

Local runtime config lives in `config/` (connections, plugins, secrets — not committed).

---

## Quick start

**Requires** Node 18+, JDK 17+, Maven 3.9+

```bash
# 1. Backend API
cd datawise-backend
mvn spring-boot:run -pl datawise-server -am
# → http://localhost:18421  (GET /api/health)

# 2. SQL editor (build once after clone)
cd ../sql-editor && npm install && npm run build

# 3. Frontend
cd ../datawise-frontend
cp .env.development.example .env.development   # first time
npm install && npm run dev
# → http://localhost:28413
```

Configure `config/connections.xml` (see example) and place connector JARs under `config/plugins/`.  
Details: [docs/README.md](./docs/README.md).

**Desktop (Windows)**:

```bash
cd datawise-frontend
npm run dist:desktop    # needs JAVA_HOME + Maven; output in release/
```

---

## Repository layout

| Path | Description |
|------|-------------|
| [datawise-frontend/](./datawise-frontend/) | Vue 3 client & Electron packaging |
| [datawise-backend/](./datawise-backend/) | Spring Boot API & connectors |
| [sql-editor/](./sql-editor/) | Embeddable SQL editor (MIT) |
| [datawise-vscode/](./datawise-vscode/) | VS Code deep link to desktop |
| [headless-cli/](./headless-cli/) | CLI for migration & SQL |
| [docs/](./docs/) | Setup & plugin notes |

---

## Stack

Vue 3 · Pinia · Vite · Monaco · Electron · Spring Boot 3 · JDBC · Spring AI

---

## Contributing & license

Issues and PRs welcome. Before submitting:

```bash
node scripts/pre-commit-check.mjs
cd datawise-frontend && npm run typecheck && npm run test
cd datawise-backend && mvn test
```

- Main project: [Apache License 2.0](./LICENSE)  
- SQL editor: MIT (see [NOTICE](./NOTICE))
