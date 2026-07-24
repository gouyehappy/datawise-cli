# 12 · 桌面与生态

## 12.1 Windows / macOS / Linux 桌面

### Windows / macOS / Linux

```bash
cd datawise-frontend
npm run dist:desktop
# 产物：datawise-desktop/dist/{windows|macos|linux}/
#       datawise-frontend/release/DataWiseCLI-*-{os}-{arch}.zip
```

桌面壳基于 **JCEF**（[`datawise-desktop/`](../../datawise-desktop/)），内嵌后端端口默认 `18423`，无需单独开 Vite。

平台说明：

- macOS：[DESKTOP_MAC.md](../DESKTOP_MAC.md)
- Linux：[DESKTOP_LINUX.md](../DESKTOP_LINUX.md)

签名 / 公证为 backlog；当前以研发可用 zip / app-image 为准。

### 桌面特有能力

- 系统托盘 / 窗口控制
- **工作区切换**（多份 `config` 目录，切换会重启应用）
- Deep Link：可从 VS Code 扩展打开桌面定位

## 12.2 DataWise MCP（IDE 智能体）

目录：`datawise-mcp/`

面向 Cursor / Claude Desktop 等 MCP 客户端，暴露例如：

- Schema 只读探查
- 只读 SQL
- 语义指标 / 画布重跑等扩展工具

### 使用概要

1. 按 `datawise-mcp/README.md` 安装依赖并构建。  
2. 在 MCP 客户端配置启动命令与后端地址。  
3. 在对话中让智能体查询 Schema 或只读执行。  

注意：生产库务必使用只读账号，并限制工具范围。

## 12.3 VS Code 扩展

目录：`datawise-vscode/`

- 在 VS Code 中联动 DataWise 桌面
- 通过 Deep Link 打开连接/对象

安装与调试见扩展内 README。

## 12.4 无头 CLI（CI / 自动化）

目录：`headless-cli/`

典型用途：

| 命令场景 | 说明 |
|----------|------|
| Query Library 校验 | `query-library validate` 检查清单 SQL |
| 运行清单 | CI 中批量执行/校验 |
| 迁移等自动化 | 按 CLI 子命令（见该包 README） |

示例：

```bash
cd headless-cli && npm install && npm run build
node dist/main.js query-library validate -m ../examples/query-library/query-library.json
```

可与 GitHub Actions 组合，把书签导出的 `query-library.json` 纳入 PR 检查。

## 12.5 嵌入式 SQL 编辑器包

`sql-editor/` 发布为 `@datawise/sql-editor`（MIT），可嵌入其他前端。

能力演示：

- 方言补全与片段  
- 外键 JOIN 提示  
- 格式化  

见 [sql-editor/README.zh-CN.md](../../sql-editor/README.zh-CN.md) 与 `sql-editor/docs/` 下图片/GIF。

## 12.6 编排与外部系统

平台定时任务可通过 **HTTP 桥** 触发外部编排（Airflow / dbt / Prefect / Dagster 等预设），并可回写任务状态；洞察可外发到 Webhook / 飞书钉钉 / 工单通道（设置 → 集成）。

## 12.7 文档索引

| 文档 | 用途 |
|------|------|
| [docs/README.md](../README.md) | 工程与参考文档索引 |
| 本说明书目录 | [README.md](./README.md) |
| [截图清单](../assets/screenshots/MANIFEST.md) | 界面截图与图注 |

---

## 附录 A · 推荐学习路径

1. 第 1–3 章：启动并建好第一条连接  
2. 第 4–5 章：熟练控制台与表数据  
3. 第 6–7 章：AI 与仪表盘  
4. 第 8–9 章：联邦、画布、迁移  
5. 第 10–11 章：团队治理与设置（管理员）  
6. 第 12 章：按需接入 MCP / CI / 桌面  

## 附录 B · 重新生成说明书截图

```bash
npm run capture:demos --prefix datawise-frontend
# 输出：docs/assets/screenshots/*.png（说明书直接引用该目录）
```

当前共 13 张真实界面截图（仪表盘、资源树、SQL、AI、插件、设置×4、平台×3、新建连接）。
