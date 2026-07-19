# Org data catalog & discovery

DataWise indexes **schema-cache tables/views** and **semantic metrics** for org-wide search.
The command palette already merges discovery hits; this page is the dedicated **Data catalog** UI
with open + lineage jump.

## Open the catalog

- Command palette → **Open data catalog** (`action:data-catalog`)
- Or call `workspace.openDataCatalog()` (opens a single reusable `data_catalog` workspace tab)

Requires `workbench.explorer.search` + `workbench.tab.new`.

## Search API

```http
GET /api/discovery/search?q=orders&limit=40&offset=0
GET /api/discovery/search?limit=40&offset=40
GET /api/discovery/search?tag=pii&kind=table&owner=alice&connectionId=conn-1
```

Optional facet filters (comma-separated or repeated query params):

| Param | Notes |
|-------|--------|
| `kind` | `table` · `view` · `metric` |
| `connectionId` | Connection id |
| `owner` | Metric owner (case-insensitive) |
| `tag` | Metric tags or table/view comment hashtags (`#pii` → `pii`) |

Returns a page object:

| Field | Notes |
|-------|--------|
| `hits` | `DiscoveryHit[]` for this page (after facet filters) |
| `total` | Match count after facet filters, before paging |
| `offset` / `limit` | Requested window (`limit` default 40, max 100) |
| `hasMore` | `offset + hits.length < total` |
| `facets` | Server facet buckets (`kinds` / `connections` / `owners` / `tags`) |

Each hit:

| Field | Notes |
|-------|--------|
| `kind` | `table` · `view` · `metric` |
| `connectionId` / `database` | Scope for open / lineage |
| `owner` | Optional metric owner |
| `tags` | Metric tags and/or hashtags parsed from table/view comments |
| `relatedTables` | Metric-only: related physical tables (used for lineage jump) |
| `columns` | Table/view-only: up to 40 column names (+ types when schema-cache columns folder is hydrated) |
| `score` | Ranking hint (browse mode uses a flat score) |

Empty / blank `q` **browses** the org catalog (schema-cache tables/views + semantic metrics), sorted by qualified name. Non-empty `q` ranks by token match (including tags). The data catalog tab loads pages of 40 and offers **Load more** until `hasMore` is false — including while server facets are active. The command palette still requests a single small page.

## Faceted browse

The **Data catalog** tab uses **server-side** facet chips. Facet options and counts come from the search response (`facets`); each dimension’s counts are computed from hits that match the other selected filters. Selections within a facet are OR’d; facet groups are AND’d.

| Facet | Source |
|-------|--------|
| Kind | `table` / `view` / `metric` |
| Connection | Distinct `connectionId` (+ label) |
| Owner | Non-empty metric `owner` values |
| Tag | Metric `tags` + hashtags in table/view comments (`#pii`) |

Metric tags are edited on the semantic metric form (comma-separated). Table/view tags are taken from hashtags in the schema-cache comment text.

## Lineage jump

For a selected **table** or **view**:

1. `GET /api/lineage/view-models/impact` with `connectionId`, `instanceName` (= database), `name`
2. If exactly one downstream view model (or an exact name match) → open `view_model_lineage` tab
3. If several → pick dialog
4. If none → warning toast

For a selected **metric** with non-empty `relatedTables`:

1. If **more than one** distinct related table → pick-table dialog first
2. Use the metric’s `connectionId` / `database` and the chosen (or only) related table name (qualified prefixes matching the database are stripped)
3. Same impact → lineage flow as tables/views
4. If `relatedTables` is empty → warning toast (configure related tables on the metric)

**Open** reuses the same activation path as global object search (locate tree + table tab, or semantic metrics catalog for metrics).

## Column peek

When a **table** or **view** row is selected in the Data catalog tab, a side panel lists up to **40 columns** (name + type when available). Columns come from:

1. The Explorer tree in memory (if that table’s columns folder was loaded in this session), else
2. The discovery hit `columns` field (from persisted schema cache when the columns folder was previously hydrated).

No live JDBC is issued for the peek. If neither source has columns, the panel shows an empty state (expand the table in Explorer or refresh schema cache).

## Still open

- Deeper metric → defining SQL / model lineage (beyond related physical tables)
