# 产品缺口分析 — 缺少能力与近期补强

> 更新：2026-07-19（**MVP deepen 收口**）  
> 视角：产品定位「AI 驱动的团队数据工作台」，而非又一个 JDBC 客户端。  
> 对照：功能广度已接近完整工作台（见 [PLATFORM_ROADMAP.md](./PLATFORM_ROADMAP.md)、[CLIENT_IDE_OPTIMIZATION_BACKLOG.md](./CLIENT_IDE_OPTIMIZATION_BACKLOG.md)）。

### 状态口径（2026-07-19 起）

| 状态 | 含义 | 是否继续日更切片 |
|------|------|------------------|
| `done` | MVP 已够卖、可写进材料；尾巴属长尾或刻意不做 | **否** |
| `backlog` | 大客户 / 商业化大石头（季度级），不是「再加一个小函数」 | 仅立项后做 |
| `wont` | 刻意不做或超出定位（全量 BI、原生 SMTP 等） | **否** |

**停更说明：** Wave A～D 的「partial → 做硬」日更 deepen（残差再加函数、DDL 再加一种批量、嵌入再加一种复制格式……）**到此为止**。边际收益已低；再补请走明确需求 / 客户合同，不要用「继续」无限切。

---

## 一、结论（一句话）

功能面与招牌 MVP **已闭环到可对外讲**。剩下要么是 **大石头**（SAML、KMS、计费、签名分发、Calcite……），要么是 **刻意不做**——不是再堆几十个小切片能清完的清单。

---

## 二、已具备、应保持的差异化（不必用竞品同款替代）

- AI 分析画布（参数化 / 定时流水线）
- 语义指标 + RAG / 知识库
- 联邦虚拟视图与跨源 SQL（含规模边界文档与限流）
- 危险 SQL 审查 / 生产审批 / 环境标签
- Schema 漂移 → 迁移（含 PK 增量、暂停/取消）
- MCP / VS Code / headless Query Library CI
- Redis / Kafka / Yarn / SSH 工作台
- 网格 Time-travel、脱敏导出等治理向能力
- 洞察外发（digest / 工单 / Webhook）、Dashboard 只读分享与嵌入

刻意不做（避免稀释定位）：全能 JDBC 壳、Metabase 级全量 BI、GIS 等小众类型默认进主线。

---

## 三、能力清单（收口后）

### 3.1 企业准入底座

| # | 能力 | 状态 | 说明 | 后续仅当… |
|---|------|------|------|-----------|
| G1 | SSO（OIDC / SAML / LDAP） | **done**（OIDC） | Authorization Code + PKCE 已落地 | 合同要求 **SAML/LDAP** → `backlog` |
| G2 | 企业 IdP / 组织同步 | **done**（OIDC 组同步 MVP） | 组 claim → 角色；缺组停用；scopes 护栏 | 要 **SCIM / 组织树** → `backlog` |
| G3 | 外发通知通道 | **done** | Webhook + 飞书/钉钉 + HTTP 邮件网关 | 原生 SMTP → `wont`（除非合同） |
| G4 | 合规审计导出 | **done** | CSV/JSON + `audit.appended` | SIEM/哈希链 → `backlog` |
| G5 | 集中密钥 | **done**（引用方案 MVP） | env/file/json/properties/dotenv/vault + 密钥中心 | AWS/Azure KMS → `backlog` |
| G6 | Mac / Linux 桌面包 | **done**（研发可用产物） | macOS AS + Linux AppImage + 文档/About | 签名/公证/CI 发版 → `backlog` |

### 3.2 价值外溢与运营

| # | 能力 | 状态 | 说明 | 后续仅当… |
|---|------|------|------|-----------|
| G7 | 洞察 / 订阅外发 | **done**（digest MVP） | 定时 SQL/画布 → insight.digest；可配 digestMaxRows | 全量 BI 订阅中心 → `wont` |
| G8 | 只读分享 / 嵌入 | **done**（快照 MVP） | 过期分享 + iframe + Markdown 嵌入 | 实时嵌入/密码墙 → 按需 `backlog` |
| G9 | AI 配额治理 | **done**（租户日限额 MVP） | 硬顶 + UX + 出站 near_limit/exhausted | 人/团队账单 → `backlog` |
| G10 | Insight → 工单 | **done**（导出 MVP） | GitHub/GitLab/Jira + ticketUrl + labels | 自动开 PR / 状态回写 → `backlog` |

### 3.3 平台与生态

| # | 能力 | 状态 | 说明 | 后续仅当… |
|---|------|------|------|-----------|
| G11 | 连接器市场 | **done**（本地市场 MVP） | manifest、安装/热加载/升级徽章 | 远程目录托管 + 签名 → `backlog` |
| G12 | 多租户 / 托管 | **done**（dual-mode MVP） | 隔离/RBAC/配额/邀请；用量导出 | 计费发票/对象存储 → `backlog` |
| G13 | 组织级数据发现 | **done** | 命令面板 + 目录 Tab + 分面/列预览 | — |
| G14 | 编排对接 | **done**（HTTP 桥 MVP） | http_trigger + 状态回写 + Airflow/dbt/Prefect/Dagster 预设 | 原生算子 → `backlog` |
| G15 | 可调度数据质量 | **done**（规则/门禁 MVP） | 定时断言、模板、多环境门禁、导出 | JDBC 元数据表 → `backlog` |

---

## 四、招牌能力（原「partial → 做硬」）— MVP 已收口

> 下列项 **不再**作为「继续 deepen」队列。长尾（多一个 SQL 函数、多一种批量 DDL）默认不追。

| # | 能力 | 状态 | MVP 已具备 | 仅立项再做 |
|---|------|------|------------|------------|
| S1 | 主键增量同步 | **done** | PK_UPSERT、冲突策略、Diff、预检、暂停/取消、批次内轮询 | 事务内细粒度中断等 |
| S2 | 联邦 JOIN 边界 | **done** | 硬上限、Grace spill、残差目录、限流/分批/截断导出；见 [FEDERATED_JOIN_BOUNDS.md](./FEDERATED_JOIN_BOUNDS.md) | 再扩函数目录属长尾 |
| S3 | 湖仓血缘方言 | **done**（诚实 PARTIAL） | 规范化 + 硬特性软剥离（含 QUALIFY/PIVOT 等）；见 [LAKEHOUSE_LINEAGE.md](./LAKEHOUSE_LINEAGE.md) | Calcite / sidecar → `backlog` |
| S4 | Visual Query Builder | **done** | 多表 JOIN、画布拖表/拖节点、字段板、AI 精炼、控制台运行 | 字段级画布内联编辑 → 按需 |
| S5 | ER 正向建模 | **done** | FK + 改列 + 批量 DROP/ADD/MODIFY/RENAME/COMMENT | 图上内联改列 → 按需 |
| S6 | 连接器市场深度 | **done**（= G11 MVP） | 同 G11 | 同 G11 `backlog` |

对标细节仍见 [CLIENT_IDE_OPTIMIZATION_BACKLOG.md](./CLIENT_IDE_OPTIMIZATION_BACKLOG.md)（**不**再作为日更 deepen 驱动源）。

---

## 五、下一阶段（仅大石头，默认不开）

Wave A～D **执行完毕（MVP）**。默认工程重心改为：稳定性、体验债、客户合同项。

若要开新波次，只从下列 **`backlog`** 挑，并单独立项（不要「继续」自动切）：

1. G1 SAML / LDAP  
2. G2 SCIM / 组织树  
3. G5 云 KMS  
4. G6 桌面签名与 CI 发版  
5. G9 / G12 账单与对象存储  
6. G11 远程签名市场  
7. S3 Calcite / 语义 sidecar  
8. G15 DQ JDBC 元数据表  

```text
已完成：企业准入 MVP + 招牌做深 MVP + 价值外溢 MVP + 生态 MVP
未开：  上表季度级 backlog（按合同 / 融资节点）
停做：  无合同驱动的 partial 长尾切片
```

---

## 六、验收口径（MVP — 已满足则不必再扩）

| 项 | 可验收信号 | MVP |
|----|------------|-----|
| 外发通知 | 审批/定时失败/漂移可推 Webhook | ✅ |
| SSO | 至少一种 OIDC 可登录 | ✅ |
| 数据 Sync | 按主键增量 + 冲突策略 + 可中断 | ✅ |
| 联邦边界 | 超限有策略，文档与 UI 一致 | ✅ |
| AI 配额 | 租户日限额可感知、可配置 | ✅ |

---

## 七、修订记录

| 日期 | 说明 |
|------|------|
| 2026-07-19 | **收口**：停止 Wave A～D 日更 deepen；G/S 大多标 `done`（MVP）；大石头改 `backlog`；长尾默认不追 |
| 2026-07-17 | 初稿：missing / partial；Wave A～D |
| 2026-07-17～19 | 大量 deepen 切片（残差函数、湖仓软剥离、VQB/ER、外发/分享/配额/工单/编排/DQ 等）— 详见 git `feat: deepen*` 与下方历史行 |

<details>
<summary>历史切片明细（折叠，仅归档）</summary>

| 日期 | 说明 |
|------|------|
| 2026-07-17 | G12：Phase 0–2 + JDBC 元数据；计费/对象存储仍开 |
| 2026-07-18、S2 裸 NOT | 联邦残差 WHERE 裸 NOT |
| 2026-07-18、G13 分页/血缘/浏览 | discovery 分页、指标血缘、空 q 浏览 |
| 2026-07-19、G13 分面/列预览 | tags、服务端分面、列预览 |
| 2026-07-19、S5 批量 DDL | DROP / ADD / MODIFY / RENAME / COMMENT |
| 2026-07-19、G8 | 分享过期、iframe、Markdown 嵌入 |
| 2026-07-19、G7 | digestMaxRows（SQL + 画布） |
| 2026-07-19、S4 | 复制 SQL、AI 精炼、控制台运行、画布拖节点 |
| 2026-07-19、G14 | HTTP 预设（Airflow/dbt/Prefect/Dagster） |
| 2026-07-19、G11 | 重装升级、Upgrade 徽章、热加载 |
| 2026-07-19、G9 | 配额外发事件 |
| 2026-07-19、G5 | json-file / properties / dotenv / vault |
| 2026-07-19、S2 | CAST、CASE、ROUND、CEIL/FLOOR、GREATEST/LEAST、截断导出、源窗口分批、残差函数目录… |
| 2026-07-19、S1 | 取消迁移、批次内轮询、预检警告 |
| 2026-07-19、S3 | ORDINALITY、TRY_CAST、GROUPING、QUALIFY、PIVOT |
| 2026-07-19、G10 | ticketUrl、跨通道 labels |
| 2026-07-19、G15 | 门禁导出、共享模板管理 |
| 2026-07-19、G2 / G6 | OIDC scopes 护栏、Linux 文档 |
| 2026-07-18～19 | G15 规则模板/多环境门禁；G13 目录；G14 DAG 状态 等 |

</details>
