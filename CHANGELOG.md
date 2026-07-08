# Changelog

All notable product-level changes for DataWise are documented in this file.

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

