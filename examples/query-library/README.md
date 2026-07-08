# Query Library (Git + CI)

Store team SQL bookmarks in Git and validate or execute them in CI with the DataWise headless CLI.

## Layout

```text
query-library/
  query-library.json
  queries/
    health-check.sql
```

`query-library.json` references SQL files by relative path. Each query needs a stable `id`, human-readable `name`, and DataWise `connection` id for CI runs.

## Validate (no server)

```bash
cd headless-cli
npm install
npm run build
node dist/main.js query-library validate -m ../examples/query-library/query-library.json
node dist/main.js query-library validate -m ../examples/query-library/query-library.json --strict
```

## Run in CI

Requires a running DataWise backend and API token with `sql` scope.

```bash
export DATAWISE_API_TOKEN=...
export DATAWISE_SERVER=https://datawise.example.com

datawise query-library run -m ./query-library/query-library.json
```

Run a single query:

```bash
datawise query-library run -m ./query-library/query-library.json --id health-check
```

## Manifest fields

| Field | Required | Description |
|-------|----------|-------------|
| `id` | yes | Stable slug used in CI (`--id`) |
| `name` | yes | Display name |
| `file` | yes | Path to `.sql` file relative to manifest |
| `connection` | yes for run | DataWise connection id |
| `connectionName` | no | Human label (export hint only) |
| `database` | no | Database / schema |
| `tags` | no | Free-form tags |
| `ci.enabled` | no | Default `true`; set `false` to skip in `run` |
| `ci.maxRows` | no | Passed to SQL execute API |
| `ci.expectMinRows` | no | Fail when result row count is lower |
| `ci.expectMaxRows` | no | Fail when result row count is higher |

## Export from DataWise UI

In **Query bookmarks**, use **Export for Git CI** on a saved console bookmark. It downloads:

- `queries/<id>.sql`
- `query-library.json` starter manifest

Replace `connection` with your staging connection id before enabling CI run.
