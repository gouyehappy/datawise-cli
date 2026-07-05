# DataWise 文档

项目介绍与亮点见根目录 [README.md](../README.md)（英文）；[中文版](../README.zh-CN.md)。

数据库工作台：**Vue 3 客户端** + **Spring Boot API** + **SQL 编辑器**（`sql-editor/`）。

## 仓库结构

```
datawise-cli/
├── config/              # 本地运行时配置（勿提交密钥）
├── datawise-frontend/   # Vue 3 + Electron
├── datawise-backend/    # Spring Boot 多模块
├── sql-editor/          # @datawise/sql-editor
├── datawise-vscode/     # VS Code 扩展
└── headless-cli/        # 无头 CLI
```

后端主要模块：`datawise-server`（入口）、`datawise-database`、`datawise-connectors`、`datawise-workspace`、`datawise-ai`。

## 快速开始

```bash
# 后端
cd datawise-backend && mvn spring-boot:run -pl datawise-server -am
# → http://localhost:18421

# SQL 编辑器（首次）
cd sql-editor && npm install && npm run build

# 前端
cd datawise-frontend
cp .env.development.example .env.development   # 首次
npm install && npm run dev
# → http://localhost:28413
```

`VITE_API_BASE_URL` 留空时，Vite 将 `/api` 代理到后端（端口见 `datawise-frontend/runtime-ports.json`）。

## 本地配置（`config/`）

完整说明见 [config/README.md](../config/README.md)。**仅 `*.example` 可入库**；下列均为本机运行时数据：

| 路径 | 说明 |
|------|------|
| `connections.xml` | 数据库连接（勿提交） |
| `users/{id}/app.xml` | 应用与 **AI / API Key** 配置 |
| `plugins/`、`drivers/` | Connector 与 JDBC 驱动 JAR |
| `.datawise-master-key` | 加密主密钥（勿提交） |

示例：`connections.xml.example`、`users.json.example`。插件说明见 `config/plugins/README.md`。

## 连接器插件 {#connectors}

构建并安装到 `config/plugins/` 后重启后端：

```bash
cd datawise-backend
mvn package -pl datawise-connectors/datawise-connector-mysql -am
```

JDBC 类数据源还需将驱动 JAR 放入 `config/drivers/`。实现位于 `datawise-backend/datawise-connectors/`（`spi` 契约 + 各 `datawise-connector-*` 插件）。

前端 API 路径定义：`datawise-frontend/src/shared/api/http/paths.ts`，须与 `datawise-server` Controller 保持一致。

## 功能插件 {#plugins}

可选 UI / SQL / AI 能力由前端插件注册表（`plugin-registry.service.ts`）与后端 `plugins.json` 控制。Explorer 类插件（`p-*-explorer`）决定哪些 DbType 出现在连接树中。

## 测试与提交前检查

```bash
cd datawise-backend && mvn test
cd datawise-frontend && npm run typecheck && npm run test
npm run test --prefix sql-editor
node scripts/pre-commit-check.mjs
```

勿提交：`connections.xml`、`users/*/app.xml`（含 AI 密钥）、`config/` 下运行时 JSON/XML、非 example 的 `.env`。

## 子项目 README

| 目录 | 说明 |
|------|------|
| [datawise-frontend/README.md](../datawise-frontend/README.md) | 前端与 Electron 打包 |
| [datawise-backend/README.md](../datawise-backend/README.md) | 后端模块 |
| [sql-editor/README.md](../sql-editor/README.md) | SQL 编辑器包 |

许可证：[LICENSE](../LICENSE)（Apache 2.0）；`sql-editor` 为 MIT，见 [NOTICE](../NOTICE)。
