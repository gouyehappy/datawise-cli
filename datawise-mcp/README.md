# DataWise MCP Server

Expose DataWise connections, schema browsing, SQL review, and read-only query execution to Cursor / Claude Desktop via MCP.

## Prerequisites

- DataWise backend running (`http://localhost:18421` by default)
- Valid session or API token with SQL scope

## Environment

| Variable | Description |
|----------|-------------|
| `DATAWISE_API_URL` | Backend base URL (default `http://localhost:18421`) |
| `DATAWISE_SESSION_ID` | Browser session id (`X-Session-Id`) |
| `DATAWISE_API_TOKEN` | API token (alternative to session) |

## Install & run

```bash
cd datawise-mcp
npm install
npm run build
npm start
```

## Cursor configuration

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

## Tools

- `list_connections` — visible connections
- `list_tables` — schema tables
- `review_sql` — pre-execution safety review
- `execute_readonly_sql` — SELECT-only via DataWise gate
- `compare_schema` — drift between environments
