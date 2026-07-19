# Desktop packaging — Linux (G6)

DataWise desktop runs the bundled Spring Boot backend via `jre/bin/java` on Linux, same as macOS. Packaging was Windows-first; macOS Apple Silicon is documented in [DESKTOP_MAC.md](./DESKTOP_MAC.md). This doc covers the **Linux AppImage** path.

## Prerequisites

- Linux **x64** (glibc; AppImage target)
- JDK **17+** (`JAVA_HOME` must point at that JDK)
- Maven 3.9+
- Node 20+ / npm
- FUSE / AppImage runtime deps on the smoke-test machine (`libfuse2` on many distros)

Code signing is **not** required for internal unsigned AppImages.

## Commands

```bash
cd datawise-frontend
npm install
npm run dist:desktop:linux    # AppImage
# or
npm run pack:desktop          # unpacked dir for smoke test (host platform)
```

Host default on Linux:

```bash
npm run dist:desktop          # same as --linux when on a Linux host
```

Cross-packaging from Windows/macOS is blocked by default. Override only for experiments:

```bash
DATAWISE_ALLOW_CROSS_PACKAGING=1 npm run dist:desktop:linux
```

## Output

| Artifact | Path pattern |
|----------|----------------|
| AppImage | `release/DataWiseCLI-*-linux-*.AppImage` (exact name follows electron-builder) |
| Unpacked | `release/linux-unpacked/` (or similar) |

Config dir: `~/.config/DataWise CLI/config` (Electron `userData` on Linux).

## Architecture checklist

1. Electron Linux x64 binary (electron-builder `--linux`)
2. Bundled JRE for the host arch (copied from `JAVA_HOME`)
3. Backend JAR is platform-neutral; native connector drivers must ship Linux `.so` where needed
4. AppImage must be marked executable (`chmod +x`) before first run

## Still open

- Official signing / update channel for AppImage
- arm64 Linux desktop target
- CI `ubuntu-latest` workflow publishing release assets
- Distro packages (`.deb` / `.rpm`) beyond AppImage

## Related

- macOS: [DESKTOP_MAC.md](./DESKTOP_MAC.md)
- Scripts: `datawise-frontend/scripts/desktop/build.mjs`, `platform.mjs`, `bundle-backend.mjs`
- Runtime: `electron/backend-service.ts` (`jre/bin/java` on non-Windows)
