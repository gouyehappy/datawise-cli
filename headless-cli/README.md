# DataWise Headless CLI

面向 CI 与自动化的命令行客户端 — 对运行中的 DataWise 后端发起迁移、SQL 执行与 Query Library 流水线。

包名 `@datawise/headless-cli` · 版本 **1.3.0** · 命令 **`datawise`**

---

## 安装

```bash
cd headless-cli
npm install
npm run build
```

开发调试：`npm run dev -- <command> …`

---

## 鉴权

在后端配置 API Token（见 `datawise-frontend/resources/bundle-config/api-tokens.example.json`，复制为运行时 `config/api-tokens.json`）。

| Scope | 用途 |
|-------|------|
| `migration` | `POST /api/migration/batch` |
| `sql` | `POST /api/sql/execute` |

**全局选项 / 环境变量**

| 选项 | 环境变量 | 默认 |
|------|----------|------|
| `--server` | `DATAWISE_SERVER` | `http://localhost:18421` |
| `--token` | `DATAWISE_API_TOKEN` | （必填，除本地校验类命令外） |

任意命令可加 `--json` 输出机器可读结果。

---

## 命令

### `migrate run`

跨连接批量迁表：

```bash
datawise --token "$DATAWISE_API_TOKEN" migrate run \
  --source conn-src --source-db shop \
  --target conn-dst --target-db shop \
  --tables users,orders \
  --truncate
```

`overallStatus === success` 时退出码 `0`，否则 `1`。

### `sql exec`

执行 SQL 文件：

```bash
datawise --token "$DATAWISE_API_TOKEN" sql exec \
  --connection conn-1 \
  --database shop \
  -f ./scripts/seed.sql
```

### `query-library validate`

校验 Git 托管的 `query-library.json` 与引用的 `.sql`（**无需后端**）：

```bash
datawise query-library validate -m ../examples/query-library/query-library.json
datawise query-library validate -m ./query-library/query-library.json --strict
```

### `query-library run`

按清单执行开启了 CI 的查询（需后端 + `sql` scope）：

```bash
datawise --token "$DATAWISE_API_TOKEN" query-library run \
  -m ./query-library/query-library.json

# 只跑一条
datawise --token "$DATAWISE_API_TOKEN" query-library run \
  -m ./query-library/query-library.json --id health-check
```

`run` 始终按 `--strict` 语义先校验。示例见 [../examples/query-library/README.md](../examples/query-library/README.md)。

### `config migrate`

将旧版配置路径迁到租户作用域布局：

```bash
datawise config migrate --dry-run
datawise config migrate
```

说明：[../docs/CONFIG_MIGRATION.md](../docs/CONFIG_MIGRATION.md)

---

## 开发

```bash
npm run typecheck
npm run test
npm run dev -- migrate run --help
```

---

## 相关

- 治理入口：[../docs/GOVERNANCE.md](../docs/GOVERNANCE.md)
- 后端 API：[../datawise-backend/README.md](../datawise-backend/README.md)
