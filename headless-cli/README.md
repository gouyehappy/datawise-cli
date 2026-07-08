# DataWise Headless CLI

Command-line client for CI and automation against a running DataWise backend.

## Setup

```bash
cd headless-cli
npm install
npm run build
```

Configure API tokens in `config/api-tokens.json` on the backend (see `datawise-frontend/resources/bundle-config/api-tokens.example.json`).

| Scope | Endpoint |
|-------|----------|
| `migration` | `POST /api/migration/batch` |
| `sql` | `POST /api/sql/execute` |

## Usage

Global options (or env vars):

- `--server` / `DATAWISE_SERVER` — default `http://localhost:18421`
- `--token` / `DATAWISE_API_TOKEN` — required

### migrate run

```bash
datawise --token "$DATAWISE_API_TOKEN" migrate run \
  --source conn-src --source-db shop \
  --target conn-dst --target-db shop \
  --tables users,orders \
  --truncate
```

Exit code `0` when `overallStatus` is `success`, otherwise `1`.

### sql exec -f

```bash
datawise --token "$DATAWISE_API_TOKEN" sql exec \
  --connection conn-1 \
  --database shop \
  -f ./scripts/seed.sql
```

Add `--json` on either command for machine-readable output.

### query-library validate

Validate a Git-managed `query-library.json` and referenced SQL files (no server required):

```bash
datawise query-library validate -m ./examples/query-library/query-library.json
datawise query-library validate -m ./query-library/query-library.json --strict
```

### query-library run

Execute CI-enabled queries from the manifest:

```bash
datawise --token "$DATAWISE_API_TOKEN" query-library run \
  -m ./query-library/query-library.json
```

Optional: `--id health-check` to run one query. `run` always validates with `--strict` semantics. See `examples/query-library/README.md`.

## Development

```bash
npm run dev -- migrate run --help
npm run test
npm run typecheck
```
