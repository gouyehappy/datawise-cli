# datawise-desktop (JCEF)

Java desktop host — **default desktop entry** for Windows / macOS / Linux since 4.0.x. Vue UI and Spring Boot backend stay the same; this module owns the window, JS bridge, backend spawn, deep links, and tray.

Legacy Electron remains available via `npm run dist:electron*` if needed.

## Feature parity

| Area | Status |
|------|--------|
| JCEF window + frameless chrome | Done (macOS uses system chrome) |
| `__datawiseDesktopBridge` (terminal via `/ws/terminal`) | Done |
| Backend child process + configDir reuse | Done |
| In-app splash / tray / icons / window state | Done |
| Workspace switch relaunch | Done |
| Updater (GitHub zip) | Done |
| Zip release (`dist:desktop`) | Done — Win / Linux / macOS |
| Windows Setup.exe (`jpackage` + WiX) | Done when WiX 3.x installed |
| NSIS / DMG / AppImage installers | Optional later |

## Quick start (dev)

Terminal 1 — Vite:

```bash
cd datawise-frontend && npm run dev
```

Terminal 2 — desktop host:

```bash
# Windows
cd datawise-desktop && scripts\run-desktop.cmd
# macOS / Linux
cd datawise-desktop && scripts/run-desktop.sh
# or from frontend: npm run dev:jcef / npm run dev:all
```

## Packaged build

From `datawise-frontend` **on the target OS**:

```bash
npm run dist:desktop
# → datawise-desktop/dist/{windows|linux|macos}/
# → datawise-frontend/release/DataWiseCLI-{version}-{os}-{arch}.zip
# → datawise-frontend/release/DataWiseCLI-{version}-windows-x64-setup.exe  (Windows + WiX)
```

### Windows installer (Setup.exe)

`dist:desktop` also tries `jpackage --type exe` (Start Menu + desktop shortcut + dir chooser).

Requires **WiX Toolset 3.x** (`candle.exe` on PATH):

```bash
winget install --id WiXToolset.WiXToolset -e
# or: choco install wixtoolset -y
```

Then:

```bash
cd datawise-frontend
npm run dist:desktop
# Setup: release/DataWiseCLI-4.0.1-windows-x64-setup.exe
# Portable zip still produced alongside
```

Skip installer: `npm run dist:desktop -- --no-installer`

Aliases: `dist:desktop:mac`, `dist:desktop:linux` (same script; must run on that OS).

Requirements on target machine: **JDK 17+** on PATH (or bundled JRE under `backend/jre` when using full/core profile).

## Environment overrides

| Variable | Meaning |
|----------|---------|
| `DATAWISE_RENDERER_URL` | Force UI URL |
| `DATAWISE_API_BASE_URL` | Force API base |
| `DATAWISE_PACKAGED` / `-Ddatawise.packaged=true` | Packaged mode |
| `DATAWISE_INSTALL_ROOT` | Install root |
| `DATAWISE_USER_DATA` | Override user-data directory |

## Bridge contract

Mirrors `datawise-frontend/electron/preload.ts` except native terminal IPC (use WebSocket terminal instead).
