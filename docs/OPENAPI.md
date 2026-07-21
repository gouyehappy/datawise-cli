# OpenAPI 契约

DataWise HTTP API 通过 springdoc 暴露 OpenAPI 3 文档。

## 在线

后端启动后：

| URL | 说明 |
|-----|------|
| `/v3/api-docs` | OpenAPI JSON |
| `/swagger-ui.html` | Swagger UI |

鉴权头：`X-DW-Session-Id` 或 `X-DW-Api-Token`（亦支持 `Authorization: Bearer`）。

上述路径默认在 `datawise.security.auth.public-path-prefixes` 中，可匿名拉取契约；实际业务 API 仍需登录。

## 导出契约文件

```bash
# 后端需已启动（默认 :18421）
curl -sS http://127.0.0.1:18421/v3/api-docs -o docs/openapi/openapi.json
```

或使用脚本（仓库根目录）：

```bash
node scripts/export-openapi.mjs
```

## 类型化客户端（渐进）

1. 将 `docs/openapi/openapi.json` 纳入版本控制或 CI artifact
2. 前端可用 `openapi-typescript` 生成类型：

```bash
npx openapi-typescript docs/openapi/openapi.json -o datawise-frontend/src/shared/api/generated/openapi.d.ts
```

当前手写客户端位于 `datawise-frontend/src/shared/api/http/`；建议按模块逐步替换，避免一次性大爆炸。

## 版本策略

- 现阶段路径仍为扁平 `/api/*`（无 `/api/v1` 前缀）
- 破坏性变更须同步：frontend、MCP、headless-cli，并在 CHANGELOG 标明
- 后续引入 `/api/v1` 时保留旧路径一段兼容期
