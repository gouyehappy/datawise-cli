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
```

Returns a page object:

| Field | Notes |
|-------|--------|
| `hits` | `DiscoveryHit[]` for this page |
| `total` | Full match count before paging |
| `offset` / `limit` | Requested window (`limit` default 40, max 100) |
| `hasMore` | `offset + hits.length < total` |

Each hit:

| Field | Notes |
|-------|--------|
| `kind` | `table` · `view` · `metric` |
| `connectionId` / `database` | Scope for open / lineage |
| `owner` | Optional metric owner |
| `relatedTables` | Metric-only: related physical tables (used for lineage jump) |
| `score` | Ranking hint (browse mode uses a flat score) |

Empty / blank `q` **browses** the org catalog (schema-cache tables/views + semantic metrics), sorted by qualified name. Non-empty `q` ranks by token match. The data catalog tab loads pages of 40 and offers **Load more** until `hasMore` is false (hidden while client-side facets are active). The command palette still requests a single small page.

## Faceted browse

After a search returns hits, the **Data catalog** tab shows client-side facet chips:

| Facet | Source |
|-------|--------|
| Kind | `table` / `view` / `metric` |
| Connection | Distinct `connectionId` (+ label) |
| Owner | Non-empty metric `owner` values |

Selections within a facet are OR’d; facet groups are AND’d. Clearing filters restores the full loaded hit set. Facets apply to **loaded** pages only; use Load more before filtering a large catalog when needed.

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

## Still open

- Column-level catalog cards
- Deeper metric → defining SQL / model lineage (beyond related physical tables)
- Tag facets (no tag field on discovery hits yet)
- Server-side facet filters (facets today apply to loaded pages only)
