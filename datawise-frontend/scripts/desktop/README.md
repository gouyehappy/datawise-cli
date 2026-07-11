# Desktop packaging scripts

Build Windows desktop executables (NSIS installer + portable) with embedded backend and JRE.

## npm commands

| Command | Description |
|---------|-------------|
| `npm run dist:desktop` | Full build: Maven backend → bundle JRE/config → Electron → installer |
| `npm run dist:desktop:clean` | Full rebuild from scratch (cleans all artifacts + `mvn clean`) |
| `npm run pack:desktop` | Unpacked `release/win-unpacked/` for quick testing (no installer) |
| `npm run prepare:desktop` | Backend bundle only → `resources/desktop/` |
| `npm run stop:desktop` | Kill running DataWise / backend processes before rebuild |

**Prerequisites:** `JAVA_HOME` (JDK 17+), Maven, npm deps installed.

**Output:** `release/` (or `release-<timestamp>/` if the folder is locked).

## Script layout

```
scripts/desktop/
  paths.mjs          — repo paths and connector module list
  lib.mjs            — shared helpers (process kill, robust delete, Maven runner)
  bundle-backend.mjs — Maven build + JRE + config + connector plugins + AppCDS
  build-cds.mjs      — AppCDS class archive for faster JVM startup
  clean.mjs          — clean release dir or all build artifacts
  build.mjs          — orchestrator (calls the above + electron-builder)
```

## Advanced flags

```powershell
node scripts/desktop/build.mjs --skip-backend   # reuse existing resources/desktop/
node scripts/desktop/bundle-backend.mjs --skip-maven  # re-bundle JRE/config from existing JAR
node scripts/desktop/clean.mjs --all            # full clean without building
```
