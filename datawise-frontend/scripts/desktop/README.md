# Desktop packaging scripts

Build desktop executables with an embedded backend and JRE.

| Host | Default product |
|------|-----------------|
| Windows | NSIS installer + portable |
| macOS (Apple Silicon) | DMG + zip (`arm64`) — see [DESKTOP_MAC.md](../../../docs/DESKTOP_MAC.md) |
| Linux | AppImage (scaffold) |

## Why `target-desktop/`

Desktop packaging uses Maven’s official `<directory>` override:

- Parent POM property: `datawise.build.dir` (default `target`)
- Packaging always passes `-Ddatawise.build.dir=target-desktop`

Cursor/VS Code Java LS keeps compiling into the default `target/`. Sharing that directory with packaging caused corrupt `.class` files and empty Spring Boot JARs on Windows. **Two output directories is the intended isolation**, not a temporary path hack.

```
IDE Java LS  →  datawise-backend/**/target/
desktop mvn  →  datawise-backend/**/target-desktop/  →  resources/desktop/  →  release/
```

## npm commands

| Command | Description |
|---------|-------------|
| `npm run dist:desktop` | Full build for **host** OS (Win / Mac arm64 / Linux) |
| `npm run dist:desktop:mac` | macOS Apple Silicon DMG + zip (**must run on macOS**) |
| `npm run dist:desktop:linux` | Linux AppImage |
| `npm run dist:desktop:clean` | Full rebuild (`--clean`: wipe packaging artifacts first) |
| `npm run pack:desktop` | Unpacked app dir for quick testing (no installer) |
| `npm run prepare:desktop` | Backend bundle only → `resources/desktop/` |
| `npm run build:backend` | Maven only → `target-desktop/` |
| `npm run clean:desktop` | Wipe frontend packaging artifacts + all `target-desktop/` (keeps IDE `target/`) |
| `npm run stop:desktop` | Kill running DataWise / bundled backend processes |

**Prerequisites:** `JAVA_HOME` (JDK 17+), Maven, npm deps installed.

**Output:** `release/` (or `release-<timestamp>/` if the folder is locked).

## Maven policy

Desktop packaging **always skips tests** (`-Dmaven.test.skip=true` / `-DskipTests`).

Build pipeline ([`maven.mjs`](./maven.mjs)):

1. Purge every `datawise-backend/**/target-desktop` (IDE `target/` left alone)
2. Stop stale desktop/backend processes (once, inside purge)
3. `mvn install -pl datawise-server,<connectors> -am` with `target-desktop`, incremental compile off, `-T 1`
4. Validate Spring Boot JAR + sqlflow `Statement.class`

Process stop does **not** kill Java LS by default. Set `DATAWISE_KILL_JAVA_LS=1` only if you still hit IDE file locks.

`CONNECTOR_MODULES` lists packable datasource plugins (not spi/api/jdbc-runtime/`*-all`).

## Clean semantics

| Command | Clears |
|---------|--------|
| `npm run clean:desktop` | `dist/`, `dist-electron/`, `release*`, `resources/desktop/`, `**/target-desktop` |
| `node scripts/desktop/clean.mjs --all --ide-target` | Above **plus** IDE `**/target` |
| `node scripts/desktop/build.mjs --clean --ide-target` | Same as clean `--all --ide-target`, then full build |

## Script layout

```
scripts/desktop/
  paths.mjs          — repo paths + DESKTOP_BACKEND_MODULES / CONNECTOR_MODULES
  lib.mjs            — process kill, robust delete, boot-JAR find/validate
  maven.mjs          — purge → install → validate (tests always skipped)
  bundle-backend.mjs — Maven → assemble resources/desktop → AppCDS
  build-cds.mjs      — AppCDS class archive (load-plugins=false during train)
  clean.mjs          — clean release dir or all packaging artifacts
  build.mjs          — orchestrator (optional clean → bundle → electron-builder)
  platform.mjs       — host/flag → electron-builder args (win/mac/linux)
```

## Advanced flags

```powershell
node scripts/desktop/build.mjs --skip-backend          # reuse existing resources/desktop/
node scripts/desktop/build.mjs --mac --arm64           # macOS (on a Mac)
node scripts/desktop/build.mjs --linux                 # Linux AppImage
node scripts/desktop/bundle-backend.mjs --skip-maven   # re-bundle JRE/config from existing JAR
node scripts/desktop/clean.mjs --all                   # packaging clean without building
node scripts/desktop/clean.mjs --all --ide-target      # also wipe IDE target/
npm run stop:desktop                                   # free file locks before build
npm run build:backend                                  # rebuild JAR only after Java changes
$env:DATAWISE_KILL_JAVA_LS=1; npm run build:backend  # opt-in Java LS stop
```
