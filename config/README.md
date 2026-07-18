# 本地运行时配置

此目录存放**本机数据**，默认全部忽略，**勿提交 Git**。

## 首次使用

```bash
cp config/connections.xml.example config/connections.xml
cp config/users.json.example config/users.json
```

按需将 connector JAR 放入 `plugins/`，JDBC 驱动放入 `drivers/`。说明见 [plugins/README.md](./plugins/README.md)。

## 常见文件（均不入库）

| 路径 | 说明 |
|------|------|
| `connections.xml` | 数据源连接（含加密密码）；启动后迁至 `tenants/default/connections.xml` |
| `teams.json` | 团队快照；启动后迁至 `tenants/default/teams.json` |
| `oidc.json` | OIDC / 本地登录开关；启动后迁至 `tenants/default/oidc.json` |
| `tenants/` | 租户索引、角色/成员、以及租户作用域配置（见 [TENANT_RBAC_DESIGN.md](../docs/TENANT_RBAC_DESIGN.md)） |
| `tenants/{id}/outbound-webhooks.json` | 租户出站 Webhook（首次访问时合并迁移旧用户级文件） |
| `tenants/{id}/data-quality-templates.json` | 租户共享数据质量规则模板（file；见 [DATA_QUALITY.md](../docs/DATA_QUALITY.md)） |
| `tenants/{id}/ai-usage.json` | 租户当日 AI 调用计数（`max-ai-calls-per-tenant-per-day`）；`jdbc` 时为 `dw_tenant_ai_usage` |
| `users.json` / `sessions.json` / `api-tokens.json` | 身份元数据（`storage.backend=file`）；`jdbc` 模式下可一次性导入库 |
| `tenants/{id}/oidc.json` / `outbound-webhooks.json` / `teams.json` / `connections.xml` | 租户配置（file）；`jdbc` 时对应 `dw_oidc_configs` / `dw_outbound_webhook_snapshots` / `dw_team_snapshots` / `dw_connection_snapshots` |
| `users/{id}/app.xml` | 应用偏好与 **AI 模型 / API Key**（可用 `dwsecret:` 引用，见 [SECRETS.md](../docs/SECRETS.md)） |
| `users/{id}/outbound-webhooks.json` | （已废弃）旧用户级 Webhook；迁移后重命名为 `*.migrated` |
| `sql-history.json` | SQL 执行历史（`storage.backend=file`）；`jdbc` 时为 `dw_sql_history` |
| `scripts/` | 各连接下的 SQL 脚本 |
| `cache/` | Schema 缓存 |
| `logs/datawise.log` | 统一运行日志（后端 + 桌面版 Electron；历史归档在 `logs/archive/`） |
| `ai-checkpoints/` | AI 分析断点 |
| `plugins/*.jar` / `plugins/manifest.json` / `drivers/` | 插件 JAR、版本/完整性清单、驱动 |

仓库中仅保留 `*.example` 与本 README、`plugins/README.md`。
