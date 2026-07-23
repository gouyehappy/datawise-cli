# DataWise MCP Server

把 DataWise 的连接、Schema、SQL 审查与只读查询，通过 **MCP** 暴露给 Cursor / Claude Desktop 等 IDE 智能体。

包名 `@datawise/mcp-server` · 版本 **4.0.1** · 命令 `datawise-mcp`

---

## 前置条件

1. DataWise 后端已启动（默认 `http://localhost:18421`）
2. 具备 SQL 权限的会话或 API Token

---

## 环境变量

| 变量 | 说明 |
|------|------|
| `DATAWISE_API_URL` | 后端根地址，默认 `http://localhost:18421` |
| `DATAWISE_SESSION_ID` | 浏览器会话 ID（请求头 `X-Session-Id`） |
| `DATAWISE_API_TOKEN` | API Token（`Authorization: Bearer …`，可替代会话） |

---

## 安装与运行

```bash
cd datawise-mcp
npm install
npm run build
npm start
# 开发：npm run dev
```

---

## Cursor 配置示例

```json
{
  "mcpServers": {
    "datawise": {
      "command": "node",
      "args": ["E:/path/to/datawise-cli/datawise-mcp/dist/index.js"],
      "env": {
        "DATAWISE_API_URL": "http://localhost:18421",
        "DATAWISE_SESSION_ID": "your-session-id"
      }
    }
  }
}
```

将路径换成你的本机绝对路径；生产环境更推荐使用 `DATAWISE_API_TOKEN`。

---

## 工具一览

| 工具 | 作用 |
|------|------|
| `list_connections` | 列出当前可见连接 |
| `list_tables` | 浏览库表 |
| `review_sql` | 执行前安全审查 |
| `execute_readonly_sql` | 仅 SELECT，经 DataWise 闸门执行 |
| `compare_schema` | 环境间 Schema 差异 |
| `list_semantic_metrics` | 语义指标目录 |
| `rerun_canvas` | 参数化重跑已保存分析画布 |
| `generate_federated_sql` | 自然语言 → 跨源联邦 SQL |

写操作与治理边界见 [../docs/GOVERNANCE.md](../docs/GOVERNANCE.md)。

---

## 相关

- 后端：[../datawise-backend/README.md](../datawise-backend/README.md)
- 使用说明书 · 桌面与生态：[../docs/user-manual/12-desktop-ecosystem.md](../docs/user-manual/12-desktop-ecosystem.md)
