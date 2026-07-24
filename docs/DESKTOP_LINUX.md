# Desktop packaging — Linux (JCEF)

Default desktop host is **JCEF** (`datawise-desktop`). Build on a Linux machine; output is a zip (plus optional `jpackage` native launcher).

## Prerequisites

- Linux **x64** or **arm64**
- JDK **17+** (`JAVA_HOME`)
- Maven 3.9+
- Node 20+ / npm
- `zip` on PATH

## Commands

```bash
cd datawise-frontend
npm install
npm run dist:desktop        # or dist:desktop:linux
npm run pack:desktop        # unpacked dir only
```

Must run **on Linux**. Cross-packaging from Windows/macOS is not supported (natives are OS-activated in Maven).

## Output

| Artifact | Path pattern |
|----------|----------------|
| Layout | `datawise-desktop/dist/linux/` |
| Zip | `datawise-frontend/release/DataWiseCLI-*-linux-{x64\|arm64}.zip` |

Config dir: `~/.config/DataWiseCLI/` (override with `DATAWISE_USER_DATA`).

Run: `./DataWiseCLI.sh` or `./DataWiseCLI` when jpackage produced a native binary.

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
