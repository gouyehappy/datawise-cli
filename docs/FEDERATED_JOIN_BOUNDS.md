# Federated JOIN bounds

Cross-source federated views run each `@alias` subquery on its connection, then join in the **application** (not in a warehouse engine). Keep result sets small; push filters into each source subquery whenever possible.

## Limits (server)

| Bound | Default | Hard cap | Behavior |
|-------|---------|----------|----------|
| `maxRows` (request) | 1 000 | 10 000 | Applied per source fetch **and** to joined output |
| Cross JOIN (no `ON`) | — | 2 000 000 left×right pairs | Rejected with a clear error |
| Equality `ON` | — | — | Hash join; output still capped at `maxRows` |
| Hash build memory | 512 rows | — | Build side above this spills to temp files (Grace hash, 32 buckets) |

Constants live in `FederatedJoinLimits` (`datawise-database`).

## Predicate pushdown (outer WHERE)

When the federated SQL has an outer `WHERE`:

1. Conjuncts that reference **one** table alias only (`o.status = 'active'`, including single-alias **`OR`**, **`IN` / `NOT IN`**, **`IS [NOT] NULL`**, **`[NOT] LIKE`**, **`UPPER` / `LOWER`**, and bare **`NOT`**) are rewritten into that source subquery (`SqlTransformOps.appendWhere`), stripping the alias prefix.
2. Cross-alias conjuncts (`o.user_id = u.id`) stay as a **residual** filter applied in memory after the join (simple comparisons: `= != <> < <= > >=`, plus `IN` / `NOT IN` with literal lists, plus `IS [NOT] NULL`, plus `[NOT] LIKE` with a string-literal pattern (`%` / `_`), plus unary **`UPPER(expr)` / `LOWER(expr)`** on either side of a comparison or LIKE, plus bare `NOT` over those atoms / groups).
3. Residual filters also support **top-level OR** (and parenthesized OR groups) of those atoms, e.g. `UPPER(o.status) = 'ACTIVE' OR LOWER(u.region) = 'cn'`. Mixed-alias OR is **not** pushed into source SQL (stays residual).
4. Unsupported residual forms (other SQL functions, column refs inside `IN` lists, nested boolean beyond AND of OR-groups / NOT) fail with a clear error — push those filters into the source subqueries instead.

Parser also peels trailing `WHERE` / `GROUP BY` / `ORDER BY` / `HAVING` / `LIMIT` off the JOIN chain so `ON` is not polluted by outer clauses.

## Disk spill (Grace hash)

For equality JOINs, DataWise picks the smaller side as the hash **build** side. If that side has more than `MEMORY_HASH_BUILD_ROWS` (512) rows:

1. Build rows are partitioned into 32 temp bucket files under the JVM temp directory.
2. Each bucket is loaded one at a time; probe rows that hash to the same bucket are matched in memory.
3. Temp files are deleted when the join finishes (including on truncation / error).

Probe rows stay in memory (already capped by `maxRows` / hard cap). Spill reduces peak heap for large build sides; it does **not** raise the 10 000-row hard cap.

## Truncation signal

When a source hits `maxRows` or the join stops early at the output cap, `ExecuteSqlResult.hasMore` is `true` and `pageSize` carries the effective `maxRows`. The UI should treat this as a partial result, not a full join.

## Practical guidance

1. Prefer `ON alias.col = other.col` (equality + `AND` only).
2. Prefer outer `WHERE alias.col = …` (or single-alias `OR` / `IS NULL` / `LIKE`) for single-source filters (auto-pushed) or put filters inside each `(subquery) @alias`.
3. Do not rely on federated JOIN for large fact×fact merges — use a warehouse, ETL, or same-connection SQL instead.

## Related code

- `FederatedQueryService` / `FederatedJoinExecutor` / `FederatedJoinPredicatePushdown` / `FederatedJoinSpillSupport`
- Platform catalog → Federated Views → Execute
- Wizard copy: `platform.federated.boundsHint`
