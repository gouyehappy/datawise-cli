# Connector plugins (marketplace + hot-reload)

Optional datasource connectors load from `config/plugins/*.jar` via Java SPI
(`DataSourceConnectorProvider`). See `config/plugins/manifest.json.example` for the
marketplace manifest (`version` / `sha256` / `downloadUrl`).

## Hot-reload (G11 / S6)

| Action | API |
|--------|-----|
| Install from marketplace URL | `POST /api/datasources/market/install` `{ "connectorId": "…" }` (admin) |
| Reinstall / upgrade (same API when already loaded + `downloadUrl`) | Marketplace card **Reinstall / upgrade** |
| Reload JARs into the live registry | `POST /api/datasources/plugins/reload` (admin) |

Install automatically calls reload. When the connector resolves after reload,
`restartRequired` is `false`. If hot-reload cannot activate the JAR (for example a
Windows file lock on an already-loaded JAR, or a load failure), `restartRequired`
is `true` and a process restart is still needed.

Marketplace UI: **Reload plugins** refreshes the runtime registry without restart.

## Integrity

Set `datawise.connectors.require-manifest-integrity=true` to reject JARs whose
SHA-256 does not match `manifest.json`. Default is warn-only.
