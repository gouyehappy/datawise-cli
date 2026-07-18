# Wave A — 企业准入对接说明

Webhook / OIDC / 审计导出实现细节。产品队列见 [WAVE_A_BACKLOG.md](./WAVE_A_BACKLOG.md)。

## 出站 Webhook

1. 管理员登录后打开 **设置 → 集成**，新建 Webhook（URL、可选 HMAC secret、事件白名单）。租户内成员可读列表；仅管理员可创建/编辑/测试。
2. 点击 **测试** 会发送 `outbound.test` 事件。
3. 验签头：`X-DataWise-Signature: sha256=<hex>`（secret 为空则不发送）；另有 `X-DataWise-Tenant`。
4. 事件类型：`scheduled_task.*`、`prod.approval.*`、`schema_drift.*`、`audit.appended`。
5. 默认载荷不含 SQL；勾选「载荷包含 SQL」后才带 `data.sql`。

配置落在 `config/tenants/{tenantId}/outbound-webhooks.json`。旧版 `config/users/{userId}/outbound-webhooks.json` 会在首次访问时合并迁移。示例见 `config/outbound-webhooks.json.example`。

## OIDC

1. 复制 `config/oidc.json.example` → 租户 `oidc.json`，或在 **设置 → 集成**（管理员）填写。
2. IdP 中配置 Redirect URI：`http://<backend>/api/auth/oidc/callback`。
3. `frontendRedirectBase` 指向前端（如 `http://localhost:28413`）；回调成功后带 `?oidcSession=...` 回跳。
4. `localLoginEnabled=false` 时禁用本地密码登录（须先启用 OIDC）。
5. **多租户（`tenancy.mode=multi`）**：用 `tenantClaim`（默认 `org_id`）+ `tenantClaimMap`（claim 值 → 产品 tenantId）定位组织；`autoProvisionMembership=true` 时自动写入 membership（角色见 `defaultOidcRoleKey`）。未映射则回调失败 `OIDC_TENANT_UNMAPPED`。

公开接口：`GET /api/auth/login-options`。

## 审计导出

- UI：团队 → 审计 → CSV/JSON（优先走服务端流式导出）。
- API：`GET /api/teams/{teamId}/audit-logs/export?format=csv|json&since=&until=&includeFullSql=`
- `includeFullSql=true` 仅团队 manager。
- 订阅 `audit.appended` Webhook 可将审计推入 SIEM（默认不勾选）。
