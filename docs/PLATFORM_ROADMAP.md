# Platform Roadmap — 完成度追踪

> AI 驱动的团队数据工作台：连接、SQL、AI 分析、迁移、审批的可沉淀链路。

状态说明：**done** 已实现 · **partial** 有 MVP、缺深度集成 · **todo** 未开始

## 一、招牌功能

| # | 功能 | 状态 | 说明 |
|---|------|------|------|
| 1 | AI 分析画布（参数化重跑） | partial → done | 保存/CRUD/占位符替换；参数表单重跑、打开控制台 |
| 2 | 语义层 / Data Catalog | partial → done | 指标 CRUD + 自动生成；**已接入 AI Schema 提示词** |
| 3 | AI SQL 审查 + 门禁 | partial | 规则审查 + 控制台/MCP；缺 AI 改写、EXPLAIN 深度 |
| 4 | 联邦查询 2.0 | partial | `@alias` + 内存 JOIN；缺 AI 跨源 SQL、虚拟视图向导 |
| 5 | AI 表打标 | done | Schema/MCP 仅读打标表；助手范围树 |

## 二、体验与生态

| # | 功能 | 状态 | 说明 |
|---|------|------|------|
| 6 | DataWise MCP Server | partial → done | 基础工具 + **语义指标 / 画布重跑** |
| 7 | SQL 版本化 / Query Library | partial → done | 后端 API + **书签保存版本 / 历史查看** |
| 8 | Schema 漂移监控 | partial → done | 监控 + 对比；**漂移报告 + 一键迁移向导** |
| 9 | 定时任务 / 告警 | partial → done | Cron 执行；**完成/失败写入通知抽屉** |

## 三、锦上添花（未排期）

| 功能 | 状态 |
|------|------|
| 多人协同编辑 SQL 控制台 | todo |
| Connector 社区市场 | todo |
| 表数据变更审计 / Time-travel | todo |
| 测试数据生成 | todo |
| 自然语言 Dashboard Widget | todo |
| Git 集成 Query Library CI | todo |

## 落地顺序（已完成项打勾）

- [x] AI 表打标
- [x] 分析画布参数化重跑 UI
- [x] 语义层接入 AI 提示词
- [x] Query Library 前端（书签联动）
- [x] MCP 扩展工具
- [x] Schema 漂移 → 迁移向导
- [x] 定时任务通知
- [x] SQL 审查 AI 改写 + 控制台应用
- [x] 联邦跨源 SQL AI 生成
- [ ] 分析画布完整 AI 流水线定时重跑
