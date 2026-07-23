# Desktop packaging scripts

把内嵌后端与 JRE 打进 Electron 可执行包。脚本目录：`datawise-frontend/scripts/desktop/`。

| 主机 | 默认产物 |
|------|----------|
| Windows | NSIS 安装包 + 便携版 |
| macOS (Apple Silicon) | DMG + zip（`arm64`）— [DESKTOP_MAC.md](../../../docs/DESKTOP_MAC.md) |
| Linux | AppImage — [DESKTOP_LINUX.md](../../../docs/DESKTOP_LINUX.md) |

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
| `npm run dist:desktop` | 当前系统全量构建（默认 **`core`** 配置档） |
| `npm run dist:desktop:slim` | 瘦包：无 JRE、无连接器 JAR（仅目录） |
| `npm run dist:desktop:full` | 全连接器 + 完整 JRE |
| `npm run dist:desktop:mac` | macOS Apple Silicon（**须在 Mac 上跑**） |
| `npm run dist:desktop:linux` | Linux AppImage |
| `npm run dist:desktop:clean` | 先清理再全量重建 |
| `npm run pack:desktop` | 仅 unpacked 目录，便于试跑 |
| `npm run prepare:desktop` | 只组装后端 → `resources/desktop/` |
| `npm run build:backend` | 仅 Maven → `target-desktop/` |
| `npm run clean:desktop` | 清前端打包产物 + 全部 `target-desktop/`（保留 IDE `target/`） |
| `npm run stop:desktop` | 结束正在运行的 DataWise / 内嵌后端 |

产物：`release/`（若目录被锁则为 `release-<timestamp>/`）。

---

## 配置档（profile）

| Profile | JRE | 包内连接器 | Maven `-pl` |
|---------|-----|------------|-------------|
| `slim` | 无 | 无（runtime-catalog） | 仅 server |
| `core`（默认） | jlink（失败则整包） | mysql · postgresql · sqlite · h2 | server + 4 |
| `full` | 完整拷贝 | 全部 `CONNECTOR_MODULES` | server + all |

设计说明：[RUNTIME_ON_DEMAND_INSTALL.md](../../../docs/design/RUNTIME_ON_DEMAND_INSTALL.md)

---

## 发布自动更新

客户端从以下地址解析更新：

`https://github.com/gouyehappy/datawise-cli/releases/latest/download/latest.yml`

仅打 Git tag **不够**。需要发布非 draft 的 GitHub Release，并附带 electron-builder 产物（`latest.yml`、NSIS/便携包等）：

```bash
# 需要 GH_TOKEN / 具备 release 权限的 GitHub 鉴权
npx electron-builder --win --publish always
```

包内使用 **generic** feed URL（而非 GitHubProvider JSON），以避免 GitHub 对 `Accept: application/json` 偶发 HTTP 406。

---

## Maven 策略

桌面打包**始终跳过测试**（`-Dmaven.test.skip=true` / `-DskipTests`）。

流水线（[`maven.mjs`](./maven.mjs)）：

1. 清空所有 `datawise-backend/**/target-desktop`（不动 IDE `target/`）
2. 停止残留桌面/后端进程（在 purge 内执行一次）
3. `mvn install -pl datawise-server,<connectors> -am`，`target-desktop`，关闭增量编译，`-T 1`
4. 校验 Spring Boot JAR 与 sqlflow `Statement.class`

默认**不**结束 Java LS。仍遇文件锁时可：`DATAWISE_KILL_JAVA_LS=1`。

---

## 清理语义

| 命令 | 清理范围 |
|------|----------|
| `npm run clean:desktop` | `dist/` · `dist-electron/` · `release*` · `resources/desktop/` · `**/target-desktop` |
| `node scripts/desktop/clean.mjs --all --ide-target` | 以上 **加上** IDE `**/target` |
| `node scripts/desktop/build.mjs --clean --ide-target` | 同 clean `--all --ide-target`，再全量构建 |

---

## 脚本布局

```
scripts/desktop/
  paths.mjs                   — 路径与模块列表
  lib.mjs                     — 杀进程、删除、JAR 校验
  maven.mjs                   — purge → install → validate
  bundle-backend.mjs          — 组装 resources/desktop + AppCDS
  generate-runtime-catalog.mjs
  jlink-jre.mjs               — core 档瘦 JRE
  clean.mjs / build.mjs / platform.mjs
```

---

## 进阶参数

```powershell
node scripts/desktop/build.mjs --profile core
node scripts/desktop/build.mjs --profile slim
node scripts/desktop/build.mjs --profile full
node scripts/desktop/build.mjs --mac --arm64
node scripts/desktop/build.mjs --linux
node scripts/desktop/bundle-backend.mjs --skip-maven
node scripts/desktop/clean.mjs --all
node scripts/desktop/clean.mjs --all --ide-target
npm run stop:desktop
npm run build:backend
$env:DATAWISE_KILL_JAVA_LS=1; npm run build:backend
```
