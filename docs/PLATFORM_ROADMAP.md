# Platform Roadmap — 完成度追踪

> AI 驱动的团队数据工作台：连接、SQL、AI 分析、迁移、审批的可沉淀链路。

状态说明：**done** 已实现 · **partial** 有 MVP、缺深度集成 · **todo** 未开始 · **in_progress** 开发中

版本主题（对外叙事）：

| 版本 | 主题 | 一句话 |
|------|------|--------|
| **v1.2** | 跨源无忧 | 用一句话 JOIN 两个库的数据 |
| **v1.3** | 分析自动化 | 画布定时跑，结果自动推给你 |
| **v1.4** | 对话式看板 | 跟 Dashboard 说话，Widget 自己长出来 |
| **v2.0** | 团队实时协作 | 像 Google Docs 一样一起写 SQL |

---

## 一、招牌功能

| # | 功能 | 状态 | 版本 | 说明 |
|---|------|------|------|------|
| 1 | AI 分析画布（参数化重跑） | done | v1.1 | 保存/CRUD/占位符替换；参数表单重跑、打开控制台 |
| 2 | 语义层 / Data Catalog | done | v1.1 | 指标 CRUD + 自动生成；已接入 AI Schema 提示词 |
| 3 | AI SQL 审查 + 门禁 | done | v1.2 | 规则审查 + AI 改写 + 控制台/MCP + EXPLAIN 深度 |
| 4 | 联邦查询 2.0 | done | v1.2 | `@alias` + 内存 JOIN + AI 跨源 SQL + **虚拟视图向导** |
| 5 | AI 表打标 | done | v1.1 | Schema/MCP 仅读打标表；助手范围树 |
| 6 | 分析画布 AI 流水线定时重跑 | done | v1.3 | 定时任务触发完整 DataAgent 分析，更新画布并推送通知 |

## 二、体验与生态

| # | 功能 | 状态 | 版本 | 说明 |
|---|------|------|------|------|
| 7 | DataWise MCP Server | done | v1.1 | 基础工具 + 语义指标 / 画布重跑 |
| 8 | SQL 版本化 / Query Library | done | v1.1 | 后端 API + 书签保存版本 / 历史查看 |
| 9 | Schema 漂移监控 | done | v1.1 | 监控 + 对比；漂移报告 + 一键迁移向导 |
| 10 | 定时任务 / 告警 | done | v1.3 | Cron 执行 + 通知抽屉；画布类型接入 AI 流水线 |
| 11 | 新用户 Onboarding 引导 | done | v1.3 | 首次连接后 30 秒触发「选表→AI 提问→保存洞察」引导 |
| 12 | 版本更新亮点卡片 | done | v1.3 | Dashboard / Platform Hub 展示本版本新功能，支持一键跳转能力入口 |
| 13 | 统一产品版本号 + CHANGELOG | done | v1.3 | 根目录 CHANGELOG，子包版本对齐 |

## 三、v1.2 待实现（跨源无忧）

| # | 功能 | 状态 | 说明 |
|---|------|------|------|
| 14 | 联邦 JOIN 执行 | done | `FederatedQueryService` 解析 `@alias` JOIN，各源子查询后内存 INNER JOIN |
| 15 | 联邦虚拟视图向导 | done | 三步向导：选源拖拽排序 → AI 生成 SQL → 保存视图 |
| 16 | SQL 审查 EXPLAIN 深度 | done | 审查阶段自动 EXPLAIN，识别全表扫描/未命中索引/高扫描行数风险 |

## 四、v1.4 待实现（对话式看板）

| # | 功能 | 状态 | 说明 |
|---|------|------|------|
| 17 | 自然语言 Dashboard Widget | done | Dashboard 支持自然语言生成组件建议，并一键落位到指定列 |
| 18 | 指标血缘与口径变更告警 | done | 指标支持上游指标血缘字段、口径版本递增与变更通知 |

## 五、v2.0 锦上添花（未排期）

| 功能 | 状态 |
|------|------|
| 多人协同编辑 SQL 控制台 | done | 拉取/推送 + 轮询冲突 + 乐观锁 + SSE + presence + 冲突 diff |
| Connector 社区市场 | done | 独立页面浏览 catalog 连接器，区分可用/待安装 |
| 表数据变更审计 / Time-travel | done | 网格 DML 本地审计 + 一键回滚 |
| 测试数据生成 | done | 表 Tab 工具栏 + 右键菜单；列名启发式 + 预览/执行/导出 SQL |
| Git 集成 Query Library CI | done | query-library.json 清单 + headless CLI validate/run + GitHub Actions + 书签导出 |

---

## 实现队列（按顺序逐一落地）

- [x] AI 表打标
- [x] 分析画布参数化重跑 UI
- [x] 语义层接入 AI 提示词
- [x] Query Library 前端（书签联动）
- [x] MCP 扩展工具
- [x] Schema 漂移 → 迁移向导
- [x] 定时任务通知
- [x] SQL 审查 AI 改写 + 控制台应用
- [x] 联邦跨源 SQL AI 生成
- [x] **#6 分析画布完整 AI 流水线定时重跑**
- [x] **#14 联邦 JOIN 执行**
- [x] **#15 联邦虚拟视图向导**
- [x] **#16 SQL 审查 EXPLAIN 深度**
- [x] **#11 新用户 Onboarding 引导**
- [x] **#12 版本更新亮点卡片**
- [x] **#13 统一 CHANGELOG**
- [x] **#17 自然语言 Dashboard Widget**
- [x] **#18 指标血缘与口径变更告警**
