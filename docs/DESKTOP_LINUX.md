# Desktop packaging — Linux (JCEF)

Default desktop host is **JCEF** (`datawise-desktop`). Build on a Linux machine; output is a portable zip plus a **deb** installer (`jpackage --type deb`).

## Prerequisites

- Linux **x64** or **arm64**
- JDK **17+** (`JAVA_HOME`) — must include `jpackage`
- Maven 3.9+
- Node 20+ / npm
- `zip` on PATH
- **`fakeroot`** and **`binutils`** (required for `.deb`):

```bash
sudo apt-get update && sudo apt-get install -y fakeroot binutils
```

## Commands

```bash
cd datawise-frontend
npm install
npm run dist:desktop        # or dist:desktop:linux
npm run pack:desktop        # unpacked dir only (no zip/deb)
npm run dist:desktop -- --no-installer   # zip only
```

Must run **on Linux**. Cross-packaging from Windows/macOS is not supported (natives are OS-activated in Maven).

CI: push a `v*` tag (or run `desktop-release` via `workflow_dispatch`) — the Ubuntu job installs fakeroot and uploads zip + deb.

## Output

| Artifact | Path pattern |
|----------|----------------|
| Layout | `datawise-desktop/dist/linux/` |
| Zip | `datawise-frontend/release/DataWiseCLI-*-linux-{x64\|arm64}.zip` |
| deb | `datawise-frontend/release/DataWiseCLI-*-linux-{x64\|arm64}.deb` |

Config dir: `~/.config/DataWiseCLI/` (override with `DATAWISE_USER_DATA`).

Install: `sudo dpkg -i DataWiseCLI-*-linux-*.deb` (or open the deb in your software center).  
Portable: unzip and run `./DataWiseCLI.sh` or `./bin/DataWiseCLI` when jpackage produced a native binary.

## Architecture checklist

1. JCEF host + `jcef-natives-linux-*`
2. Bundled JRE for the host arch when using `core`/`full` profile
3. Backend JAR is platform-neutral; native connector drivers must ship Linux `.so` where needed

## Legacy Electron

`npm run dist:electron:linux` still builds an AppImage via electron-builder. Prefer JCEF for new releases.

## Related

- macOS: [DESKTOP_MAC.md](./DESKTOP_MAC.md)
- Host module: [`datawise-desktop/`](../datawise-desktop/)
- Backend bundle: `datawise-frontend/scripts/desktop/bundle-backend.mjs`
