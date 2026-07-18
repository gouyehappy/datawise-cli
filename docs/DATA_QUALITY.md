# Data quality rules & release gate

DataWise models data-quality checks as scheduled tasks of type `data_quality` (read-only SQL + assertion). The **Data quality** explorer entry is a scoped catalog over those rules; the **release gate** API runs a blocking suite for CI / deploy hooks.

## Rule payload

```json
{
  "connectionId": "conn-1",
  "database": "app",
  "sql": "SELECT id FROM orders WHERE amount < 0",
  "assertion": "empty_result",
  "expected": "0",
  "column": null,
  "blocking": true
}
```

| Field | Notes |
|-------|--------|
| `sql` | Read-only `SELECT` only (write SQL rejected) |
| `assertion` | `empty_result` · `row_count_eq` · `row_count_lte` · `scalar_eq` · `scalar_lte` |
| `expected` | Required for row-count / scalar assertions |
| `column` | Optional for scalar assertions (default: first column) |
| `blocking` | When `true`, included in the default release-gate suite |

Cron may be **blank** for gate-only / manual rules (they never fire on the scheduler).

## Rule templates

When creating a rule (Explorer → AI → **Data quality** → Add), pick a built-in **Template** to prefill name, SQL, assertion, expected, and blocking. Replace `{table}` / `{column}` before saving.

| Id | Assertion | Blocking (default) |
|----|-----------|--------------------|
| `no_violations` | empty_result | yes |
| `no_duplicates` | empty_result | yes |
| `no_nulls` | empty_result | yes |
| `max_violation_rows` | row_count_lte | yes |
| `failed_count_threshold` | scalar_lte | no |

Templates include five **built-in** presets, a **user-saved library** (localStorage, per registered user), and **tenant-shared templates** stored on the server (`tenants/{tenantId}/data-quality-templates.json`). From the Add form: pick a template to prefill, **Save as local template** / **Save as shared template**, or delete when a local/shared entry is selected.

### Shared template APIs

```http
GET    /api/platform/data-quality/templates
PUT    /api/platform/data-quality/templates
DELETE /api/platform/data-quality/templates/{id}
```

`PUT` body:

```json
{
  "id": null,
  "name": "No negatives",
  "description": "",
  "sql": "SELECT id FROM {table} WHERE amount < 0",
  "assertion": "empty_result",
  "expected": "0",
  "column": null,
  "blocking": true,
  "cronExpression": null
}
```

Omit `id` to create; include `id` to update. Requires a registered user session.

## Catalog UI

Explorer → AI → **Data quality** opens the catalog for the current connection/database. Actions:

- **Add** — create a rule (optional Cron, optional blocking)
- **Run** — run the selected rule now
- **Run release gate** — evaluate the gate suite (selection = those IDs; otherwise all **blocking** rules in scope)

Rules also appear under **Scheduled tasks** when they have a Cron.

## APIs

```http
GET /api/platform/data-quality/rules?connectionId=&database=
POST /api/platform/data-quality/gate
Content-Type: application/json

{
  "ruleIds": ["optional", "ids"],
  "connectionId": "conn-1",
  "database": "app",
  "blockingOnly": true
}
```

Response always HTTP 200 with body:

```json
{
  "passed": false,
  "total": 2,
  "failed": 1,
  "results": [
    {
      "ruleId": "task-…",
      "name": "No negatives",
      "blocking": true,
      "status": "failed",
      "message": "DQ_ASSERTION_FAILED: …",
      "ranAt": "…"
    }
  ]
}
```

Defaults when `ruleIds` is empty: `blockingOnly=true` (only rules with `"blocking": true`). Pass explicit `ruleIds` to run a custom suite regardless of blocking.

Each rule still updates last-run status and emits `data_quality.ok|failed` / `scheduled_task.*` webhooks.

## Multi-env gate

Optional second scope compares **primary** vs **reference** environments in one call:

```json
{
  "connectionId": "conn-prod",
  "database": "app",
  "blockingOnly": true,
  "referenceConnectionId": "conn-staging",
  "referenceDatabase": "app"
}
```

| Field | Notes |
|-------|--------|
| `referenceConnectionId` | Required for multi-env; must differ from primary when databases match |
| `referenceDatabase` | Optional; defaults to primary `database` |
| `ruleIds` | Applied only to the **primary** scope; reference pairing uses primary result names |
| `pairByName` | Default **true** for multi-env: reference runs same-name rules; unpaired primary names fail the reference scope. Set `false` to run the reference **blocking** suite independently |

Response adds `scopes[]` (primary then reference) and, when pairing is on, `pairs[]` (`name`, `primaryRuleId`, `referenceRuleId`, `paired`). Aggregate `passed` requires both scopes to pass; `total`/`failed` are sums. `results` remains the primary-scope runs for backward compatibility.

UI: Data quality catalog → **Run multi-env gate** (pick a reference connection by env badge; **Pair rules by name** is on by default).

## CI example

```bash
curl -sS -X POST "$DATAWISE_URL/api/platform/data-quality/gate" \
  -H "Authorization: Bearer $DATAWISE_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"connectionId":"prod","database":"app","blockingOnly":true}' \
  | jq -e '.data.passed == true'
```

## Related

- Outbound events: `data_quality.ok` / `data_quality.failed` (Settings → Integrations)
- Orchestration inbound trigger: [ORCHESTRATION.md](./ORCHESTRATION.md)
