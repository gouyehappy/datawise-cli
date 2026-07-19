# Desktop packaging — macOS (G6)

DataWise desktop already runs the bundled Spring Boot backend via `jre/bin/java` on Darwin. Packaging was Windows-first; this doc covers the **Apple Silicon** path.

## Prerequisites (on a Mac)

- macOS on **Apple Silicon** (arm64)
- JDK **17+ arm64** (`JAVA_HOME` must point at that JDK — Temurin / Zulu / Oracle)
- Maven 3.9+
- Node 20+ / npm
- Xcode CLT (for native deps such as `node-pty` if rebuilt)

Code signing / notarization are **not** required for internal unsigned builds (`CSC_IDENTITY_AUTO_DISCOVERY=false`). Gatekeeper will warn until you sign + notarize.

## Commands

```bash
cd datawise-frontend
npm install
npm run dist:desktop:mac    # DMG + zip, arm64
# or
npm run pack:desktop        # unpacked .app for smoke test (host platform)
```

Host default on Darwin:

```bash
npm run dist:desktop        # same as --mac --arm64 when on Apple Silicon
```

Cross-packaging from Windows/Linux is blocked by default. Override only for experiments:

```bash
DATAWISE_ALLOW_CROSS_PACKAGING=1 npm run dist:desktop:mac
```

## Output

| Artifact | Path pattern |
|----------|----------------|
| DMG | `release/DataWiseCLI-*-mac-arm64.dmg` |
| ZIP | `release/DataWiseCLI-*-mac-arm64.zip` |
| Unpacked | `release/mac-arm64/` (or similar) |

Config dir: `~/Library/Application Support/DataWise CLI/config` (Electron `userData`).

## Architecture checklist

1. Electron arm64 binary (electron-builder `--arm64`)
2. Bundled JRE arm64 (copied from `JAVA_HOME`)
3. Backend JAR is platform-neutral; native connector drivers must ship macOS `.dylib` / `.jnilib` where needed

## Still open

- Linux AppImage polish — see [DESKTOP_LINUX.md](./DESKTOP_LINUX.md) (`npm run dist:desktop:linux`)
- Apple Developer ID signing + notarization
- Intel (x64) Mac dual-arch universal build
- CI `macos-14` workflow publishing release assets

## Related

- Linux: [DESKTOP_LINUX.md](./DESKTOP_LINUX.md)
- Scripts: `scripts/desktop/build.mjs`, `platform.mjs`, `bundle-backend.mjs`
- Runtime: `electron/backend-service.ts` (`jre/bin/java` on non-Windows)
