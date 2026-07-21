# Deprecated config path migration

Older DataWise layouts stored tenant data at the config root (`connections.xml`, `teams.json`, `oidc.json`, …) and user workspace files directly under `users/{id}/`. Current layouts are tenant-scoped:

| Legacy | Target |
|--------|--------|
| `connections.xml` | `tenants/default/connections.xml` |
| `teams.json` | `tenants/default/teams.json` |
| `oidc.json` | `tenants/default/oidc.json` |
| `sql-snippets.shared.xml` | `tenants/default/sql-snippets.shared.xml` |
| `users/{id}/federated-views.json` (and siblings) | `users/{id}/tenants/default/…` |
| `users/{id}/table-data-audit/*.json` | `users/{id}/tenants/default/table-data-audit/*.json` |

Lazy reads still migrate individual files on first access. Use the bulk tool when upgrading a long-lived config directory.

## Backup & rollback

- Each migrated legacy file is renamed to `{name}.migrated` (not deleted).
- Target files are copied with attributes; if the target already exists, the legacy file is left untouched.
- Rollback: stop the server, move `{name}.migrated` back to `{name}`, and remove the unwanted tenant-scoped copy if needed.

## CLI

```bash
cd headless-cli
npm run build   # if needed
# Dry-run / status
npx datawise config migrate --dry-run --server http://127.0.0.1:18421 --token "$DATAWISE_API_TOKEN"
# Apply
npx datawise config migrate --server http://127.0.0.1:18421 --token "$DATAWISE_API_TOKEN"
```

Requires a registered-user API token (same as other headless commands).

## HTTP API

| Method | Path | Purpose |
|--------|------|---------|
| `GET` | `/api/system/config-migration` | Pending item count + paths（注册用户） |
| `POST` | `/api/system/config-migration/apply` | Apply pending migrations（会话需租户管理员；API Token 需 `migration` scope） |

## Startup

On boot, if any legacy paths remain, the server logs:

`CONFIG_LEGACY_PATHS_PENDING count=N — run datawise config migrate …`

Settings → System metrics shows the same pending count for operators.
