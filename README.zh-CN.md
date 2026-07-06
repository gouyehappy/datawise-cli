# DataWise

[English](./README.md)

**AI 驱动的团队数据工作台** — 连接团队数据资产，用自然语言提问，在统一界面里协作产出可治理的 SQL 与洞察。

DataWise 不是又一款数据库图形客户端。它以 AI 分析、语义层、联邦视图和生产级团队流程为核心，底层对接 30+ 数据源 — 可在浏览器、Windows 桌面使用，也可通过 MCP 接入 Cursor / Claude 等 IDE。

---

## 预览

### 工作台

由 Vue 客户端自动截图（Mock API）。重新生成：`npm run capture:demos --prefix datawise-frontend`。

| | | |
|:---:|:---:|:---:|
| **仪表盘** | **Explorer** | **SQL 控制台** |
| ![Dashboard](docs/assets/screenshots/01-dashboard.png) | ![Explorer](docs/assets/screenshots/02-explorer.png) | ![SQL console](docs/assets/screenshots/03-sql-console.png) |
| **AI 分析** | | |
| ![AI analysis](docs/assets/screenshots/04-ai-analysis.png) | | |

### SQL 编辑器（[`@datawise/sql-editor`](./sql-editor/)）

语法驱动补全、Schema 感知、外键 JOIN 一行生成：

![SQL editor demo — CTE, JOIN, completion](sql-editor/docs/demo.gif)

> 克隆仓库后按下方「快速开始」在浏览器或 Windows 桌面版本地运行完整工作台。

---

## 亮点

| | |
|---|---|
| **AI 原生分析** | 选表上下文对话、流式执行计划、Text-to-SQL、分析画布与报告；生成 SQL 可回流控制台 |
| **语义层** | 按库维护指标目录、从 Schema 自动生成、Explorer → AI 文件夹浏览与管理 |
| **团队治理** | 共享连接、Query Library、生产审批、环境标签、执行前 SQL 审查 |
| **平台能力** | 联邦视图、Schema 漂移监控、定时任务、跨环境对比 — 内建在工作台 |
| **MCP 接入智能体** | [DataWise MCP Server](./datawise-mcp/) 向 Cursor / Claude Desktop 暴露连接、Schema、审查与只读 SQL |
| **数据连接底座** | MySQL、PostgreSQL、Oracle、ClickHouse、Hive、Redis、Kafka、Elasticsearch、Doris、OceanBase … 统一 Explorer，插件 JAR 热插拔 |
| **三种使用方式** | Web 联调 · Windows 桌面一体化包 · [VS Code 扩展](./datawise-vscode/) / [Headless CLI](./headless-cli/) |

---

## 你能做什么

- **用 AI 分析** — 选库表上下文提问，获得 SQL、图表、摘要与可复用的分析画布  
- **建设语义层** — 定义指标、从 Schema 自动生成、在 Explorer → AI 下浏览管理  
- **团队协作** — 共享查询、书签、审批流，按环境能力控制生产访问  
- **治理与编排** — SQL 审查、漂移监控、定时任务、跨源联邦虚拟视图  
- **按需写 SQL** — Monaco 控制台、执行计划、会话/事务、历史、自研 SQL 编辑器  
- **安全迁移数据** — 表迁移、Schema 对比、跨环境抽样、CSV 导入导出  

---

## 架构

```
┌─────────────────────────────────────────────────────────┐
│  datawise-frontend (Vue 3 · Electron)                   │
│  AI · Explorer · Workspace · Platform Hub · Dashboard   │
└──────────────────────────┬──────────────────────────────┘
                           │ REST / SSE
┌──────────────────────────▼──────────────────────────────┐
│  datawise-server (Spring Boot)                          │
│  ai · platform · workspace · database · connectors      │
└──────────────────────────┬──────────────────────────────┘
                           │ JDBC / 插件 SPI
┌──────────────────────────▼──────────────────────────────┐
│  config/plugins/*.jar  +  config/drivers/*.jar            │
└──────────────────────────┬──────────────────────────────┘
                           │
                    datawise-mcp/  ──►  IDE 智能体（Cursor、Claude）

sql-editor/  ──►  独立 npm 包，grammar 补全引擎
```

Monorepo，前后端与编辑器同源维护；本地配置集中在 `config/`（连接、插件、密钥不入库）。

---

## 快速开始

**环境**：Node 18+、JDK 17+、Maven 3.9+

```bash
# 1. 后端 API
cd datawise-backend
mvn spring-boot:run -pl datawise-server -am
# → http://localhost:18421  (GET /api/health)

# 2. SQL 编辑器（首次克隆需要 build 一次）
cd ../sql-editor && npm install && npm run build

# 3. 前端
cd ../datawise-frontend
cp .env.development.example .env.development   # 首次
npm install && npm run dev
# → http://localhost:28413
```

首次使用请在 `config/` 配置连接（参考 `config/connections.xml.example`）并将所需 connector JAR 放入 `config/plugins/`。  
更多说明见 [docs/README.md](./docs/README.md)。

**桌面版（Windows）**：

```bash
cd datawise-frontend
npm run dist:desktop    # 需要 JAVA_HOME + Maven，产物在 release/
```

---

## 仓库结构

| 目录 | 说明 |
|------|------|
| [datawise-frontend/](./datawise-frontend/) | Vue 3 客户端与 Electron 打包 |
| [datawise-backend/](./datawise-backend/) | Spring Boot API、AI 与平台服务 |
| [datawise-mcp/](./datawise-mcp/) | 面向 IDE 智能体的 MCP 服务 |
| [sql-editor/](./sql-editor/) | 可嵌入 SQL 编辑器（MIT） |
| [datawise-vscode/](./datawise-vscode/) | VS Code → 桌面端 Deep Link |
| [headless-cli/](./headless-cli/) | 命令行调用迁移与 SQL 执行 |
| [docs/](./docs/) | 联调、配置与插件说明 |

---

## 技术栈

Vue 3 · Pinia · Vite · Monaco · Electron · Spring Boot 3 · Spring AI · JDBC

---

## 参与与许可

欢迎 Issue 与 PR。提交前可运行：

```bash
node scripts/pre-commit-check.mjs
cd datawise-frontend && npm run typecheck && npm run test
cd datawise-backend && mvn test
```

- 主项目：[Apache License 2.0](./LICENSE)  
- SQL 编辑器：MIT（见 [NOTICE](./NOTICE)）
