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
| Updater (GitHub Releases) | Done — prefers setup.exe / DMG / deb over zip |
| Zip release (`dist:desktop`) | Done — Win / Linux / macOS |
| Windows Setup.exe (`jpackage` + WiX) | Done when WiX 3.x installed |
| macOS DMG (`jpackage`) | Done (unsigned; Gatekeeper warns) |
| Linux deb (`jpackage` + fakeroot) | Done when fakeroot installed |

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
# → datawise-frontend/release/DataWiseCLI-{version}-macos-{arch}.dmg
# → datawise-frontend/release/DataWiseCLI-{version}-linux-{arch}.deb
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

### macOS installer (DMG)

On a Mac, `dist:desktop` runs `jpackage --type dmg` after the `.app` app-image is ready.

```bash
cd datawise-frontend
npm run dist:desktop
# DMG: release/DataWiseCLI-4.0.1-macos-arm64.dmg  (or -x64)
```

Builds are **unsigned**. Users may need to allow the app in System Settings → Privacy & Security. Sign + notarize for distribution outside your org.

### Linux installer (deb)

On Linux, `dist:desktop` runs `jpackage --type deb` when `fakeroot` is available:

```bash
sudo apt-get install -y fakeroot binutils
cd datawise-frontend
npm run dist:desktop
# deb: release/DataWiseCLI-4.0.1-linux-x64.deb
```

Skip installer: `npm run dist:desktop -- --no-installer`

Aliases: `dist:desktop:mac`, `dist:desktop:linux` (same script; must run on that OS).

**Cross-packaging is not supported** — build Windows on Windows, macOS on a Mac, Linux on Linux (or use `.github/workflows/desktop-release.yml`).

Requirements on target machine: **JDK 17+** on PATH (or bundled JRE under `backend/jre` when using full/core profile).

### Publishing a release

1. Merge packaging changes to the default branch.
2. (Optional) On Windows, install WiX 3.x and run `npm run dist:desktop` locally to smoke-test Setup.exe.
3. Tag and push (version aligns with `datawise-frontend/package.json`):

```bash
git tag v4.0.1
git push origin v4.0.1
```

Or run **Desktop release** via GitHub Actions `workflow_dispatch`.

4. Confirm GitHub Releases has six assets (zip + installer × three OS). macOS DMGs are unsigned until you add signing/notarization.

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
