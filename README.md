# DataWise

[简体中文](./README.zh-CN.md)

**AI-driven team data workbench** — connect your data estate, ask questions in natural language, and ship governed SQL and insights together.

DataWise is not a thin database GUI. It is a workspace where AI analysis, semantic metrics, federated views, and production-safe team workflows sit on top of 30+ data sources — in the browser, as a Windows desktop app, or from your IDE via MCP.

---

## Preview

### Workbench

Screenshots from the Vue client (mocked API). Regenerate: `npm run capture:demos --prefix datawise-frontend`.

| | | |
|:---:|:---:|:---:|
| **Dashboard** | **Explorer** | **SQL console** |
| ![Dashboard](docs/assets/screenshots/01-dashboard.png) | ![Explorer](docs/assets/screenshots/02-explorer.png) | ![SQL console](docs/assets/screenshots/03-sql-console.png) |
| **AI analysis** | | |
| ![AI analysis](docs/assets/screenshots/04-ai-analysis.png) | | |

### SQL editor ([`@datawise/sql-editor`](./sql-editor/))

Grammar-driven completion, schema-aware hints, FK JOIN snippets:

![SQL editor demo — CTE, JOIN, completion](sql-editor/docs/demo.gif)

> Clone the repo and follow **Quick start** below to run the full workbench locally (browser or Windows desktop).

---

## Why DataWise

| | |
|---|---|
| **AI-native analysis** | Chat with table context, streaming plans, Text-to-SQL, analysis canvas, and reports — push generated SQL back to the console |
| **Semantic layer** | Metrics catalog per database, auto-generation from schema, Explorer AI folder for browse & manage |
| **Team governance** | Shared connections, query library, production approvals, environment labels, SQL review before execution |
| **Platform capabilities** | Federated views, schema drift monitoring, scheduled tasks, cross-env compare — built into the workbench |
| **MCP for agents** | [DataWise MCP Server](./datawise-mcp/) exposes connections, schema, review, and read-only SQL to Cursor / Claude Desktop |
| **Data connectivity** | MySQL, PostgreSQL, Oracle, ClickHouse, Hive, Redis, Kafka, Elasticsearch, Doris, OceanBase, … — one Explorer, plugin JARs |
| **Three ways to use** | Web dev · all-in-one Windows desktop · [VS Code extension](./datawise-vscode/) / [headless CLI](./headless-cli/) |

---

## What you can do

- **Analyze with AI** — pick tables as context; get SQL, charts, summaries, and reusable analysis canvas  
- **Build semantics** — define metrics, auto-generate from schema, browse under Explorer → AI  
- **Collaborate as a team** — shared queries, bookmarks, approvals, and capability-gated production access  
- **Govern execution** — SQL review, drift monitors, scheduled jobs, federated virtual views  
- **Query when needed** — Monaco console, execution plans, sessions, history, first-party SQL editor  
- **Move data safely** — migrations, schema compare, cross-env sampling, CSV import/export  

---

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│  datawise-frontend (Vue 3 · Electron)                   │
│  AI · Explorer · Workspace · Platform Hub · Dashboard │
└──────────────────────────┬──────────────────────────────┘
                           │ REST / SSE
┌──────────────────────────▼──────────────────────────────┐
│  datawise-server (Spring Boot)                          │
│  ai · platform · workspace · database · connectors      │
└──────────────────────────┬──────────────────────────────┘
                           │ JDBC / plugin SPI
┌──────────────────────────▼──────────────────────────────┐
│  config/plugins/*.jar  +  config/drivers/*.jar            │
└──────────────────────────┬──────────────────────────────┘
                           │
                    datawise-mcp/  ──►  IDE agents (Cursor, Claude)

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

**Query Library CI** (validate SQL manifests in Git without a running server):

```bash
cd headless-cli && npm install && npm run build
node dist/main.js query-library validate -m ../examples/query-library/query-library.json
```

See [examples/query-library/README.md](./examples/query-library/README.md).

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
| [datawise-backend/](./datawise-backend/) | Spring Boot API, AI & platform services |
| [datawise-mcp/](./datawise-mcp/) | MCP server for IDE agents |
| [sql-editor/](./sql-editor/) | Embeddable SQL editor (MIT) |
| [datawise-vscode/](./datawise-vscode/) | VS Code deep link to desktop |
| [headless-cli/](./headless-cli/) | CLI for migration, SQL, and Query Library CI |
| [docs/](./docs/) | Setup & plugin notes |

---

## Stack

Vue 3 · Pinia · Vite · Monaco · Electron · Spring Boot 3 · Spring AI · JDBC

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
