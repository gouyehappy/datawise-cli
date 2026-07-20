# DataWise

[简体中文](./README.zh-CN.md)

**AI-native team data workbench** — connect databases and lakes, explore schema, write governed SQL, and turn questions into insights in one place.

DataWise is a full-stack workspace (Vue 3 + Spring Boot), not a thin SQL client. It combines Explorer, Monaco SQL console, semantic metrics, federated views, team governance, and streaming AI analysis on top of 30+ connectors — in the browser, as a Windows desktop app, or from your IDE via MCP.

---

## Overview

| Layer | What it does |
|-------|----------------|
| **Client** | `datawise-frontend` — Explorer, workspace tabs, AI chat, settings, Electron desktop shell |
| **API** | `datawise-backend` — connections, SQL execution, AI, platform jobs, team sharing |
| **Editor** | `sql-editor` — embeddable `@datawise/sql-editor` with grammar completion & hint bar |
| **Agents** | `datawise-mcp` — MCP tools for Cursor / Claude Desktop (schema, read-only SQL) |
| **Automation** | `headless-cli` — migrations, SQL runs, Query Library CI |
| **Config** | `config/` — local connections, plugins, drivers, secrets (not committed) |

---

## Capabilities

### Data & SQL

- Unified **Explorer** for connections, schemas, tables, views, scripts, Redis/Kafka workbenches
- **SQL console** with Monaco, execution plans, sessions/transactions, history, bookmarks
- First-party **SQL editor** — dialect-aware completion, snippets, FK JOIN helpers, formatter
- Schema compare, table migration, CSV import/export, cross-environment sampling

### AI & semantics

- Table-scoped **AI chat**, Text-to-SQL, streaming analysis plans, reports & canvas
- **Semantic metrics** catalog per database; auto-generation from schema
- RAG / knowledge base hooks for domain context

### Team & governance

- Shared connections with **read / read-write / DDL** access levels
- Query library, production **approval** flow, SQL review before dangerous execution
- Team audit, shared queries, environment labels (dev / staging / prod)

### Platform

- Federated virtual views, scheduled tasks, schema drift monitoring
- Plugin center for optional Explorer / AI / export capabilities
- Connector JARs hot-loaded from `config/plugins/`

### How to run

| Mode | Use when |
|------|----------|
| **Web dev** | Local backend + Vite frontend |
| **Windows desktop** | All-in-one Electron bundle (`npm run dist:desktop`) |
| **IDE agent** | [datawise-mcp](./datawise-mcp/) |
| **VS Code link** | [datawise-vscode](./datawise-vscode/) opens desktop deep links |
| **CI / headless** | [headless-cli](./headless-cli/) |

---

## Preview

Screenshots from the Vue client (mocked API). Regenerate:

```bash
npm run capture:demos --prefix datawise-frontend
```

Chinese user manual (chapters + captions): [docs/user-manual/](./docs/user-manual/). Shot list: [MANIFEST.md](./docs/assets/screenshots/MANIFEST.md).

| Dashboard | Explorer | SQL console |
|:---:|:---:|:---:|
| ![Dashboard](docs/assets/screenshots/01-dashboard.png) | ![Explorer](docs/assets/screenshots/02-explorer.png) | ![SQL console](docs/assets/screenshots/03-sql-console.png) |

| AI analysis | Settings | Analysis canvas |
|:---:|:---:|:---:|
| ![AI analysis](docs/assets/screenshots/04-ai-analysis.png) | ![Settings](docs/assets/screenshots/06-settings-basic.png) | ![Canvas](docs/assets/screenshots/10-platform-canvas.png) |

**SQL editor** ([`@datawise/sql-editor`](./sql-editor/)) — grammar completion, schema hints, JOIN snippets:

![SQL editor demo](sql-editor/docs/demo.gif)

---

## Architecture

```
┌──────────────────────────────────────────────────────────┐
│  datawise-frontend (Vue 3 · Pinia · Vite · Electron)      │
│  Explorer · Workspace · AI · Settings · Dashboard         │
└────────────────────────────┬─────────────────────────────┘
                             │ REST / SSE
┌────────────────────────────▼─────────────────────────────┐
│  datawise-server (Spring Boot 3)                          │
│  database · workspace · ai · platform · connectors        │
└────────────────────────────┬─────────────────────────────┘
                             │ JDBC / connector SPI
┌────────────────────────────▼─────────────────────────────┐
│  config/plugins/*.jar  +  config/drivers/*.jar            │
└────────────────────────────┬─────────────────────────────┘
                             │
         datawise-mcp/ ──────┴──────► IDE agents (Cursor, Claude)
         sql-editor/   ─────────────► npm package (MIT)
```

Monorepo: frontend, backend, and editor are developed together. Runtime state lives under `config/` on your machine.

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
cp .env.development.example .env.development   # first time only
npm install && npm run dev
# → http://localhost:28413
```

**First-time config**

```bash
cp config/connections.xml.example config/connections.xml
cp config/users.json.example config/users.json
```

Place connector JARs in `config/plugins/` and JDBC drivers in `config/drivers/`. Details: [config/README.md](./config/README.md) and [docs/README.md](./docs/README.md).

**Windows desktop**

```bash
cd datawise-frontend
npm run dist:desktop    # requires JAVA_HOME + Maven; output in release/
```

**Query Library CI** (validate SQL manifests without a running server):

```bash
cd headless-cli && npm install && npm run build
node dist/main.js query-library validate -m ../examples/query-library/query-library.json
```

See [examples/query-library/README.md](./examples/query-library/README.md).

---

## Repository map

| Path | Role |
|------|------|
| [datawise-frontend/](./datawise-frontend/) | Vue 3 UI & Electron packaging |
| [datawise-backend/](./datawise-backend/) | Spring Boot API (multi-module) |
| [sql-editor/](./sql-editor/) | Embeddable SQL editor package (MIT) |
| [datawise-mcp/](./datawise-mcp/) | MCP server for IDE agents |
| [datawise-vscode/](./datawise-vscode/) | VS Code extension (deep links) |
| [headless-cli/](./headless-cli/) | CLI for SQL, migration, CI |
| [config/](./config/) | Local runtime config (examples only in Git) |
| [docs/](./docs/) | Setup, connectors, plugins |

Backend entry: `datawise-server`. Connectors: `datawise-backend/datawise-connectors/`.

---

## Development

```bash
# Pre-commit sanity check
node scripts/pre-commit-check.mjs

# Frontend
cd datawise-frontend && npm run typecheck && npm run test

# Backend
cd datawise-backend && mvn test

# SQL editor
cd sql-editor && npm run typecheck && npm test
```

Do **not** commit secrets: `config/connections.xml`, `config/users/*/app.xml`, `.env` with keys, or runtime JSON/XML under `config/`.

---

## License

- Main repository: [Apache License 2.0](./LICENSE)
- SQL editor (`sql-editor/`): MIT — see [NOTICE](./NOTICE)

Issues and pull requests are welcome.
