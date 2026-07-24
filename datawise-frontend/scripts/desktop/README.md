# Desktop packaging scripts

Backend / JRE bundling for the **JCEF** desktop host lives under `datawise-frontend/scripts/desktop/`. The host itself is packaged by [`datawise-desktop/scripts/build-desktop.mjs`](../../../datawise-desktop/scripts/build-desktop.mjs).

| Host OS | Default artifact |
|---------|------------------|
| Windows | Zip + Setup.exe (`jpackage` + WiX) — [datawise-desktop/README.md](../../../datawise-desktop/README.md) |
| macOS | Zip + DMG — [DESKTOP_MAC.md](../../../docs/DESKTOP_MAC.md) |
| Linux | Zip + deb (`fakeroot`) — [DESKTOP_LINUX.md](../../../docs/DESKTOP_LINUX.md) |

Legacy Electron packaging still uses `scripts/desktop/build.mjs` via `npm run dist:electron*`.

---

## 为何使用 `target-desktop/`

桌面打包走 Maven 官方 `<directory>` 覆盖：

- 父 POM：`datawise.build.dir`（默认 `target`）
- 打包始终传入 `-Ddatawise.build.dir=target-desktop`

IDE Java LS 会持续写入默认 `target/`。与打包共用同一目录会在 Windows 上弄坏 `.class`、产出空的 Spring Boot JAR。**两套输出目录是刻意隔离**，不是临时绕过。

```
IDE Java LS  →  datawise-backend/**/target/
desktop mvn  →  datawise-backend/**/target-desktop/  →  resources/desktop/  →  release/
```

---

## npm 命令

在 `datawise-frontend` 下执行。前置：`JAVA_HOME`（JDK 17+）、Maven、已 `npm install`。

| 命令 | 说明 |
|------|------|
| `npm run dist:desktop` | **JCEF** 当前系统全量构建（默认 **`core`** 配置档） |
| `npm run dist:desktop:slim` | 瘦包：无 JRE、无连接器 JAR |
| `npm run dist:desktop:full` | 全连接器 + 完整 JRE |
| `npm run dist:desktop:mac` | macOS 别名（**须在 Mac 上跑**） |
| `npm run dist:desktop:linux` | Linux 别名（**须在 Linux 上跑**） |
| `npm run pack:desktop` | 仅 unpacked 目录，便于试跑 |
| `npm run prepare:desktop` | 只组装后端 → `resources/desktop/` |
| `npm run build:backend` | 仅 Maven → `target-desktop/` |
| `npm run clean:desktop` | 清前端打包产物 + 全部 `target-desktop/` |
| `npm run stop:desktop` | 结束正在运行的 DataWise / 内嵌后端 |
| `npm run dist:electron*` | **Legacy** Electron（electron-builder） |

产物：

- `datawise-frontend/release/DataWiseCLI-*-{windows\|linux\|macos}-*.zip`
- Windows：`DataWiseCLI-*-windows-x64-setup.exe`（需 WiX 3.x）
- macOS：`DataWiseCLI-*-macos-{arm64\|x64}.dmg`
- Linux：`DataWiseCLI-*-linux-{x64\|arm64}.deb`（需 `fakeroot`）

跳过安装包：`npm run dist:desktop -- --no-installer`。三端安装包须在对应 OS（或 `desktop-release` CI）上构建，不可交叉打包。

---

## Profiles

| Profile | JRE | Connectors | Typical use |
|---------|-----|------------|-------------|
| `slim` | no | no | smallest; download runtime later |
| `core` (default) | yes | curated set | recommended release |
| `full` | yes | all in-tree | offline / air-gapped |

See also [RUNTIME_ON_DEMAND_INSTALL.md](../../../docs/design/RUNTIME_ON_DEMAND_INSTALL.md).
