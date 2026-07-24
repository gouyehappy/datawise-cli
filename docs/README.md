# DataWise 文档

产品介绍 → 仓库根 [README.md](../README.md) / [README.zh-CN.md](../README.zh-CN.md)

---

## 使用说明书

面向分析师与管理员的操作手册（分章 + 真实截图）：

**[user-manual/README.md](./user-manual/README.md)**

| 资源 | 链接 |
|------|------|
| 截图清单 | [assets/screenshots/MANIFEST.md](./assets/screenshots/MANIFEST.md) |
| 重新截图 | `npm run capture:demos --prefix datawise-frontend` |

---

## 快速联调

```bash
cd datawise-backend && mvn spring-boot:run -pl datawise-server -am   # → :18421
cd datawise-frontend && npm install && npm run dev                   # → :28413
```

一键起停：`npm run dev:all` / `npm run stop:dev`（在 `datawise-frontend` 下）。

本地配置：[../config/README.md](../config/README.md)

---

## 专题文档

| 文档 | 何时打开 |
|------|----------|
| [GOVERNANCE.md](./GOVERNANCE.md) | 生产写操作治理（UI / CLI / MCP / 定时任务） |
| [SECRETS.md](./SECRETS.md) | 主密钥与 `dwsecret:` |
| [DEPLOYMENT.md](./DEPLOYMENT.md) | 团队服务器、JDBC 元数据、多实例 |
| [AI_PRODUCTION.md](./AI_PRODUCTION.md) | AI RAG / 语义校验 / Python 生产配置 |
| [OPENAPI.md](./OPENAPI.md) | API 契约导出与客户端生成 |
| [FEDERATED_JOIN_BOUNDS.md](./FEDERATED_JOIN_BOUNDS.md) | 联邦跨源 JOIN 行数与截断 |
| [CONFIG_MIGRATION.md](./CONFIG_MIGRATION.md) | 旧配置路径 → 租户作用域 |
| [design/RUNTIME_ON_DEMAND_INSTALL.md](./design/RUNTIME_ON_DEMAND_INSTALL.md) | 运行时按需安装（连接器 / 驱动 / JRE） |
| [DESKTOP_MAC.md](./DESKTOP_MAC.md) | macOS JCEF 桌面包 |
| [DESKTOP_LINUX.md](./DESKTOP_LINUX.md) | Linux JCEF 桌面包 |
| [todolist/](./todolist/README.md) | 产品级硬化待办 |

OpenAPI 导出物：[openapi/](./openapi/)

---

## 测试

```bash
cd datawise-backend && mvn test
cd datawise-frontend && npm run typecheck && npm run test
node scripts/pre-commit-check.mjs
```

GitHub Actions：`backend-tests.yml` · `frontend-tests.yml` · `query-library-ci.yml`

**勿提交：** `connections.xml`、含密钥的 `app.xml` / `.env`、`config/` 运行时数据。
