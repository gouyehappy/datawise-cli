# DataWise 使用说明书

面向数据分析师、数据开发与团队管理员的操作手册。  
配图均为客户端真实界面截图（`npm run capture:demos`），每张图附「图中信息」。

```bash
npm run capture:demos --prefix datawise-frontend
```

截图清单：[MANIFEST.md](../assets/screenshots/MANIFEST.md) · 产品概览：[../../README.zh-CN.md](../../README.zh-CN.md)

---

## 文档导航

| 章节 | 内容 | 主要截图 |
|------|------|----------|
| [01 · 快速开始](./01-getting-started.md) | 安装启动、首次配置 | 工作流见各章 |
| [02 · 界面总览](./02-interface.md) | 顶栏、导航、命令面板、快捷键 | `01` `02` |
| [03 · 连接与资源树](./03-connections-explorer.md) | 新建连接、右键菜单、Redis/Kafka/YARN/SSH | `02` `13` |
| [04 · SQL 控制台](./04-sql-console.md) | 执行、网格、书签、VQB、Text-to-SQL | `03` |
| [05 · 表与数据操作](./05-table-data.md) | 导入导出、备份还原、ER、AI 打标 | — |
| [06 · AI 分析](./06-ai-analysis.md) | 范围、流水线、画布、导出 | `04` `09` |
| [07 · 仪表盘](./07-dashboard.md) | 概览、组件、分享 | `01` |
| [08 · 平台中心](./08-platform-hub.md) | 画布、联邦、漂移、DQ、定时 | `10` `11` `12` |
| [09 · Schema 对比与迁移](./09-schema-migration.md) | 对比、迁移向导、闭环 | `12` |
| [10 · 团队与治理](./10-team-governance.md) | 共享、加入审批、生产 SQL 审批、权限、租户 | 设置侧栏见 `06` |
| [11 · 设置与插件](./11-settings-plugins.md) | 偏好、健康、AI、插件 | `05`–`09` |
| [12 · 桌面与生态](./12-desktop-ecosystem.md) | Electron、MCP、CLI、扩展 | — |

---

## 功能速查（按「我想…」）

| 我想… | 去哪一章 | 关键入口 |
|-------|----------|----------|
| 装起来并登录 | [01](./01-getting-started.md) | 后端 `18421` + 前端 `28413` |
| 搞清按钮都在哪 | [02](./02-interface.md) | 左侧导航、`Ctrl+K` |
| 接上 MySQL/PG… | [03](./03-connections-explorer.md) | 新建数据源；截图 `13` |
| 用 Redis 查 Key / 跑命令 | [03.8.1](./03-connections-explorer.md#381-redis) | Key 浏览 / 命令控制台 |
| 用 Kafka 看消息 / 发表数据 | [03.8.2](./03-connections-explorer.md#382-kafka) | Topic 浏览；表数据发布 |
| 看 YARN 应用 / 队列 | [03.8.3](./03-connections-explorer.md#383-yarn) | 应用列表 |
| 开 SSH 终端 | [03.8.4](./03-connections-explorer.md#384-ssh-终端) | 打开 SSH 终端 |
| 写 SQL / 看结果 | [04](./04-sql-console.md) | 双击库或「新建控制台」 |
| 不会写 JOIN | [04 · VQB](./04-sql-console.md#46-可视化查询构建vqb) | 控制台 → 可视化查询构建 |
| 打开表改两行数据 | [05](./05-table-data.md) | 双击表 |
| CSV 导入 / SQL 备份 | [05](./05-table-data.md) | 表/库右键向导 |
| 让 AI 能看到某张表 | [05.9](./05-table-data.md#59-查看所有表与-ai-打标) | 查看所有表 → 打标 |
| 用中文问数 | [06](./06-ai-analysis.md) | 顶栏 AI；先配模型 `09` |
| 看连接是否挂了 | [07](./07-dashboard.md) / [11.4](./11-settings-plugins.md#114-连接健康) | 仪表盘连接状态 |
| 跨库联合查询 | [08.3](./08-platform-hub.md#83-联邦视图跨源-join) | 树 AI → 联邦视图 |
| 保存分析天天跑 | [08.2](./08-platform-hub.md#82-分析画布) + 定时任务 | 保存为画布 |
| 开发库结构同步到预发 | [09](./09-schema-migration.md) | 数据迁移向导… |
| 生产变更要审批 | [10.6](./10-team-governance.md#106-生产-sql-审批写操作) | 控制台「提交审批」→ 团队「批准并执行」 |
| 审批同事加入团队 | [10.5](./10-team-governance.md#105-加入团队审批邀请码) | 团队 → 审批 Tab |
| 配 API Key / 装连接器 | [11](./11-settings-plugins.md) | `Ctrl+,`；插件中心 `05` |
| IDE 里让 Agent 查库 | [12](./12-desktop-ecosystem.md) | `datawise-mcp/` |

---

## 界面速览（真实截图）

### 仪表盘

![仪表盘](../assets/screenshots/01-dashboard.png)

**图中信息：** 顶部可进入数据库 / AI；中间为运行指标与快捷操作；左下为连接状态；右侧为当前工作区与已启用插件。

### 资源树 + 命令面板

![资源树](../assets/screenshots/02-explorer.png)

**图中信息：** 左侧已展开至 AI 能力入口；叠加命令面板（`Ctrl+K`）可搜索模块、书签与对象。

### SQL 控制台

![SQL 控制台](../assets/screenshots/03-sql-console.png)

**图中信息：** 上方 Monaco 编辑器与执行按钮；下方结果网格（示例已执行 `SELECT 1`）。

### AI 分析

![AI 分析](../assets/screenshots/04-ai-analysis.png)

**图中信息：** 中央为对话与分析结果；可配置模型与数据范围；可将 SQL 打开到控制台或保存为画布。

### 设置 · 基础设置

![基础设置](../assets/screenshots/06-settings-basic.png)

**图中信息：** 左侧分组导航；右侧为 API 服务器、界面款式等。快捷键 `Ctrl+,`。

### 平台 · 分析画布

![分析画布](../assets/screenshots/10-platform-canvas.png)

**图中信息：** 资源树 `AI → 分析画布`；主区为画布列表，可新增 / 删除 / 重新运行。

---

## 阅读约定

- **入口**：菜单 / 右键 / 快捷键如何打开。
- **步骤**：推荐操作顺序（可照着点）。
- **图中信息**：对照真实截图中的区域含义。
- **速查表**：右键菜单与设置项名称与产品中文一致。

## 推荐学习路径

1. [01](./01-getting-started.md)–[03](./03-connections-explorer.md)：启动并建好第一条连接  
2. [04](./04-sql-console.md)–[05](./05-table-data.md)：控制台与表数据  
3. [06](./06-ai-analysis.md)–[07](./07-dashboard.md)：AI 与仪表盘  
4. [08](./08-platform-hub.md)–[09](./09-schema-migration.md)：平台与迁移  
5. [10](./10-team-governance.md)–[11](./11-settings-plugins.md)：治理与设置（管理员）  
6. [12](./12-desktop-ecosystem.md)：桌面 / MCP / CI（按需）
