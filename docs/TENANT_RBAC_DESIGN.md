# Tenant + RBAC 数据模型与 Dual-Mode 迁移清单

> 状态：Phase 0–2 完成；Phase 3 元数据 `file|jdbc` 已覆盖身份 / teams / connections / OIDC / webhooks / AI usage / SQL history；个人工作区文件按 `users/{id}/tenants/{tenantId}/` 隔离（`app.xml` 仍用户全局）；对象存储未开始  
> 产品取向：**偏 SaaS 多租户**，同时支持 **本地 / 私有化单体**（`tenancy.mode=single`）。  
> 相关：缺口 G12（[PRODUCT_GAP_ANALYSIS.md](./PRODUCT_GAP_ANALYSIS.md)，状态 `done`）、Wave A 企业准入（[WAVE_A_BACKLOG.md](./WAVE_A_BACKLOG.md)）。

### 评审锁定（2026-07-17）

相对初稿的必要调整已确认，不再阻塞启动：

| # | 调整 | 决定 |
|---|------|------|
| R1 | default 租户 ID | **`id = slug = "default"`**（不用 UUID），路径简单、迁移稳 |
| R2 | Username 唯一性 | Phase 0/1（`single`）保持全局唯一；`multi` 的 email 策略放到 Phase 2 再定 |
| R3 | Outbound Webhook | Phase 1 **租户级**（`tenants/{id}/outbound-webhooks.json`；管理员 CRUD） |
| R4 | 平台超管 | Phase 0：**无独立平台超管**；`tenant_admin`（default）兼容今日 bootstrap admin；**Phase 2**：`platform-admin-user-ids` 白名单 |
| R5 | Phase 0 管理 UI | **角色为主**：账号页默认绑角色（矩阵只读预览）；**自定义权限与角色互斥**（写 map 卸角色，写角色清 map） |
| R6 | 权限裁决顺序 | guest →（自定义 map / workbench）；tenant_admin → full；**membership 角色并集（忽略用户 map）**；无角色自定义 map → 自定义；否则 → **readonly** |
| R7 | 旧 Session | 无 `tenantId` 时回退 `"default"` |

---

## 1. 目标与非目标

### 目标

| # | 目标 | 说明 |
|---|------|------|
| T1 | **一套代码，两种部署** | Local 默认隐式单租户；SaaS 打开真多租户 |
| T2 | **角色控权限** | 租户级 Role → `UserFeaturePermission` 键；不再长期依赖用户直挂 feature map |
| T3 | **保留 Team 协作 RBAC** | `owner/admin/member/viewer` 继续管共享连接、审批、审计 |
| T4 | **可迁移** | 现有 `config/` 用户 / 连接 / 团队可无感迁入 `default` 租户 |
| T5 | **前端契约稳定** | Session 仍返回 `featurePermissions: Map<string,boolean>`；聚合逻辑在后端 |

### 非目标（本设计不覆盖）

- 完整计费 / 发票（Phase 2+ 配额可先落地硬性上限）
- 行级数据权限（库表行过滤）——仍靠连接可见性 + Team 共享
- 立刻弃用文件存储 —— MVP 继续 JSON/XML；规模后再加 `StorageBackend=db`
- 把 Team 当作 Tenant（禁止）

---

## 2. 现状基线（仓库事实 · 升级后）

| 层 | 现状 | 关键代码 |
|----|------|----------|
| 会话上下文 | `userId` / `guest` / `sessionId` / API token scopes / **`tenantId`** | `UserContext` |
| 平台权限 | **角色优先**（membership 并集忽略用户 map）；无角色有 map → 自定义；否则 readonly；`tenant_admin` → full | `UserPermissionPolicy`、`UserAdminPolicy` |
| 功能键 | ~50 个 `UserFeaturePermission.*`，与前端对齐 | `UserFeaturePermission` |
| 团队角色 | `owner/admin/member/viewer`（Team 协作层，叠加在租户之上） | `TeamRoleSupport` |
| 连接隔离 | `tenantId` 路径 + `userId` 所有者 + Team 共享 | `ConnectionVisibilityService` |
| 配置根 | `tenants/{id}/…` + `users/{userId}/tenants/{tenantId}/…`（`app.xml` 用户全局） | `ConfigPaths` |
| 迁移并发 | `TenantConcurrencyKeys` / 产品 `tenantId` 槽位 | `datawise-taskconcurrency` |

---

## 3. 目标领域模型

```text
Platform (实例)
  ├── Tenant（组织）
  │     ├── TenantRole（内置 + 自定义）
  │     │     └── permissions: Set<featureKey> 或 Map 同 UserFeaturePermission
  │     ├── UserTenantMembership（userId, tenantId, roleIds[], status）
  │     ├── Team（现有协作单元，增加 tenantId）
  │     │     └── TeamMember（owner/admin/member/viewer）
  │     ├── Connection / Group（增加 tenantId；userId 仍为所有者）
  │     └── 租户级配置：OIDC、出站 Webhook 策略、配额…
  └── User（全局身份；可属多个 Tenant）
```

### 3.1 实体草案

#### `TenantEntity`

| 字段 | 类型 | 说明 |
|------|------|------|
| `id` | String | 稳定 ID；**default 租户固定为 `"default"`**（与 slug 相同） |
| `slug` | String | URL / 切换用短名；与 id 可相同 |
| `name` | String | 显示名 |
| `status` | `active` / `suspended` / `deleted` | SaaS 生命周期 |
| `createdAt` / `updatedAt` | Instant | |
| `settings` | Map / JSON | 可选：默认角色、是否允许本地登录等 |

固定约定：

- **`slug = "default"`**：`mode=single` 唯一租户；升级现有部署时迁移目标。
- SaaS 新建租户禁止占用 `default`（或仅平台内部保留）。

#### `TenantRoleEntity`

| 字段 | 类型 | 说明 |
|------|------|------|
| `id` | String | |
| `tenantId` | String | 作用域；内置模板可 `tenantId=null` 再 clone 到租户 |
| `key` | String | `tenant_admin` / `developer` / `analyst` / `readonly` / custom |
| `name` | String | |
| `permissions` | `Map<String,Boolean>` | 键必须 ⊆ `UserFeaturePermission.ALL` |
| `system` | boolean | 系统角色不可删 |

**内置角色预设（建议）：**

| key | 语义 | 权限起点 |
|-----|------|----------|
| `tenant_admin` | 租户管理员 | `fullPreset()` + 管理用户/角色/集成 |
| `developer` | 数据开发 | 工作台全量 + 迁移/导出；无 `settings.userPermissions` |
| `analyst` | 分析 | 工作台 + AI/仪表盘；弱化危险 SQL / DDL 相关键 |
| `readonly` | 只读 | 接近 `workbenchPreset()` + 查询只读相关 |

具体键清单实现时可再微调，但必须与现有 `UserFeaturePermission` 对齐。

#### `UserTenantMembership`

| 字段 | 类型 | 说明 |
|------|------|------|
| `userId` | Long | |
| `tenantId` | String | |
| `roleIds` | List\<String\> | 可多角色；有效权限 = 并集 |
| `status` | `active` / `invited` / `disabled` | |
| `joinedAt` | Instant | |

唯一约束：`(userId, tenantId)`。

#### `UserEntity` 调整

| 变更 | 说明 |
|------|------|
| 保留 `featurePermissions` | **例外专用**自定义覆盖；有角色绑定时忽略；与角色互斥写入 |
| 可选 `primaryTenantId` | 登录默认租户 |
| 用户名唯一性 | `mode=single`：全局唯一（现状）；`mode=multi`：建议 email 全局唯一，username 可 `(tenantId, username)` 或仅用 email 登录 |

#### 需加 `tenantId` 的现有资源

| 资源 | 现状路径 / 归属 | 迁移后 |
|------|-----------------|--------|
| `TeamEntity` 及成员/审批/审计 | `teams.json` | 每条带 `tenantId`；文件可迁到租户目录 |
| `ConnectionEntity` / Group | `connections.xml` | 带 `tenantId`；可见性先滤租户再滤 owner/team |
| `Oidc` 配置 | 实例级 `oidc.json` | **租户级**（SaaS 必需；single 仍一份） |
| Outbound Webhooks | 现 `users/{id}/outbound-webhooks.json` | 建议升为 **租户级** 或「用户个人 + 租户共享」两档 |
| Sessions | `sessions.json` | Session 记录 `tenantId`（当前活跃组织） |
| API Tokens | `api-tokens.json` | 绑定 `tenantId` + scopes |
| 用户私有数据 | `users/{userId}/...` | 多数可保持 user 级；跨租户共享类（语义指标等）需评估是否租户级 |

---

## 4. 两层 RBAC（不要合并）

```text
请求
  → UserContext(userId, tenantId, …)
  → 租户角色聚合 → featurePermissions（模块/设置/危险操作）
  → 若涉及 Team 资源 → TeamRoleSupport（协作/审批/共享连接读写）
  → 若涉及连接 → ConnectionVisibility（owner + team share，且 connection.tenantId == ctx.tenantId）
```

| 层 | 管什么 | 不管什么 |
|----|--------|----------|
| **Tenant Role** | 能否进 AI / 团队页 / 用户权限设置 / 集成 / 危险 SQL 开关等 | 某个 Team 里是不是 viewer |
| **Team Role** | 能否管理成员、审批生产变更、共享连接读写 | 能否看到「设置 → 用户权限」页 |

裁决顺序建议：

1. 无 membership → 403 / 强制选租户  
2. `tenant_admin` 或平台超管 → 租户内功能全开（仍受 Team 规则约束协作动作）  
3. 有 membership 角色 → `OR(roles.permissions)`（**忽略**用户 feature map）  
4. 无角色但有非空 feature map → 自定义覆盖  
5. 否则 → `readonly` 预设 
4. Team / Connection 逻辑保持现有语义，仅增加 `tenantId` 过滤

### 平台超管 vs 租户管理员

| 角色 | `mode=single` | `mode=multi` |
|------|---------------|--------------|
| **平台超管** | 可与 `default` 的 `tenant_admin` 合并（兼容今日 bootstrap admin） | 跨租户：开户、冻结、查审计；独立开关 |
| **租户管理员** | = 今日「用户权限设置」能力 | 仅本 `tenantId` |

兼容策略：`UserAdminPolicy.isAdminUser` 在 Phase 0 改为「当前租户是否具备 `tenant_admin` 角色」；`mode=multi` 另增 `PlatformAdminPolicy`（配置白名单 userId 或独立 flag）。

---

## 5. Dual-Mode 开关

```yaml
# application.yml / application-desktop.yml 等
datawise:
  tenancy:
    mode: single          # single | multi
    default-tenant-id: default
    allow-tenant-create: false   # multi 时可由平台超管打开（自助开户）
    allow-registration: false    # 公开本地注册；需同时开启 localLogin
    platform-admin-user-ids: []  # multi 跨租户运营白名单；空则回退首个注册用户
    max-connections-per-tenant: 0
    max-ai-calls-per-tenant-per-day: 0  # 0 = 不限制；计数存 tenants/{id}/ai-usage.json 或 dw_tenant_ai_usage
  storage:
    backend: file                # file | jdbc（身份 / teams / connections / OIDC / webhooks / AI usage / SQL history）
    datasource:
      jdbc-url: jdbc:postgresql://localhost:5432/datawise
      username: datawise
      password: '***'
```

| 行为 | `single` | `multi` |
|------|----------|---------|
| 启动 | 确保存在 `default` 租户；禁止创建其它租户 | 可创建多个 Tenant |
| UI | **隐藏**组织切换 / 开户 | 登录后选 org / SSO 映射 |
| OIDC | 绑定 `default` | claim → `tenantId` + 可选角色 |
| 用户名 | 全局唯一 | email 全局 + membership |
| 配额 API | 可 noop 或整实例配额 | 按 `tenantId` |
| 任务并发 | 逐步把 `TenantSlotPolicy` 的 key 从 userId 迁到真正 tenantId（注意：迁移任务仍可再按 user 分子配额） |

桌面包 / 私有化默认：`single`。  
托管 SaaS 部署：`multi`。

---

## 6. 存储布局（文件态 MVP）

### 目标目录（建议）

```text
config/
  platform.json                 # 实例级：tenancy.mode 缓存、平台超管列表（可选）
  tenants/
    index.json                  # [{ id, slug, name, status }]
    default/
      tenant.json
      roles.json                # 内置 + 自定义角色
      memberships.json          # 或并入 users 索引
      connections.xml
      teams.json
      oidc.json
      outbound-webhooks.json    # 租户级集成（从用户级上收）
  users.json                    # 全局用户身份（密码哈希等）；不含租户业务数据
  users/{userId}/
    app.xml                     # 用户全局偏好（主题/布局/LLM），不随租户切换
    tenants/{tenantId}/         # 个人工作区按租户隔离（语义指标、AI 知识、计划任务等）
  cache/schema/u{userId}/t{tenantId}/{connectionId}.json
  sessions.json                 # session → { userId, tenantId, … }
```

Legacy `users/{userId}/*.json`（无 `tenants/`）仅在读 **default** 租户时迁入 `users/{userId}/tenants/default/`。

`mode=single` 时对外路径可继续兼容「根目录 `connections.xml`」，内部用 **symlink 语义或读写代理** 指到 `tenants/default/`，降低一次搬家风险。

### `ConfigPaths` 扩展方向

```text
TENANTS_DIR = "tenants"
tenantRoot(tenantId) -> tenants/{id}/
tenantConnections(tenantId)
tenantTeams(tenantId)
tenantOidc(tenantId)
tenantRoles(tenantId)
```

所有 Store 读写必须带 `tenantId`（从 `UserContext.requireTenantId()` 取得）；禁止「扫全盘再内存过滤」作为唯一防线（可作过渡，但 Phase 1 验收要路径隔离）。

---

## 7. 会话与 API 契约

### `UserContext` 扩展

```text
ThreadLocal: userId, guest, sessionId, apiTokenScopes, tenantId
Snapshot: + tenantId
set(userId, guest, sessionId, tenantId)
requireTenantId()
```

定时任务 / AI 图节点已有 `UserContext.runAs(Snapshot)` —— Snapshot 必须带上 `tenantId`，避免 worker 线程丢租户。

### Session / 登录

| API / 行为 | 变更 |
|------------|------|
| `SessionInfo` | 增加 `tenantId`、`tenantName`、`tenants[]`（可切换列表）；保留 `featurePermissions` |
| 本地登录 | `single`：直接进 default；`multi`：若多 membership → 返回需选租户或用 `primaryTenantId` |
| OIDC callback | 用 issuer/org claim 解析 `tenantId`；无映射则拒绝或进邀请流 |
| 切换租户 | `POST /api/auth/switch-tenant`（仅 multi）；换发 session 或更新 session 记录 |

前端：`featurePermissions` 消费方式不变；仅在 `multi` 增加组织切换入口。

---

## 8. 分阶段迁移清单

### Phase 0 — 模型 + RBAC（本地几乎无感）✅

- [x] 新增 domain/model：`TenantEntity`、`TenantRoleEntity`、`UserTenantMembership`
- [x] `TenantStore` + 启动 bootstrap：`default` 租户 + 内置角色
- [x] 现有用户 → `membership(default, role=…)`：原 bootstrap admin → `tenant_admin`；其余 → `developer`
- [x] `UserContext` / Session 增加 `tenantId`（恒 default）
- [x] `UserPermissionPolicy`：角色并集优先；无角色默认 `readonly`；自定义 map 与角色互斥
- [x] `UserAdminService`：赋角色 / 自定义权限互斥写入；可赋 `tenant_admin`；`settings.tenants` 独立键；系统角色预设随 bootstrap 刷新
- [x] 配置项 `datawise.tenancy.mode=single`（默认）
- [x] 单测：权限聚合、bootstrap 迁移、admin 兼容、角色赋权
- [x] **不改**前端导航键；**不强制**搬家 connections/teams 文件

**验收：** 现有本地部署升级后行为与今日一致；设置里可用「角色」赋权。

### Phase 1 — 存储隔离硬化 ✅

- [x] `Connection` / `ConnectionGroup` / `Team` 增加 `tenantId`；XML/JSON 读写；bootstrap 给缺省值打标
- [x] `ConnectionVisibilityService` / `TeamMembershipService.listTeams`：按当前 tenant 过滤
- [x] 新建 Team 写入当前 `tenantId`
- [x] `connections` / `teams` / `oidc` 迁入 `tenants/default/`（legacy 备份为 `*.migrated`）
- [x] Team 全链路 `requireTeam` / `requireMember` / 邀请码加入：租户校验（防 IDOR）
- [x] 出站 Webhook **租户级**（合并迁移 `users/*/outbound-webhooks.json`；管理员写）；OIDC 文件已迁路径（多租户映射待 Phase 2）
- [x] API Token / Session 绑定 tenant（Session 已有；Token 持久化与鉴权写入 Context）
- [x] 审计：Team 审计日志带 `tenantId`；用户级 SQL/终端审计仅写入当前租户的团队
- [x] **真路径隔离**：`TeamStore` / `ConnectionCatalog` / `OidcConfigStore` 按 `UserContext.tenantId` 读写 `tenants/{id}/…`（非 default 不迁根 legacy）

**验收：** 手工造第二租户目录（即便 UI 隐藏）时，default 用户读不到另一租户连接/团队。

### Phase 2 — SaaS 产品面（`mode=multi`）

- [x] 租户开通 / 冻结 / 删除（软删）—— `POST/PUT /api/tenants*`，平台超管；`allow-tenant-create` 可放开自助开户
- [x] 邀请入租户（`POST /api/tenants/{id}/members`；`GET` 列表 / `DELETE` 移除；最后一个 tenant_admin 受保护）；org 切换：`POST /api/auth/switch-tenant` + 个人菜单 UI（`tenancyMode=multi` 且 ≥2 组织时显示）
- [x] 平台超管：`datawise.tenancy.platform-admin-user-ids`；single 与 tenant_admin 合并；multi 白名单空时回退首个注册用户
- [x] OIDC 多租户映射：`tenantClaim` + `tenantClaimMap`；回调自动 membership；未映射拒绝 `OIDC_TENANT_UNMAPPED`
- [x] 配额：连接数硬性上限 `max-connections-per-tenant`；迁移并发槽按产品 `tenantId`（`TenantConcurrencyKeys`）
- [x] 平台超管租户管理 UI（设置 → 租户管理：开通/冻结/软删 + 成员邀请与角色，仅 multi + platformAdmin）
- [x] 注册开户流（可选）：`allow-registration` + `POST /api/auth/register`；multi 且 `allow-tenant-create` 时可自助建组织；登录框按 `login-options` 切换注册
- [x] AI 调用配额：`max-ai-calls-per-tenant-per-day`；`AiController` chat/analyze/sql 入口硬性上限（`TENANT_AI_QUOTA_EXCEEDED`）
- [x] AI 用量快照导出：Settings → 租户管理卡片 **Copy JSON / Download CSV**（当日 calls/limit/remaining）

**验收：** 两租户同实例互不可见；同用户可属两租户并切换。

### Phase 3 — 存储后端（规模）

- [x] `StorageBackend=file|jdbc`（`datawise.storage.backend`；默认 `file`）
- [x] 身份元数据进 DB：users / sessions / api_tokens / tenants / roles / memberships（Flyway `db/metadata/migration`；Spring JDBC）
- [x] Teams 快照进 DB：`dw_team_snapshots`（按租户 JSON，对齐 `teams.json`）
- [x] Connections catalog 进 DB：`dw_connection_snapshots`（按租户 XML，密钥仍走 SecretValueCodec）
- [x] OIDC 配置进 DB：`dw_oidc_configs`（按租户 JSON，对齐 `oidc.json`）
- [x] Outbound webhooks 进 DB：`dw_outbound_webhook_snapshots`（按租户 JSON 列表）
- [x] 租户 AI 日用量进 DB：`dw_tenant_ai_usage`
- [x] SQL 执行历史进 DB：`dw_sql_history`（按条存储；对齐 `sql-history.json`）
- [x] Local 桌面继续 file backend；plugins JAR / 部分桌面缓存仍文件
- [x] 个人工作区按租户分区：`users/{id}/tenants/{tenantId}/`（语义指标、AI 知识、计划任务等；`app.xml` 除外）
- [ ] 后续波次：对象存储；其余文件态配置按需迁 JDBC

---

## 9. 现有数据迁移步骤（Phase 0→1）

对已有 `config/` 实例：

1. **创建** `tenants/index.json` + `tenants/default/tenant.json`
2. **写入** 内置 `roles.json`
3. **读取** `users.json`：  
   - id 最小非 guest → membership + `tenant_admin`  
   - 其余注册用户 → `developer`（或保留其 feature map 为自定义角色）  
   - guest 不建 membership（或只读会话策略不变）
4. **Phase 1：** 移动 `connections.xml`、`teams.json`、`oidc.json` → `tenants/default/`；根路径留兼容读取一层
5. **回滚：** 保留迁移前备份目录；启动失败则不删旧文件

幂等：每次启动检测「未迁移标记」再执行；已迁移跳过。

---

## 10. 与 Wave A / 任务并发的衔接

| 已有能力 | Dual-mode 下归属 |
|----------|------------------|
| OIDC（`OidcConfigStore`） | 租户级；single → default |
| Outbound Webhooks | 建议租户级（运维统一）；个人调试可保留 user 级副本 |
| 团队审计导出 | 查询强制 `team.tenantId == ctx.tenantId` |
| `TenantSlotPolicy` | 更名或增加 `OrgSlotPolicy`；key = 产品 `tenantId`，避免与 userId 混淆 |

---

## 11. 风险与决策点

| 风险 | 缓解 |
|------|------|
| 文件搬家破坏桌面用户数据 | Phase 0 不搬家；Phase 1 兼容读 + 备份 |
| 一用户多租户时个人 `users/{id}/` 数据串味 | 明确哪些资源是 user-global vs tenant-scoped；语义指标等优先租户级 |
| Feature 键爆炸 | 角色用预设；高级才暴露逐键编辑 |
| 误把 Team 当租户 | 文档与 API 命名严格区分 `tenantId` vs `teamId` |
| SaaS 未做路径隔离就上 multi | Phase 1 验收未过禁止默认 `multi` |

**已锁定（见文首「评审锁定」）；历史「Phase 2 再议」项已确认：**

1. Username：`single`/`multi` 均保持**全局唯一**（email 策略可后续加唯一约束，不阻塞）。  
2. Outbound Webhook：**租户级**（已落地）。  
3. 平台超管：`datawise.tenancy.platform-admin-user-ids` **配置白名单**（已落地）。

---

## 12. 建议落地顺序（与路线图关系）

```text
Wave A（已完成）→ 本设计 Phase 0（RBAC + default tenant）
                 → Wave B 核心能力加深可并行
                 → Phase 1 隔离硬化（上 multi 的前置条件）
                 → Phase 2 SaaS 产品面（对应 G12）
```

不建议在 Phase 1 完成前对外宣称「多租户 SaaS」；Phase 0 即可对外宣传「基于角色的权限（本地 / 私有化）」。

---

## 13. 参考代码锚点

| 主题 | 位置 |
|------|------|
| 会话 | `datawise-config/.../security/UserContext.java` |
| 功能权限键 | `datawise-common/.../domain/UserFeaturePermission.java` |
| 权限裁决 | `datawise-config/.../service/UserPermissionPolicy.java` |
| 实例 Admin | `datawise-config/.../service/UserAdminPolicy.java` |
| 团队角色 | `datawise-common/.../support/TeamRoleSupport.java` |
| 连接可见性 | `datawise-config/.../service/ConnectionVisibilityService.java` |
| 配置路径 | `datawise-config/.../configstore/ConfigPaths.java` |
| 并发「tenant」 | `datawise-taskconcurrency/.../TenantSlotPolicy.java` |
