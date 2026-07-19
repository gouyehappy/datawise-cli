# Lakehouse lineage dialects

View-model / SQL lineage for Hive, Spark, Flink, Trino, and Presto.

## Routing

| Priority | Engine | Dialects |
|----------|--------|----------|
| 40 | `lakehouse` (`LakehouseLineageParser`) | hive, spark, flink, kylin, impala, trino, presto |
| 50 | `sqlflow-ast` | all (fallback) |
| 100 | `jsqlparser` | RDBMS families |
| 60 (opt-in) | `calcite` | same OLAP set when `lineage.calcite.enabled=true` (stub; still FAILED → fallback) |

## Behavior

1. **Hard features** (`LATERAL VIEW`, `MATCH_RECOGNIZE`, Flink `TUMBLE`/`HOP`/`CUMULATE`/`SESSION` TVFs, Trino/Presto `UNNEST … WITH ORDINALITY`, **`TRY_CAST`**, **`GROUPING SETS` / `CUBE` / `ROLLUP`**, **`QUALIFY`**, **`PIVOT` / `UNPIVOT`**):
   - First **soften** when possible (strip `LATERAL VIEW`, unwrap `TABLE(TUMBLE(TABLE t, …))` → `t`, strip `MATCH_RECOGNIZE (…)`, strip `WITH ORDINALITY`, rewrite `TRY_CAST(` → `CAST(`, rewrite advanced grouping to a simple `GROUP BY` arg list, strip `QUALIFY …`, strip `PIVOT`/`UNPIVOT (…) [AS alias]`), then run the AST engine → status `PARTIAL` with column lineage when parse succeeds (`LAKEHOUSE_SOFTENED`).
   - If soften + AST cannot produce columns → **table-level** fallback: synthetic output `_table_deps` with source column `*` per FROM/JOIN / inner TVF table (`LAKEHOUSE_TABLE_LEVEL_ONLY`).
2. **Normalizable clauses** (`DISTRIBUTE BY` / `CLUSTER BY` / `SORT BY`, `INSERT OVERWRITE` → `INSERT INTO`, `INSERT … PARTITION (…)` strip, `TABLESAMPLE`) are stripped, then the AST engine analyzes the remaining SQL. Warning: `LAKEHOUSE_NORMALIZED`.
3. **Hive / Spark / Flink** successful SELECTs are reported as **`PARTIAL`** compatibility (`LAKEHOUSE_PARTIAL_COMPAT`).
4. **Trino / Presto** successful SELECTs stay **`COMPLETE` / `FULL`** (AST grammar is Presto/Trino-based), except when hard features above force `PARTIAL`.

## What is still out of scope

- Calcite semantic analysis for explode / window TVF column mappings (opt-in stub remains)
- dt-sql-parser Node sidecar
- Pushing lakehouse lineage into a warehouse engine

## Related

- Design: [VIEW_MODEL_LINEAGE_DESIGN.md](./VIEW_MODEL_LINEAGE_DESIGN.md) §3.4
- Code: `LakehouseSqlSupport`, `LakehouseLineageParser`
