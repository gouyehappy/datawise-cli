<p align="center">
  <img src="docs/assets/logo.png" width="88" alt="DataWise logo" />
</p>

<h1 align="center">DataWise</h1>

<p align="center">
  <b>AI-native team data workbench.</b><br />
  Explore · Write SQL · Govern · Analyze — <b>everywhere your data lives.</b>
</p>

<p align="center">
  <a href="./README.md">English</a> ·
  <a href="./README.zh-CN.md">简体中文</a>
</p>

<p align="center">
  <a href="https://github.com/gouyehappy/datawise-cli/blob/main/LICENSE"><img src="https://img.shields.io/badge/license-Apache%202.0-5248e8?style=flat-square" alt="License" /></a>
  <a href="https://github.com/gouyehappy/datawise-cli"><img src="https://img.shields.io/badge/desktop-v4.0.1-6d72f8?style=flat-square" alt="Desktop version" /></a>
  <a href="#quick-start"><img src="https://img.shields.io/badge/Java-17%2B-orange?style=flat-square" alt="Java 17+" /></a>
  <a href="#quick-start"><img src="https://img.shields.io/badge/Node.js-18%2B-339933?style=flat-square" alt="Node.js 18+" /></a>
  <a href="./datawise-frontend/"><img src="https://img.shields.io/badge/Vue-3-42b883?style=flat-square" alt="Vue 3" /></a>
  <a href="./datawise-backend/"><img src="https://img.shields.io/badge/Spring%20Boot-3-6db33f?style=flat-square" alt="Spring Boot 3" /></a>
  <a href="./datawise-backend/datawise-connectors/"><img src="https://img.shields.io/badge/connectors-37-22d3ee?style=flat-square" alt="37 connectors" /></a>
  <a href="https://github.com/gouyehappy/datawise-cli/stargazers"><img src="https://img.shields.io/github/stars/gouyehappy/datawise-cli?style=flat-square" alt="GitHub stars" /></a>
</p>

<p align="center">
  <a href="https://github.com/gouyehappy/datawise-cli/actions/workflows/backend-tests.yml"><img src="https://img.shields.io/github/actions/workflow/status/gouyehappy/datawise-cli/backend-tests.yml?branch=main&label=backend&style=flat-square" alt="Backend CI" /></a>
  <a href="https://github.com/gouyehappy/datawise-cli/actions/workflows/frontend-tests.yml"><img src="https://img.shields.io/github/actions/workflow/status/gouyehappy/datawise-cli/frontend-tests.yml?branch=main&label=frontend&style=flat-square" alt="Frontend CI" /></a>
  <a href="./docs/user-manual/"><img src="https://img.shields.io/badge/docs-user%20manual-5248e8?style=flat-square" alt="User manual" /></a>
  <a href="./sql-editor/"><img src="https://img.shields.io/badge/sql--editor-MIT-green?style=flat-square" alt="SQL editor MIT" /></a>
  <a href="./datawise-mcp/"><img src="https://img.shields.io/badge/MCP-IDE%20agents-111827?style=flat-square" alt="MCP" /></a>
</p>

**DataWise** is an open-source, full-stack data workbench — not a thin SQL client. Connect databases and lakes, explore schema, write governed SQL, and turn questions into insights in one place: **Explorer**, **Monaco SQL console**, **semantic metrics**, **federated views**, **team governance**, and **streaming AI** — in the browser, as a desktop app (Windows / macOS / Linux), or from your IDE via **MCP**.

---

## At a glance

| Layer | Package | Role |
|-------|---------|------|
| Client | [`datawise-frontend`](./datawise-frontend/) | Explorer, workspace tabs, AI chat, settings, JCEF desktop host ([`datawise-desktop/`](./datawise-desktop/)) |
| API | [`datawise-backend`](./datawise-backend/) | Connections, SQL execution, AI, platform jobs, team sharing |
| Editor | [`sql-editor`](./sql-editor/) | Embeddable `@datawise/sql-editor` (grammar completion, hint bar) |
| Agents | [`datawise-mcp`](./datawise-mcp/) | MCP tools for Cursor / Claude Desktop |
| IDE | [`datawise-vscode`](./datawise-vscode/) | Open selection in the desktop SQL console |
| Automation | [`headless-cli`](./headless-cli/) | Migrate, SQL exec, Query Library CI, config migrate |
| Config | [`config/`](./config/) | Local connections, plugins, drivers, secrets *(not committed)* |

**Ports (dev):** frontend `28413` · backend `18421` · desktop backend `18423`

---

## What you can do

### Data & SQL

- Unified **Explorer** — connections, schemas, tables, views, scripts; Redis / Kafka / YARN / SSH workbenches
- **SQL console** — Monaco editor, result grid, plans, sessions & transactions, history, bookmarks, VQB
- First-party **SQL editor** — dialect-aware completion, snippets, FK JOIN helpers, formatter
- Schema compare, table migration, CSV import/export, cross-environment sampling

### AI & semantics

- Table-scoped **AI chat**, Text-to-SQL, streaming analysis, reports & canvas
- **Semantic metrics** catalog per database (including schema-driven generation)
- RAG / knowledge-base hooks for domain context

### Team & governance

- Shared connections with **read / read-write / DDL** access levels
- Query library, production **approval** flow, SQL review before risky writes
- Team audit, shared queries, environment labels (dev / staging / prod)

### Platform

- Federated virtual views, scheduled tasks, schema drift monitoring, data quality
- Plugin center for optional Explorer / AI / export capabilities
- Connector JARs hot-loaded from `config/plugins/` (**37** datasource plugins in-tree)

### Ways to run

| Mode | When to use |
|------|-------------|
| **Web** | Local backend + Vite (`npm run dev`) |
| **Desktop** | All-in-one JCEF (`npm run dist:desktop` — Win / Mac / Linux) |
| **IDE agent** | [`datawise-mcp`](./datawise-mcp/) |
| **VS Code** | [`datawise-vscode`](./datawise-vscode/) deep links into desktop |
| **CI / headless** | [`headless-cli`](./headless-cli/) |

---

## Preview

Screenshots from the Vue client (mocked API). Regenerate with:

```bash
npm run capture:demos --prefix datawise-frontend
```

Chinese user manual: [docs/user-manual/](./docs/user-manual/) · Shot list: [MANIFEST.md](./docs/assets/screenshots/MANIFEST.md)

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
│  datawise-frontend (Vue 3 · Pinia · Vite)                 │
│  + datawise-desktop (JCEF host)                           │
│  Explorer · Workspace · AI · Settings · Dashboard         │
└────────────────────────────┬─────────────────────────────┘
                             │ REST / SSE
┌────────────────────────────▼─────────────────────────────┐
│  datawise-server (Spring Boot 3 · Java 17)                │
│  database · workspace · ai · platform · connectors        │
└────────────────────────────┬─────────────────────────────┘
                             │ JDBC / connector SPI
┌────────────────────────────▼─────────────────────────────┐
│  config/plugins/*.jar  +  config/drivers/*.jar            │
└────────────────────────────┬─────────────────────────────┘
                             │
         datawise-mcp/ ──────┴──────► IDE agents (Cursor, Claude)
         sql-editor/   ─────────────► embeddable package (MIT, source in monorepo)
```

Runtime state lives under `config/` on your machine. Frontend links `@datawise/sql-editor` as **TypeScript source** via Vite alias — no separate library build step.

---

## Quick start

**Requires** Node 18+, JDK 17+, Maven 3.9+

```bash
# 1. Backend API
cd datawise-backend
mvn spring-boot:run -pl datawise-server -am
# → http://localhost:18421  (GET /api/health)

# 2. Frontend (sql-editor is pulled in via file: dependency)
cd ../datawise-frontend
cp .env.development.example .env.development   # first time only
npm install && npm run dev
# → http://localhost:28413
```

Or start both from the frontend folder: `npm run dev:all` (see [scripts/README.md](./scripts/README.md)).

**First-time config**

```bash
cp config/connections.xml.example config/connections.xml
cp config/users.json.example config/users.json
```

Put connector JARs in `config/plugins/` and JDBC drivers in `config/drivers/`. Details: [config/README.md](./config/README.md) · [docs/README.md](./docs/README.md).

**Desktop**

```bash
cd datawise-frontend
npm run dist:desktop        # host OS JCEF zip (Win / Mac / Linux)
npm run dist:desktop:mac    # alias — must run on macOS
npm run dist:desktop:linux  # alias — must run on Linux
# output → datawise-desktop/dist/{windows|macos|linux}/
#       → datawise-frontend/release/DataWiseCLI-*-{os}-{arch}.zip
# Windows Setup.exe (needs WiX 3.x):
#       → release/DataWiseCLI-*-windows-x64-setup.exe
#   winget install --id WiXToolset.WiXToolset -e
# legacy Electron: npm run dist:electron*
```
**Query Library CI** (no server for validate):

```bash
cd headless-cli && npm install && npm run build
node dist/main.js query-library validate -m ../examples/query-library/query-library.json
```

See [examples/query-library/README.md](./examples/query-library/README.md).

---

## Repository map

| Path | Role |
|------|------|
| [datawise-frontend/](./datawise-frontend/) | Vue 3 UI |
| [datawise-desktop/](./datawise-desktop/) | JCEF desktop host & packaging |
| [datawise-backend/](./datawise-backend/) | Spring Boot API (multi-module) |
| [sql-editor/](./sql-editor/) | Embeddable SQL editor (MIT) |
| [datawise-mcp/](./datawise-mcp/) | MCP server for IDE agents |
| [datawise-vscode/](./datawise-vscode/) | VS Code extension (deep links) |
| [headless-cli/](./headless-cli/) | CLI: SQL, migration, CI, config migrate |
| [config/](./config/) | Local runtime config (examples only in Git) |
| [docs/](./docs/) | Setup, connectors, plugins, deployment |
| [docs/user-manual/](./docs/user-manual/) | Chinese end-user manual |

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
