# 产品缺口分析 — 缺少能力与近期补强

> 更新：2026-07-17  
> 视角：产品定位「AI 驱动的团队数据工作台」，而非又一个 JDBC 客户端。  
> 对照：功能广度已接近完整工作台（见 [PLATFORM_ROADMAP.md](./PLATFORM_ROADMAP.md)、[CLIENT_IDE_OPTIMIZATION_BACKLOG.md](./CLIENT_IDE_OPTIMIZATION_BACKLOG.md)）；缺口在**企业准入、招牌深度、价值外溢**。

状态：`missing` 基本没有 · `partial` 有 MVP、缺硬深度 · `planned` 已纳入近期补强

---

## 一、结论（一句话）

功能面已经很宽，v1.x～v2.0 多数条目已闭环。真正缺的不是「再多一个 Tab」，而是：**企业能买进、招牌能力敢写进销售材料、洞察/告警能走出客户端**。

---

## 二、已具备、应保持的差异化（不必用竞品同款替代）

- AI 分析画布（参数化 / 定时流水线）
- 语义指标 + RAG / 知识库
- 联邦虚拟视图与跨源 SQL
- 危险 SQL 审查 / 生产审批 / 环境标签
- Schema 漂移 → 迁移
- MCP / VS Code / headless Query Library CI
- Redis / Kafka / Yarn / SSH 工作台
- 网格 Time-travel、脱敏导出等治理向能力

刻意不做（避免稀释定位）：全能 JDBC 壳、Metabase 级全量 BI、GIS 等小众类型默认进主线。

---

## 三、缺少功能（`missing`）

### 3.1 企业准入底座

| # | 能力 | 状态 | 说明 | 为何缺了会卡增长 |
|---|------|------|------|------------------|
| G1 | SSO（OIDC / SAML / LDAP） | done（OIDC） | OIDC Authorization Code + PKCE 已落地；SAML/LDAP 仍缺 | 中大型客户过不了安全评审 |
| G2 | 企业 IdP / 组织同步 | partial | OIDC 组 claim → 租户角色同步 + 缺组时停用 membership / 吊销会话（Settings → Integrations）。缺完整 SCIM / 组织树 / LDAP | 账号生命周期不可运营 |
| G3 | 外发通知通道 | done（Webhook+飞书/钉钉/邮件） | 通用 Webhook + HMAC；飞书/钉钉机器人；**邮件** `channel=email`（HTTP 邮件网关 / `mailto:` + `DATAWISE_MAIL_WEBHOOK_URL`）。原生 SMTP 客户端仍缺 | 审批、漂移、定时失败可外发闭环 |
| G4 | 合规审计导出 | done（导出+Webhook） | 服务端 CSV/JSON 导出 + `audit.appended`；完整 SIEM/哈希链仍缺 | 「可证明合规」不足 |
| G5 | 集中密钥（Vault / KMS） | partial | 主密钥可来自 `DATAWISE_MASTER_KEY`；连接字段支持 `dwsecret:env:` / `dwsecret:file:` / **`dwsecret:vault:path#field`**（Vault KV v2，`VAULT_ADDR`/`VAULT_TOKEN`）；Settings 密钥中心。缺 AWS/Azure KMS | 多机 / 集中部署故事弱 |
| G6 | Mac / Linux 正式桌面包 | partial | Windows NSIS/便携已稳；macOS Apple Silicon：`dist:desktop:mac` + electron-builder DMG/zip + [DESKTOP_MAC.md](./DESKTOP_MAC.md)；缺签名/公证与 CI 产物；Linux AppImage 脚手架 | 研发侧 macOS 用户门槛高 |

### 3.2 价值外溢与运营

| # | 能力 | 状态 | 说明 | 为何缺了会卡增长 |
|---|------|------|------|------------------|
| G7 | 洞察 / Dashboard 订阅外发 | partial | 定时 SQL/画布任务可选 `digest` → `insight.digest` Webhook（截断行/画布摘要）；非全量 BI 订阅中心 | AI 画布价值留在桌面内 |
| G8 | 只读分享看板 / 嵌入链接 | partial | Dashboard 图表冻结快照分享 + 设置菜单管理/撤销；公开页 `/share/{token}`；非实时嵌入 | 分析师路径断在工作台 |
| G9 | AI 成本与配额治理 | partial | 租户日调用硬顶 + Settings 用量卡；未做人/团队账单 | 开 AI 后运维会怕滥用 |
| G10 | Insight → 工单 / PR / Runbook | partial | 出站通道 `github_issue` / `gitlab_issue` + 手动 `POST /api/platform/insight-actions`（`insight.action`）；见 [INSIGHT_ACTIONS.md](./INSIGHT_ACTIONS.md)。缺自动开 PR / 状态回写 / Jira 原生 | 洞察难变成组织动作 |

### 3.3 平台与生态规模化

| # | 能力 | 状态 | 说明 | 为何缺了会卡增长 |
|---|------|------|------|------------------|
| G11 | 真·连接器远程市场 | partial | 浏览 / 安装引导 + 本地 `manifest.json`；管理员一键安装 + **热加载** `POST /api/datasources/plugins/reload`（安装后自动 reload）。缺远程目录托管 / 签名通道 | 生态难自运转 |
| G12 | 多租户 / 托管 SaaS | partial | Dual-mode 已落地（`tenancy.mode=single|multi`）：租户隔离、RBAC、OIDC 映射、配额硬顶、成员邀请；见 [TENANT_RBAC_DESIGN.md](./TENANT_RBAC_DESIGN.md)。缺完整计费/发票与对象存储 | 托管商业化与计费仍弱 |
| G13 | 组织级数据发现 | partial | 命令面板跨库搜表 + GET /api/discovery/search（**offset 分页**）；**数据目录 Tab** + 血缘跳转 + 分面 + 无查询浏览 + **Load more**；见 [DISCOVERY.md](./DISCOVERY.md)。缺标签分面 / 服务端分面 | 语义层有了，发现体验仍弱 |
| G14 | 编排生态对接 | partial | 定时任务 http_trigger + 入站 trigger + orchestration.* Webhook + **DAG 状态回写**（statusUrlTemplate / POST /api/platform/orchestration/status + 定时任务目录列）；见 [ORCHESTRATION.md](./ORCHESTRATION.md)。缺原生算子 / 多引擎状态适配器 | Yarn 可看，闭环不足 |
| G15 | 可调度数据质量规则 | partial | 定时任务 data_quality + Explorer **数据质量**目录 + blocking + gate API + **内置/用户模板库** + **多环境对照门禁**（pairByName 按名配对）；见 [DATA_QUALITY.md](./DATA_QUALITY.md)。缺服务端共享模板 | 质量治理难产品化 |

---

## 四、近期需要补强的功能（`partial` → 做硬）

> 已有入口或 MVP，但深度不足，直接影响「招牌能力」可信度与续费。优先于堆新 Tab。

| # | 能力 | 状态 | 现状 | 补强目标 |
|---|------|------|------|----------|
| S1 | 按主键 / 唯一键的**数据增量同步** | partial | 结构同步已闭环；数据迁移 `PK_UPSERT` + 冲突策略（MySQL/PG）+ 生产目标审批门控；**行级 Diff 预览** `POST /api/migration/row-diff`（采样 insert/update/unchanged）。缺全量扫描、可中断进度 UX 加深 | Compare → 勾选 → 冲突策略 → 进度可中断 → 可走审批 |
| S2 | **联邦 JOIN 规模边界** | partial | 内存 INNER JOIN + 硬上限 + hasMore；Grace hash 落盘；外层 WHERE 下推 + 残差 **OR / IN / IS NULL / LIKE[+ESCAPE] / UPPER|LOWER / 裸 NOT**；见 [FEDERATED_JOIN_BOUNDS.md](./FEDERATED_JOIN_BOUNDS.md)。仍缺更多 SQL 函数 | 限流 / 溢出策略 / 文档化边界；可选下推或分批 |
| S3 | **湖仓血缘方言** | partial | Hive/Spark/Flink：`LakehouseLineageParser` 规范化 + 硬特性软剥离/表级回退（`_table_deps`）；Trino/Presto 仍 COMPLETE；见 [LAKEHOUSE_LINEAGE.md](./LAKEHOUSE_LINEAGE.md)。Calcite 语义分析 / sidecar 仍缺 | 关键方言到可用 `complete/partial`，失败诚实降级 |
| S4 | Visual Query Builder | partial | 多表 JOIN + 关联步拖表 + 字段排序板拖拽 + 侧栏 Text-to-SQL 并排；画布上字段自由布局仍浅 | 画布级字段自由布局 / 更强与 AI 联动 |
| S5 | ER 图正向建模 | partial | FK 连线检视/新建闭环 + 图上选列改列（AlterColumn DDL 预览/执行/控制台审批）；列级仍非画布内联编辑 | 图上内联改列 / 批量 DDL 编排 |
| S6 | 连接器市场深度 | partial | 浏览 catalog + `manifest.json` + 远程一键安装 + **热加载**；缺签名通道 / 远程目录托管 | 远程安装 / 签名通道 / 一键升级 |

对标细节仍见 [CLIENT_IDE_OPTIMIZATION_BACKLOG.md](./CLIENT_IDE_OPTIMIZATION_BACKLOG.md)（结构同步数据侧、VQB、ER 等条目）。

---

## 五、近期落地顺序（建议）

按「闭环成本 → 依赖 → 可卖点」排，不按编号机械执行。

### Wave A — 企业准入（P0）

可执行拆解见 **[WAVE_A_BACKLOG.md](./WAVE_A_BACKLOG.md)**（A1–A10）。

1. **G3 外发通知**（Webhook 先行，再飞书/钉钉/邮件）— 复用定时任务 / 审批 / 漂移事件  
2. **G1 SSO（OIDC 优先）** — 本地账号并存，可灰度  
3. **G4 审计导出** — 团队审计 → 标准导出 / Webhook  

### Wave B — 招牌做深（P0）

4. **S1 数据增量同步** — 减少「发版回流 Navicat」  
5. **S2 联邦规模边界** — 把「跨源无忧」写清楚、跑得稳  
6. **S3 湖仓血缘补强** — 面向湖仓客户的硬门槛  

### Wave C — 价值外溢（P1）

7. **G7 + G9** — 订阅外发 + AI 配额  
8. **G8 只读分享** — 轻量外溢，不做全量 BI  
9. **G6 Mac 桌面包** — 至少 Apple Silicon 正式产物  

### Wave D — 体验与生态（P1 / P2）

10. **S4 / S5** — VQB 与 ER 深度  
11. **G2 / G5** — 组织同步与密钥中心（随大客户需求）  
12. **G11～G15** — 市场、多租户、发现、编排、DQ（按商业化节奏开；G12 设计见 [TENANT_RBAC_DESIGN.md](./TENANT_RBAC_DESIGN.md)）

```text
企业准入 ──► 招牌做深 ──► 价值外溢 ──► 生态运营
  G3/G1/G4      S1/S2/S3      G7/G9/G8/G6     G11…G15 / S4/S5
```

---

## 六、验收口径（近期）

| 项 | 可验收信号 |
|----|------------|
| 外发通知 | 生产审批待审 / 定时失败 / Schema 漂移 至少一种可推到 Webhook，配置可测 |
| SSO | 至少一种 OIDC 提供商可登录，本地账号可关闭或并存 |
| 数据 Sync | 两环境同表按主键增量同步可跑通，含冲突策略与可中断 |
| 联邦边界 | 超限有明确错误 / 降级策略，文档与 UI 一致 |
| AI 配额 | 团队可设日限额，超限可感知、可配置 |

---

## 七、修订记录

| 日期 | 说明 |
|------|------|
| 2026-07-17 | 初稿：产品高度缺口分析；拆分 missing / partial；给出 Wave A～D 近期顺序 |
| 2026-07-17 | G12：Phase 0–2 + JDBC 元数据落地；状态改为 `partial`（计费/对象存储仍开） |
| 2026-07-18、S2 裸 NOT | 联邦 JOIN 残差 WHERE 支持裸 NOT（含括号组） |
| 2026-07-18、G13 分页浏览 | discovery offset/hasMore + 数据目录 Load more |\n| 2026-07-18、G13 多关联表 | 指标血缘跳转前可选择 relatedTables |\n| 2026-07-18、G13 指标血缘 | 数据目录指标经 relatedTables 跳转视图模型血缘 |\n| 2026-07-18、G13 无查询浏览 | discovery 空 q 浏览 schema 缓存 + 指标 |
| 2026-07-18、G13 分面 | 数据目录 kind/connection/owner 分面筛选 |
| 2026-07-18、S2 残差 IN | 联邦 JOIN 残差 WHERE 支持 IN / NOT IN 字面量列表 |
| 2026-07-18、S2 残差 OR | 联邦 JOIN 残差 WHERE 支持跨别名 OR |
| 2026-07-18、S2 LIKE ESCAPE | 联邦残差/下推支持 LIKE … ESCAPE |
| 2026-07-18、S2 UPPER/LOWER | 联邦残差/下推支持 unary UPPER/LOWER |
| 2026-07-18、S2 LIKE | 联邦残差/下推支持 [NOT] LIKE 字面量模式 |
| 2026-07-18、S2 单别名 OR / IS NULL | 联邦 WHERE 单别名 OR 下推实测 + 残差 IS NULL |
| 2026-07-18、G15 按名配对 | 多环境门禁 pairByName 按规则名配对 |
| 2026-07-18、G15 用户模板 | 数据质量用户保存规则模板（localStorage） |
| 2026-07-18、G15 多环境门禁 | DQ gate 支持 reference 对照连接 + scopes 汇总 |
| 2026-07-18、G15 规则模板 | 数据质量内置规则模板预填创建表单 |
| 2026-07-18、G13 目录/血缘 | 统一数据目录 Tab + 表/视图血缘跳转（impact） |
| 2026-07-18、G14 DAG 状态 | http_trigger 状态回写 API + 定时任务 UI |
| 2026-07-18、G11 热加载 | 连接器插件安装后热加载（免重启）+ `POST /api/datasources/plugins/reload` |
| 2026-07-18、G15 目录/门禁 | 数据质量规则目录 UI + release gate API（blocking 套件） |
| 2026-07-17、G5 Vault | Wave D/C/B 切片：G13/G2/G15/G14、G3 飞书钉钉、G10 Issue、S1 行级 Diff、S2 Grace hash 落盘+谓词下推、S3 硬特性软剥离+表级血缘 |
