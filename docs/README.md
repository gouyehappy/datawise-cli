# DataWise 文档

项目介绍见根目录 [README.md](../README.md) / [README.zh-CN.md](../README.zh-CN.md)。

## 使用说明书

→ **[user-manual/README.md](./user-manual/README.md)**（分章操作 + 真实界面截图）

截图：[assets/screenshots/MANIFEST.md](./assets/screenshots/MANIFEST.md)  
重新生成：`npm run capture:demos --prefix datawise-frontend`

## 快速开始

```bash
cd datawise-backend && mvn spring-boot:run -pl datawise-server -am   # → :18421
cd sql-editor && npm install && npm run build                        # 首次
cd datawise-frontend && npm install && npm run dev                   # → :28413
```

本地配置见 [config/README.md](../config/README.md)。

## 其他说明

| 文档 | 何时需要 |
|------|----------|
| [SECRETS.md](./SECRETS.md) | 配置主密钥 / `dwsecret:` 引用密码 |
| [DEPLOYMENT.md](./DEPLOYMENT.md) | 团队服务器 / JDBC 元数据 / 多实例 |
| [AI_PRODUCTION.md](./AI_PRODUCTION.md) | AI RAG / 语义校验 / Python 生产配置 |
| [OPENAPI.md](./OPENAPI.md) | API 契约导出与客户端生成 |
| [FEDERATED_JOIN_BOUNDS.md](./FEDERATED_JOIN_BOUNDS.md) | 联邦跨源 JOIN 行数与截断行为 |
| [DESKTOP_MAC.md](./DESKTOP_MAC.md) | 打 macOS 桌面包 |
| [DESKTOP_LINUX.md](./DESKTOP_LINUX.md) | 打 Linux AppImage |
| [todolist/](./todolist/README.md) | 产品级硬化待办 |

## 测试

```bash
cd datawise-backend && mvn test
cd datawise-frontend && npm run typecheck && npm run test
node scripts/pre-commit-check.mjs
```

GitHub Actions：`.github/workflows/backend-tests.yml`、`frontend-tests.yml`、`query-library-ci.yml`。

勿提交：`connections.xml`、含密钥的 `app.xml` / `.env`、`config/` 运行时数据。
