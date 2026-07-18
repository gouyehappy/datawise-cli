# Changelog

All notable product-level changes for DataWise are documented in this file.

## Unreleased — Tenancy Phase 0–3 (RBAC + dual-mode + JDBC metadata)

### Highlights
- Dual-mode tenancy scaffold (`datawise.tenancy.mode=single` default): bootstrap `default` tenant, system roles, and user memberships.
- Admin detection prefers `tenant_admin` role; effective permissions are **role-first** (membership role union ignores per-user feature map; no role + map → custom; else → readonly). Guest and `tenant_admin` keep special cases.
- Settings → User permissions: assign tenant roles by default (matrix is read-only preview); custom permissions and roles are mutually exclusive on write.
- Session / `UserContext` / API tokens carry `tenantId`; connections, groups, and teams are tagged and filtered by tenant.
- Config layout: `connections.xml` / `teams.json` / `oidc.json` migrate into `tenants/default/` (legacy kept as `*.migrated`).
- Outbound webhooks are tenant-scoped (`tenants/{id}/outbound-webhooks.json`); admin CRUD; legacy per-user files merge on first access.
- Team audit logs carry `tenantId`; SQL/terminal audit only fans out to teams in the current tenant.
- Phase 2 (opt-in `mode=multi`): platform-admin whitelist, tenant create/suspend/soft-delete, member invite, `POST /api/auth/switch-tenant`, profile org switcher.
- OIDC claim → tenant mapping (`tenantClaim` / `tenantClaimMap`) with optional auto-membership; migration concurrency slots keyed by product tenant; connection hard-cap quota.
- Optional public registration (`allow-registration`) with login UI toggle; optional self-serve org create when `allow-tenant-create` is on.
- Optional per-tenant daily AI call cap (`max-ai-calls-per-tenant-per-day`) enforced on AI chat/analyze/SQL endpoints.
- True path isolation: teams / connections / OIDC read-write under `tenants/{tenantId}/` keyed by session tenant (not only in-memory filters).
- Personal workspace files (AI knowledge, semantic metrics, scheduled tasks, etc.) live under `users/{id}/tenants/{tenantId}/` (legacy flat files migrate into `default`); `app.xml` stays user-global.
- Schema cache disk path includes tenant; memory schema cache cleared on tenant switch.
- Saved consoles / SQL history filtered and stamped by `tenantId`.
- Optional identity metadata JDBC backend (`datawise.storage.backend=jdbc`) with Flyway schema + one-shot file import; desktop default remains `file`.
- JDBC team / connection / OIDC / webhook / AI usage / SQL history snapshots when `storage.backend=jdbc`.
- Settings → Tenants panel for platform admins in multi mode; member invite/role UI; custom tenant roles.
- Team APIs reject cross-tenant IDs (IDOR guard).
- Wave C spillover MVP: tenant AI usage card (`GET /api/tenants/mine/ai-usage`); scheduled SQL/canvas `digest` → `insight.digest` webhook; Dashboard chart read-only share links (`/share/{token}`).
- Wave B S1 slice: table migration mode `PK_UPSERT` with conflict strategies OVERWRITE / SKIP / FAIL (MySQL `ON DUPLICATE KEY` / PostgreSQL `ON CONFLICT`); production-target migration plans go through team approval (approve records consent; managers run the wizard).
- Wave B S2 slice: federated JOIN hard caps (`FederatedJoinLimits`), hash join for equality ON, cross-product rejection, `hasMore` truncation; see [docs/FEDERATED_JOIN_BOUNDS.md](./docs/FEDERATED_JOIN_BOUNDS.md).
- Wave B S3 slice: lakehouse lineage front door (`LakehouseLineageParser`) — normalize stripable Hive clauses, honest PARTIAL for LATERAL VIEW / MATCH_RECOGNIZE / Flink window TVFs; see [docs/LAKEHOUSE_LINEAGE.md](./docs/LAKEHOUSE_LINEAGE.md).
- Wave C G6 slice: macOS Apple Silicon desktop packaging (`dist:desktop:mac`, electron-builder DMG/zip, host-aware `build.mjs`); see [docs/DESKTOP_MAC.md](./docs/DESKTOP_MAC.md). Unsigned / no CI release yet.
- Wave D S4 slice: Visual Query Builder field board (drag-in / reorder / remove SELECT columns) + Text-to-SQL side panel that opens AI with the prompt.
- Wave D S5 slice: ER diagram column edit — click/double-click field opens Alter Column wizard (DDL preview, execute, or open console for approval).
- Wave D S6 / G11 slice: connector plugin `manifest.json` (version + SHA-256 + optional downloadUrl); marketplace integrity badges; optional `require-manifest-integrity` load gate. See [config/plugins/README.md](./config/plugins/README.md).
- Wave D G5 slice: external secret references (`dwsecret:env:` / `dwsecret:file:`) + master-key source status (`GET /api/system/secrets`, Settings → Secrets). See [docs/SECRETS.md](./docs/SECRETS.md).
- Wave D G13 slice: org discovery — `GET /api/discovery/search` over schema cache tables/views + semantic metrics (name/desc/owner); command palette merges hits; metric `owner` field on semantic layer.
- Wave D G2 slice: OIDC directory sync — groups/role claim → tenant role map on login; optional deprovision (disable membership + revoke sessions) when mapped groups disappear.
- Wave D G15 slice: schedulable data-quality rules — scheduled task type `data_quality` with SQL assertions (`empty_result` / row count / scalar) and `data_quality.ok|failed` webhooks.
- Wave D G14 slice: orchestration bridge — scheduled task type `http_trigger` (outbound HTTP to Airflow/dbt/Flink) + `POST /api/platform/orchestration/trigger` inbound run + `orchestration.triggered|failed` webhooks; see [docs/ORCHESTRATION.md](./docs/ORCHESTRATION.md).
- Wave A G3 deepen: Feishu / DingTalk bot channels on outbound webhooks (`channel=feishu|dingtalk` with platform signing); generic JSON+HMAC remains default.
- Wave C G10 slice: Insight → ticket export — outbound `github_issue` / `gitlab_issue` channels + `POST /api/platform/insight-actions` (`insight.action`); see [docs/INSIGHT_ACTIONS.md](./docs/INSIGHT_ACTIONS.md).
- Wave B S1 deepen: PK row-diff preview — `POST /api/migration/row-diff` samples source rows and classifies insert/update/unchanged for `PK_UPSERT` (wizard preflight panel).
- Wave B S2 deepen: federated equality JOIN Grace hash spill — build side above 512 rows partitions to temp files; see [docs/FEDERATED_JOIN_BOUNDS.md](./docs/FEDERATED_JOIN_BOUNDS.md).
- Wave B S2 deepen: federated outer WHERE predicate pushdown — single-alias conjuncts into source SQL; cross-alias residuals filtered in memory; see [docs/FEDERATED_JOIN_BOUNDS.md](./docs/FEDERATED_JOIN_BOUNDS.md).
- Wave B S3 deepen: lakehouse hard-feature soften (LATERAL VIEW / window TVF / MATCH_RECOGNIZE) + table-level `_table_deps` fallback; INSERT PARTITION strip; see [docs/LAKEHOUSE_LINEAGE.md](./docs/LAKEHOUSE_LINEAGE.md).
- Wave D G5 deepen: HashiCorp Vault KV secret references — `dwsecret:vault:path#field` via `VAULT_ADDR`/`VAULT_TOKEN`; see [docs/SECRETS.md](./docs/SECRETS.md).
- Wave D G11 / S6 deepen: connector marketplace one-click install — admin `POST /api/datasources/market/install` downloads `downloadUrl` into `config/plugins` with SHA-256 verify (restart still required to load).
- Wave A G3 deepen: outbound `channel=email` — POST `{to,subject,text}` to an HTTP mail gateway (`mailto:` / address needs `DATAWISE_MAIL_WEBHOOK_URL`).
- Wave D G15 deepen: data-quality rules catalog (Explorer → AI → Data quality) + `blocking` flag + `POST /api/platform/data-quality/gate` release suite; gate-only rules may omit Cron. See [docs/DATA_QUALITY.md](./docs/DATA_QUALITY.md).
- Wave D G11 / S6 deepen: connector plugin hot-reload — `POST /api/datasources/plugins/reload` (admin); marketplace install auto-reloads so restart is usually unnecessary (Windows JAR lock may still require restart). See [docs/CONNECTOR_PLUGINS.md](./docs/CONNECTOR_PLUGINS.md).
- Wave D G14 deepen: orchestration DAG status write-back — `http_trigger` `statusUrl` / `statusUrlTemplate`, auto-poll after trigger, `POST /api/platform/orchestration/status`, scheduled-task catalog columns + UI action. See [docs/ORCHESTRATION.md](./docs/ORCHESTRATION.md).
- Wave D G13 deepen: unified **Data catalog** workspace tab (command palette) over `GET /api/discovery/search` + lineage jump via view-model impact for tables/views. See [docs/DISCOVERY.md](./docs/DISCOVERY.md).
- Wave D G15 deepen: built-in **data-quality rule templates** (no violations / duplicates / nulls / row-count cap / failed-count threshold) prefill the Add rule form. See [docs/DATA_QUALITY.md](./docs/DATA_QUALITY.md).
- Wave D G15 deepen: **multi-env release gate** — `referenceConnectionId` / `referenceDatabase` on `POST /api/platform/data-quality/gate` with per-scope `scopes[]`; catalog UI picker. See [docs/DATA_QUALITY.md](./docs/DATA_QUALITY.md).
- Wave B S2 deepen: federated residual WHERE supports **top-level / parenthesized OR** of simple comparisons across aliases (still not pushed into source SQL). See [docs/FEDERATED_JOIN_BOUNDS.md](./docs/FEDERATED_JOIN_BOUNDS.md).
- Wave B S2 deepen: federated residual WHERE supports **`IN` / `NOT IN`** with literal lists (combinable with OR). See [docs/FEDERATED_JOIN_BOUNDS.md](./docs/FEDERATED_JOIN_BOUNDS.md).
- Wave D G13 deepen: data catalog **faceted browse** chips (kind / connection / owner) over search hits. See [docs/DISCOVERY.md](./docs/DISCOVERY.md).
- Wave B S2 deepen: federated residual WHERE supports bare **`NOT`** over comparisons / IN / parenthesized OR groups. See [docs/FEDERATED_JOIN_BOUNDS.md](./docs/FEDERATED_JOIN_BOUNDS.md).
- Wave D G13 deepen: data catalog **browse without query** — empty `q` on `GET /api/discovery/search` lists cached tables/views/metrics; catalog tab loads on open. See [docs/DISCOVERY.md](./docs/DISCOVERY.md).
- Wave D G13 deepen: data catalog **metric lineage jump** via `relatedTables` → view-model impact (first related table). See [docs/DISCOVERY.md](./docs/DISCOVERY.md).
- Wave D G13 deepen: data catalog **related-table picker** when a metric lists several `relatedTables` before lineage jump. See [docs/DISCOVERY.md](./docs/DISCOVERY.md).
- Wave D G13 deepen: discovery **pagination** (`offset` + `hasMore` / total) + data catalog **Load more**. See [docs/DISCOVERY.md](./docs/DISCOVERY.md).
- Wave D G15 deepen: **user-saved data-quality rule templates** (local library + Save/Delete in Add form). See [docs/DATA_QUALITY.md](./docs/DATA_QUALITY.md).
- Wave D G15 deepen: multi-env gate **pair rules by name** (`pairByName`, default on) with unpaired failures + `pairs[]` in the response. See [docs/DATA_QUALITY.md](./docs/DATA_QUALITY.md).
- Wave D G15 deepen: **tenant-shared data-quality rule templates** (`GET/PUT/DELETE /api/platform/data-quality/templates`, file `tenants/{id}/data-quality-templates.json`) alongside local templates in the Add form. See [docs/DATA_QUALITY.md](./docs/DATA_QUALITY.md).
- Wave B S2 deepen: federated WHERE **single-alias OR** pushdown (documented + tested) and residual **`IS [NOT] NULL`**. See [docs/FEDERATED_JOIN_BOUNDS.md](./docs/FEDERATED_JOIN_BOUNDS.md).
- Wave B S2 deepen: federated residual / pushdown **`[NOT] LIKE`** with literal `%` / `_` patterns. See [docs/FEDERATED_JOIN_BOUNDS.md](./docs/FEDERATED_JOIN_BOUNDS.md).
- Wave B S2 deepen: federated residual / pushdown unary **`UPPER` / `LOWER`** on comparisons and LIKE. See [docs/FEDERATED_JOIN_BOUNDS.md](./docs/FEDERATED_JOIN_BOUNDS.md).
- Wave B S2 deepen: federated residual / pushdown **`[NOT] BETWEEN`** (inclusive; `AND` split keeps BETWEEN bounds). See [docs/FEDERATED_JOIN_BOUNDS.md](./docs/FEDERATED_JOIN_BOUNDS.md).
- Wave B S2 deepen: federated residual / pushdown **`TRIM` / `LTRIM` / `RTRIM`** (whitespace-both / leading / trailing). See [docs/FEDERATED_JOIN_BOUNDS.md](./docs/FEDERATED_JOIN_BOUNDS.md).
- Wave B S2 deepen: federated **`LIKE … ESCAPE`** (literal escape char for `%` / `_`). See [docs/FEDERATED_JOIN_BOUNDS.md](./docs/FEDERATED_JOIN_BOUNDS.md).
- Design: [docs/TENANT_RBAC_DESIGN.md](./docs/TENANT_RBAC_DESIGN.md).

### Still open
- Object storage backend; remaining file-only assets (plugins JARs, some desktop caches) as needed.
- Full billing / invoicing (hard quotas only today); per-user/team AI billing.
- Row-level data ACL.
- Live embedded dashboards; native SMTP (email uses HTTP mail gateway today); Mac signing/notarization + CI release assets.

## Unreleased — Enterprise access (Wave A)

### Highlights
- Outbound webhooks with HMAC signing for scheduled tasks, production approvals, schema drift, and audit events.
- OIDC login (Authorization Code + PKCE) with optional local login disable.
- Server-side team audit export (CSV/JSON) and optional `audit.appended` webhook fan-out.
- Settings → Integrations UI for webhook CRUD/test and admin OIDC configuration.

## v2.0.0 - Team real-time collaboration (polish)

### Highlights
- Collaborative SQL console with SSE presence, conflict diff, and optimistic locking.
- Standalone Connector Market page with catalog browsing and install guidance.
- Table data change audit with one-click time-travel restore.
- Fake data generation from table toolbar and tab context menu.
- Git-managed Query Library CI via `headless-cli query-library validate|run` and bookmark export.

### Headless CLI
- Added `query-library validate` and `query-library run` for `query-library.json` manifests.
- Added `--strict` validation (missing `connection` id fails CI checks).
- Example manifest and GitHub Actions workflow under `examples/query-library/`.

### Frontend
- Query bookmark export for Git CI (SQL + manifest downloads).
- Connector Market standalone navigation and redesigned cards.
- Table data toolbar fake-data action with post-insert grid refresh.

## v1.3.0 - Analysis automation

### Highlights
- Scheduled tasks now support full Analysis Canvas pipeline rerun with AI execution and canvas writeback.
- Dashboard and Platform Hub now show version highlight cards with quick entry actions.
- New onboarding "first insight" guide appears after first connection and guides users to AI insight flow.
- Platform packages now use a unified product version `1.3.0`.

### Backend
- Added `AnalysisCanvasPipelineService` and `AnalysisCanvasTargetParser` for scheduled AI reruns.
- Scheduled task execution now routes canvas jobs through pipeline service and stores run summary.
- Added SQL review EXPLAIN depth checks (full scan/index/rows/filesort risk findings).
- Added federated JOIN SQL parser and in-memory executor for cross-source JOIN execution.

### Frontend
- Added Federated View Wizard dialog and flow integration in Platform Hub.
- Added version highlight cards reusable component and persistence service.
- Added first-insight onboarding preset and trigger logic after first connection.
- Updated i18n resources for platform, onboarding, and federated wizard experiences.

## v1.2.0 - Cross-source confidence

### Highlights
- Federated JOIN execution support added for `@alias` SQL flow.
- SQL review gate upgraded with AI rewrite + EXPLAIN plan checks.
- Federated virtual view wizard added for guided cross-source SQL generation.

