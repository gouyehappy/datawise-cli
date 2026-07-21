# DataWise 团队服务器部署手册

面向多用户 / SaaS / 私有化服务器部署。桌面 Electron 打包见 [DESKTOP_MAC.md](./DESKTOP_MAC.md) / [DESKTOP_LINUX.md](./DESKTOP_LINUX.md)。

## 推荐配置对照

| 项 | 桌面 / 本地 `dev` | 团队服务器（推荐） |
|----|-------------------|-------------------|
| `spring.profiles.active` | `dev` / `desktop` | 显式自定义 profile（勿依赖默认 `dev`） |
| `datawise.storage.backend` | `file` | `jdbc` |
| `datawise.security.connection-probe.allow-private-networks` | `true` | 按网络边界：公网 SaaS 用 `false`；专有内网可 `true` |
| `datawise.connectors.require-manifest-integrity` | `false`（便于插件开发） | `true` |
| `datawise.query.max-result-rows` | `10000` | `10000` 或更严 |
| `datawise.security.auth.require-authentication` | `true` | `true` |
| `datawise.task-concurrency.store-type` | `in-memory` | `jdbc`（需 metadata DataSource） |
| `datawise.ai.analysis.semantic-check` | `lenient` | `strict` |
| `datawise.ai.python.executor` | `simulated` | `docker`（见 [AI_PRODUCTION.md](./AI_PRODUCTION.md)） |
| `datawise.ai.rag.vector-store` | `none` | `pgvector` |

密钥外置见 [SECRETS.md](./SECRETS.md)。

## JDBC 元数据存储

```yaml
datawise:
  storage:
    backend: jdbc
    datasource:
      jdbc-url: jdbc:postgresql://db:5432/datawise_meta
      username: datawise
      password: ${DW_META_PASSWORD}
      driver-class-name: org.postgresql.Driver
```

启用后，用户 / 会话 / 租户 / API Token 等身份元数据进入库表（Flyway 迁移）。连接配置快照等也可走 JDBC 路径——详见 `config/README.md`。

### 备份边界

- **jdbc**：备份元数据库 + `config/` 下仍落盘的密钥、日志、插件、AI checkpoint
- **file**：整份 `config/` 目录（含 `tenants/`、`users/`）

## 鉴权与公开路径

默认 `require-authentication: true`。公开路径（边界匹配，可覆盖）：

- `/login`、`/login/guest`、`/signOut`
- `/api/auth/register`、`/api/auth/login-options`
- `/api/auth/oidc/login`、`/api/auth/oidc/callback`
- `/api/health`、`/actuator/health`、`/actuator/prometheus`
- `/v3/api-docs`、`/swagger-ui`

**不会**整段放行 `/api/auth/`（会话、改密、OIDC 管理配置仍需登录；服务层另有管理员校验）。

其余 `/api/**` 需有效 `X-DW-Session-Id` 或 `X-DW-Api-Token` / Bearer。

## 观测

- Prometheus：`GET /actuator/prometheus`（需纳入 scrape）
- 关联 ID：请求头 / 响应头 `X-Request-Id`，写入日志 MDC `requestId`
- 健康检查：`GET /api/health`、`GET /actuator/health`

## 多实例与 SSE

- 任务并发：`datawise.task-concurrency.store-type=jdbc`
- Migration / AI SSE 订阅为**进程内**内存 hub——负载均衡需 **sticky session**（或后续接共享 pub/sub）
- 重启后进行中 SSE 订阅会丢失；客户端应支持重连并拉取 job 快照

## 最小容器示例（附录）

```dockerfile
FROM eclipse-temurin:17-jre
WORKDIR /app
COPY datawise-server.jar app.jar
COPY config /app/config
ENV SPRING_PROFILES_ACTIVE=server
EXPOSE 18421
ENTRYPOINT ["java","-jar","/app/app.jar","--spring.config.additional-location=optional:file:./config/"]
```

配套 `docker-compose` 建议至少包含：应用、PostgreSQL（元数据 + 可选 pgvector）、密钥环境变量。生产务必关闭默认 `dev` profile 的宽松安全覆盖。

## 相关文档

- [AI_PRODUCTION.md](./AI_PRODUCTION.md) — RAG / 语义校验 / Python
- [OPENAPI.md](./OPENAPI.md) — API 契约导出
- [SECRETS.md](./SECRETS.md) — 主密钥与 `dwsecret:`
- [todolist/](./todolist/README.md) — 产品级硬化清单
