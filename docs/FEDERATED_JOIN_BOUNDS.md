# Federated JOIN bounds

Cross-source federated views run each `@alias` subquery on its connection, then join in the **application** (not in a warehouse engine). Keep result sets small; push filters into each source subquery whenever possible.

## Limits (server)

| Bound | Default | Hard cap | Behavior |
|-------|---------|----------|----------|
| `maxRows` (request) | 1 000 | 10 000 | Applied per source fetch **and** to joined output |
| `offset` (request) | 0 | 100 000 | Source-window skip per `@alias` subquery (`LIMIT maxRows OFFSET offset`) |
| Cross JOIN (no `ON`) | — | 2 000 000 left×right pairs | Rejected with a clear error |
| Equality `ON` | — | — | Hash join; output still capped at `maxRows` |
| Hash build memory | 512 rows | — | Build side above this spills to temp files (Grace hash, 32 buckets) |

Constants live in `FederatedJoinLimits` (`datawise-database`).

## Predicate pushdown (outer WHERE)

When the federated SQL has an outer `WHERE`:

1. Conjuncts that reference **one** table alias only (`o.status = 'active'`, including single-alias **`OR`**, **`IN` / `NOT IN`**, **`IS [NOT] NULL`**, **`[NOT] LIKE`**, **`[NOT] BETWEEN`**, residual expression functions below, and bare **`NOT`**) are rewritten into that source subquery (`SqlTransformOps.appendWhere`), stripping the alias prefix.
2. Cross-alias conjuncts (`o.user_id = u.id`) stay as a **residual** filter applied in memory after the join (simple comparisons: `= != <> < <= > >=`, plus `IN` / `NOT IN` with literal lists, plus `IS [NOT] NULL`, plus `[NOT] LIKE` with a string-literal pattern (`%` / `_`, optional **`ESCAPE 'x'`**), plus inclusive **`[NOT] BETWEEN low AND high`**, plus residual expression functions on either side, plus bare `NOT` over those atoms / groups).
3. Residual filters also support **top-level OR** (and parenthesized OR groups) of those atoms. Mixed-alias OR is **not** pushed into source SQL (stays residual). Top-level `AND` splitting leaves `BETWEEN … AND …` bounds intact.

### Residual expression functions (closed catalog)

| Function / op | Notes |
|---------------|--------|
| `UPPER` / `LOWER` / `TRIM` / `LTRIM` / `RTRIM` | Unary string; `TRIM` is whitespace-both only (no `BOTH/LEADING FROM`) |
| `LENGTH` / `CHAR_LENGTH` | Character length → number |
| `ABS` | Numeric absolute value |
| `COALESCE(a, b, …)` | First non-null (≥2 args) |
| `NULLIF(a, b)` | Null when equal |
| `CONCAT(a, …)` / `\|\|` | Null args treated as empty string |
| `SUBSTR` / `SUBSTRING(expr, start[, length])` | 1-based start; `start < 1` clamps to 1 |

Nesting is supported (`LENGTH(TRIM(COALESCE(o.name, '')))`). Unknown function names fail with a clear error.

4. Unsupported residual forms (`TRIM(BOTH FROM …)`, `SUBSTRING … FROM … FOR …`, column refs inside `IN` lists, nested boolean beyond AND of OR-groups / NOT) fail with a clear error — push those filters into the source subqueries instead.

Parser also peels trailing `WHERE` / `GROUP BY` / `ORDER BY` / `HAVING` / `LIMIT` off the JOIN chain so `ON` is not polluted by outer clauses.

## Disk spill (Grace hash)

For equality JOINs, DataWise picks the smaller side as the hash **build** side. If that side has more than `MEMORY_HASH_BUILD_ROWS` (512) rows:

1. Build rows are partitioned into 32 temp bucket files under the JVM temp directory.
2. Each bucket is loaded one at a time; probe rows that hash to the same bucket are matched in memory.
3. Temp files are deleted when the join finishes (including on truncation / error).

Probe rows stay in memory (already capped by `maxRows` / hard cap). Spill reduces peak heap for large build sides; it does **not** raise the 10 000-row hard cap.

## Truncation signal

The SQL console result grid shows a **truncation hint** when `hasMore` is true but there is **no** `cursorId` (federated JOIN cannot page the join output like a cursor). Prefer tighter `WHERE` / source filters, **raise request `maxRows`** up to the hard cap, or **batch over source windows** with `offset`.

When truncated below the hard cap, the grid shows **Raise limit and re-run** (SQL console re-executes the active statement with the next step: 1 000 → 5 000 → 10 000). Platform catalog → Federated Views → Execute uses the same steps and offers **Retry at {limit}** after a truncated run.

### Source-window batching (`offset`)

`ExecuteFederatedViewRequest.offset` (default `0`, capped at 100 000) advances each `@alias` source subquery by one window: `LIMIT maxRows OFFSET offset` (dialect-aware via connection dbType). This is **not** pagination of the joined result — each batch re-fetches the next slice of every source and re-runs the in-memory JOIN. Use **Next batch** in the platform catalog when `hasMore` is true; reset `offset` to `0` on a normal Execute.

When a source hits `maxRows` or the join stops early at the output cap, `ExecuteSqlResult.hasMore` is `true`, `pageSize` carries the effective `maxRows`, and `pageOffset` carries the request offset. The UI should treat this as a partial result, not a full join.

## Practical guidance

1. Prefer `ON alias.col = other.col` (equality + `AND` only).
2. Prefer outer `WHERE alias.col = …` (or single-alias `OR` / `IS NULL` / `LIKE`) for single-source filters (auto-pushed) or put filters inside each `(subquery) @alias`.
3. Do not rely on federated JOIN for large fact×fact merges — use a warehouse, ETL, or same-connection SQL instead.

## Related code

- `FederatedQueryService` / `FederatedJoinExecutor` / `FederatedJoinPredicatePushdown` / `FederatedJoinSpillSupport`
- Platform catalog → Federated Views → Execute
- Wizard copy: `platform.federated.boundsHint`
