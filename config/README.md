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
| `connections.xml` | 数据源连接（含加密密码） |
| `users/{id}/app.xml` | 应用偏好与 **AI 模型 / API Key** |
| `users/{id}/ai-knowledge.json` | AI 知识库词条 |
| `.datawise-master-key` | 配置加密主密钥 |
| `sessions.json` / `auth-session.json` | 登录会话 |
| `sql-history.json` | SQL 执行历史 |
| `scripts/` | 各连接下的 SQL 脚本 |
| `cache/` | Schema 缓存 |
| `logs/` | 运行日志 |
| `ai-checkpoints/` | AI 分析断点 |
| `plugins/*.jar` / `drivers/` | 插件与驱动 |

仓库中仅保留 `*.example` 与本 README、`plugins/README.md`。
