# Desktop packaging — macOS (JCEF)

Default desktop host is **JCEF** (`datawise-desktop`). Build on a Mac; output is a zip (plus optional `DataWiseCLI.app` via `jpackage`).

## Prerequisites (on a Mac)

- macOS on **Apple Silicon** (arm64) or Intel (x64)
- JDK **17+** matching the host arch (`JAVA_HOME`)
- Maven 3.9+
- Node 20+ / npm
- `zip` on PATH

Code signing / notarization are **not** required for internal unsigned builds. Gatekeeper will warn until you sign + notarize.

## Commands

```bash
cd datawise-frontend
npm install
npm run dist:desktop        # or dist:desktop:mac
npm run pack:desktop        # unpacked dir only
```

Must run **on macOS**. Cross-packaging from Windows/Linux is not supported.

## Output

| Artifact | Path pattern |
|----------|----------------|
| Layout | `datawise-desktop/dist/macos/` |
| Zip | `datawise-frontend/release/DataWiseCLI-*-macos-{arm64\|x64}.zip` |

Config dir: `~/Library/Application Support/DataWiseCLI/` (override with `DATAWISE_USER_DATA`).

Run: `./DataWiseCLI.sh` or open `DataWiseCLI.app`.

## Architecture checklist

1. JCEF host + `jcef-natives-macosx-*`
2. Bundled JRE matching host arch when using `core`/`full` profile
3. Backend JAR is platform-neutral; native connector drivers must ship macOS `.dylib` where needed

## Legacy Electron

`npm run dist:electron:mac` still builds DMG/zip via electron-builder. Prefer JCEF for new releases.

## Related

- Linux: [DESKTOP_LINUX.md](./DESKTOP_LINUX.md)
- Host module: [`datawise-desktop/`](../datawise-desktop/)
- Backend bundle: `datawise-frontend/scripts/desktop/bundle-backend.mjs`
