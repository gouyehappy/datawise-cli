# 运行时组件按需安装 — 详细设计

> **状态：** 设计已确认（可进入开发）  
> **目标：** 瘦身桌面/便携安装包，连接器、JDBC 驱动、JRE 改为按需安装与可配置  
> **关联：** [DESKTOP_MAC.md](../DESKTOP_MAC.md) · [DESKTOP_LINUX.md](../DESKTOP_LINUX.md) · [DEPLOYMENT.md](../DEPLOYMENT.md)

---

## 1. 背景

### 1.1 问题

当前桌面安装包体积偏大，主要来源：

| 组件 | 当前打包行为 | 典型体积 |
|------|-------------|---------|
| **连接器插件** | `CONNECTOR_MODULES`（36 个）全部构建并复制到 `config/plugins/` | ~150–300 MB |
| **JDBC 驱动** | 从开发机 `config/drivers/` 复制（可能含 Hive 等大量 JAR） | 0–500 MB |
| **JRE** | 从 `JAVA_HOME` 复制完整 `bin/lib/conf` | ~60–100 MB |
| **Electron + 后端 JAR** | 固定 | ~150–200 MB |

用户往往只使用其中 2–3 种数据库，却需要下载全量组件。

### 1.2 目标

1. **安装包瘦身**：默认「核心壳 + 清单」，组件按需拉取（目标：安装包减少 40–60%）
2. **体验不降级**：首次启动有引导；常用库可一键安装；建连时自动提示缺失驱动
3. **复用现有能力**：在连接器市场、远程安装、JDBC 按需下载之上扩展，不大改架构
4. **安全一致**：SHA-256 校验、管理员权限、下载源白名单与现有治理对齐
5. **离线可用**：支持本地导入 JAR、全量离线包（`full` profile）

### 1.3 非目标（本阶段不做）

- 连接器/驱动的**在线商店**（第三方开发者上架、付费等）
- 替换 Electron 壳或改为纯 Web 安装
- 多版本连接器**并行共存**（同一 `connectorId` 仍只保留一个 JAR）
- 自动升级整个应用（已有 electron-updater，本设计不重复）

---

## 2. 现状盘点

### 2.1 已有能力（可直接复用）

#### 连接器（`config/plugins/`）

| 能力 | 实现位置 |
|------|---------|
| SPI 热加载 | `ConnectorPluginLoader` |
| 远程下载 + SHA-256 | `ConnectorPluginRemoteInstallSupport` |
| 安装 API | `DatasourceCatalogService.installRemotePlugin()` |
| 热重载 | `ConnectorPluginRuntime.reload()` |
| 市场列表 | `GET /api/datasources/market` |
| 前端市场 | `connector-market.service.ts`、插件中心 UI |

Server 运行时：`datawise-connector-all` 仅 `test` scope；生产靠 `config/plugins/*.jar`。classpath 上仅保留 `datawise-connector-ssh`（Shell 会话）。

#### JDBC 驱动（`config/drivers/`）

| 能力 | 实现位置 |
|------|---------|
| Maven Central 按需下载 | `JdbcDriverLoader.ensureDriver()` |
| 建连时解析 | `POST /api/datasources/drivers/resolve` |
| 启动预加载已有 JAR | `JdbcDriverPreloadService` |
| 默认坐标 | `DbTypeCatalogEntry.driverMaven` |

#### JRE

| 能力 | 实现位置 |
|------|---------|
| 内嵌 JRE 启动 | `bundle-backend.mjs` → `resources/desktop/backend/jre/` |
| 解析 java 路径 | `electron/backend-service.ts` → `resolveJavaExecutable()` |
| 回退系统 java | 内嵌不存在时使用 PATH 上的 `java` |

#### 桌面打包

| 能力 | 实现位置 |
|------|---------|
| 构建 36 个 connector | `scripts/desktop/paths.mjs` → `CONNECTOR_MODULES` |
| 复制 plugins/drivers | `scripts/desktop/bundle-backend.mjs` |
| 工作区模板 | `resources/bundle-config/`（plugins/drivers 目前仅 `.gitkeep`） |

### 2.2 缺口

| 缺口 | 说明 |
|------|------|
| 瘦打包 profile | 无法选择「不打包 connector / 不打包 JRE」 |
| 统一清单 | `manifest.json` 未随发布自动生成；瘦包无完整 catalog |
| 驱动管理 UI/API | 仅有 resolve，无列表/删除/上传 |
| 连接器批量装/卸 | 仅单个 `market/install` |
| JRE 可配置 | 无设置页；用户不能选系统 JRE 或自定义路径 |
| 首次引导 | 新用户需手动进市场或拷 JAR |
| CLI | `headless-cli` 无 `runtime` 子命令 |

---

## 3. 总体架构

```
┌─────────────────────────────────────────────────────────────┐
│  瘦安装包 (JCEF host + server.jar + runtime-catalog.json)     │
│  JRE 可选: jlink 精简 / 无内嵌 (slim)                         │
└──────────────────────────┬──────────────────────────────────┘
                           │
         ┌─────────────────┼─────────────────┐
         ▼                 ▼                 ▼
   首次启动向导      设置 → 运行环境      headless-cli runtime
         │                 │                 │
         └─────────────────┼─────────────────┘
                           ▼
              ┌────────────────────────┐
              │  工作区 config/         │
              │  plugins/  drivers/    │
              │  runtime.json          │
              └───────────┬────────────┘
                          │
              ┌───────────▼────────────┐
              │  Spring Boot 后端       │
              │  热加载 connector       │
              │  按需加载 JDBC driver   │
              └────────────────────────┘
```

**原则：** 安装包只带「壳 + 清单」；组件安装进用户**工作区** `config/`，与现有多工作区、便携版模型一致。重装应用不覆盖 `userData/config`。

---

## 4. 统一清单：Runtime Catalog

### 4.1 文件位置

| 场景 | 路径 |
|------|------|
| 发布源（CDN / GitHub Release） | `runtime-catalog.json` |
| 安装包内置（瘦包） | `resources/bundle-config/runtime-catalog.json` |
| 用户工作区（可选覆盖/缓存） | `config/runtime-catalog.json` |

现有 `config/plugins/manifest.json` **保留兼容**；新 catalog 的 `connectors` 段字段与之对齐，并逐步迁移。

### 4.2 Schema 草案

```json
{
  "schemaVersion": 1,
  "channel": "stable",
  "updatedAt": "2026-07-21T00:00:00Z",
  "baseUrl": "https://github.com/org/datawise-cli/releases/download/v4.0.1/",
  "connectors": [
    {
      "id": "mysql",
      "label": "MySQL / MariaDB",
      "tier": "core",
      "primary": true,
      "jar": "datawise-connector-mysql-4.0.1.jar",
      "version": "4.0.1",
      "downloadUrl": "https://.../datawise-connector-mysql-4.0.1.jar",
      "sha256": "hex...",
      "sizeBytes": 2457600,
      "jdbcDriver": {
        "maven": "com.mysql:mysql-connector-j:8.4.0",
        "driverClass": "com.mysql.cj.jdbc.Driver",
        "sizeBytes": 2488320
      }
    }
  ],
  "driverBundles": [
    {
      "id": "hive",
      "label": "Apache Hive JDBC",
      "description": "多 JAR 依赖，无法仅从 Maven Central 单坐标安装",
      "jars": [
        {
          "fileName": "hive-jdbc-3.1.2-standalone.jar",
          "relativePath": "hive/hive-jdbc-3.1.2-standalone.jar",
          "downloadUrl": "https://...",
          "sha256": "hex...",
          "sizeBytes": 52428800
        }
      ]
    }
  ],
  "jrePackages": [
    {
      "platform": "win-x64",
      "vendor": "temurin",
      "version": "17.0.12+7",
      "variant": "jre",
      "archive": "OpenJDK17U-jre_x64_windows_hotspot_17.0.12_7.zip",
      "downloadUrl": "https://api.adoptium.net/...",
      "sha256": "hex...",
      "sizeBytes": 45000000
    }
  ]
}
```

### 4.3 Connector Tier 分层

| Tier | 连接器（示例） | 默认策略 |
|------|---------------|---------|
| `core` | mysql, postgresql, sqlite, h2 | **core profile** 预装；向导默认勾选 |
| `common` | oracle, sqlserver, clickhouse, redis, kafka, mongodb, hive, doris, starrocks… | 仅 catalog，按需安装 |
| `niche` | phoenix, oscar, gbase8a, cachedb, sybase… | 仅 catalog |

Tier 仅影响**打包默认值**与**向导推荐**，不影响运行时能力。

### 4.4 清单生成

新增构建脚本 `scripts/generate-runtime-catalog.mjs`：

1. 扫描 `datawise-connectors/datawise-connector-*/pom.xml` 与 `DbType` 枚举
2. 读取各模块 `target-desktop/*.jar` 的 SHA-256 与大小
3. 合并 `DbTypeCatalogEntry.driverMaven` 作为 `jdbcDriver`
4. 输出 `runtime-catalog.json`；CI 发布时上传到 GitHub Release

---

## 5. 子系统设计

### 5.1 连接器安装（Connector Runtime）

#### 5.1.1 用户故事

- 作为新用户，首次启动时勾选「MySQL + PostgreSQL」，应用自动下载并加载对应连接器，无需手动拷 JAR。
- 作为管理员，在连接器市场一键安装 Oracle 连接器，SHA 校验通过后立即可用。
- 作为管理员，卸载不用的连接器以释放磁盘（Windows 已加载 JAR 时提示重启）。
- 作为内网用户，从 U 盘导入 connector JAR，不访问外网。

#### 5.1.2 API 设计

| 方法 | 路径 | 权限 | 说明 |
|------|------|------|------|
| `GET` | `/api/datasources/market` | 登录用户 | **扩展**：`tier`、`sizeBytes`、`installedSizeBytes` |
| `POST` | `/api/datasources/market/install` | 管理员 | **已有**：单个安装 |
| `POST` | `/api/datasources/market/install-batch` | 管理员 | **新增**：`{ connectorIds: string[] }`，并行下载 |
| `DELETE` | `/api/datasources/market/{connectorId}` | 管理员 | **新增**：删除 JAR + reload |
| `POST` | `/api/datasources/market/import` | 管理员 | **新增**：`multipart` 上传 JAR，可选校验 manifest SHA |
| `POST` | `/api/datasources/plugins/reload` | 管理员 | **已有** |

**`install-batch` 响应：**

```json
{
  "results": [
    {
      "connectorId": "mysql",
      "success": true,
      "jarName": "datawise-connector-mysql-4.0.1.jar",
      "restartRequired": false
    }
  ],
  "reload": {
    "loadedJarCount": 2,
    "connectorIds": ["mysql", "postgresql"],
    "failures": []
  }
}
```

**卸载规则：**

- 删除 `config/plugins/{jarName}`（从 manifest/catalog 解析 jar 名）
- 调用 `reloadPlugins()`
- `tier=core` 的连接器允许卸载，但向导可提示「建议保留」
- 若有连接正在使用该类型，仅警告不阻断（与现有一致：连接配置保留，执行时报 `DATASOURCE_NOT_AVAILABLE`）

#### 5.1.3 安装流程

```
用户点击「安装」
  → 校验 manifest/catalog 中 downloadUrl + sha256
  → ConnectorPluginRemoteInstallSupport.install()
  → 写入 config/plugins/{jar}.jar
  → reloadPluginManifest() + reloadPlugins()
  → 若热加载失败 → restartRequired=true，提示重启后端
  → 若 catalog 含 jdbcDriver → 可选：串联调用 driver install
```

#### 5.1.4 前端

- **连接器市场**（已有）：增加体积、卸载、批量安装
- **首次向导**（新）：Step「选择数据库」→ 调用 `install-batch`
- **建连页**：类型不可用时链到市场对应项

---

### 5.2 JDBC 驱动下载安装（Driver Runtime）

#### 5.2.1 用户故事

- 建连 MySQL 时，驱动未缓存，界面显示「下载驱动 (2.4 MB)」一键完成。
- 在设置中查看已缓存驱动列表与占用空间，删除不用的 JAR。
- 上传 Oracle `ojdbc11.jar`（无法从 Maven Central 拉取）。
- 安装 Hive 时，按 bundle 一次性下载多个 JAR 到 `config/drivers/hive/`。

#### 5.2.2 API 设计

| 方法 | 路径 | 权限 | 说明 |
|------|------|------|------|
| `GET` | `/api/datasources/drivers` | 登录用户 | **新增**：已缓存列表 |
| `POST` | `/api/datasources/drivers/install` | 登录用户 | **新增**：主动安装（不等建连） |
| `POST` | `/api/datasources/drivers/resolve` | 登录用户 | **已有** |
| `DELETE` | `/api/datasources/drivers/{fileName}` | 管理员 | **新增**：删除缓存 JAR |
| `POST` | `/api/datasources/drivers/upload` | 管理员 | **新增**：上传商业/私有驱动 |
| `POST` | `/api/datasources/drivers/bundles/{bundleId}/install` | 管理员 | **新增**：安装 driverBundle |

**`GET /api/datasources/drivers` 响应：**

```json
{
  "drivers": [
    {
      "fileName": "mysql-connector-j-8.4.0.jar",
      "mavenCoordinates": "com.mysql:mysql-connector-j:8.4.0",
      "driverClass": "com.mysql.cj.jdbc.Driver",
      "sizeBytes": 2488320,
      "relatedConnectors": ["mysql"],
      "loadedInMemory": true
    }
  ],
  "totalBytes": 2488320,
  "driversDirectory": "/path/to/config/drivers"
}
```

#### 5.2.3 配置项

```yaml
datawise:
  jdbc:
    preload-drivers-on-startup: true   # 已有
    maven-repo-url: https://repo1.maven.org/maven2  # 新增，企业可改 Nexus
    download-timeout-seconds: 180      # 新增
    max-jar-bytes: 209715200           # 新增，默认 200MB
```

#### 5.2.4 与连接器的联动

Catalog 中 `connectors[].jdbcDriver` 用于：

1. 连接器安装成功后，前端询问「是否同时下载 JDBC 驱动？」
2. 建连向导检测：`hasCachedJar(maven)` → 显示状态徽章
3. 首次向导批量安装 connector 时，默认**同时** install 关联 driver

#### 5.2.5 Hive 等特殊场景

沿用 `HiveJdbcDriverBundle` 逻辑；bundle 安装 API 将 catalog 中 `driverBundles` 的 JAR 下载到 `config/drivers/hive/`（或 `relativePath` 指定子目录）。

---

### 5.3 JRE 运行环境配置

#### 5.3.1 用户故事

- 默认使用安装包内精简 JRE，用户无感知。
- 开发者切换为系统已安装的 JDK 17，减小安装包依赖。
- slim 安装包不含 JRE，首次启动引导下载 Temurin 17 JRE。
- 企业统一 JRE 路径：设置中指定 `D:\Apps\Java\jdk-17`。

#### 5.3.2 JRE 来源模式

| 模式 | 值 | 行为 |
|------|-----|------|
| 内嵌完整 | `bundled` | `resources/backend/jre/`（当前行为） |
| 内嵌精简 | `bundled-jlink` | jlink 裁剪后的 JRE（推荐 core profile） |
| 系统 | `system` | `JAVA_HOME` 或 PATH 上 `java`，版本 ≥ 17 |
| 自定义 | `custom` | 用户指定 `javaHome` 目录 |
| 按需下载 | `download` | 下载到 `config/jre/{platform}/`，catalog 中 `jrePackages` |

#### 5.3.3 配置存储

**Electron 侧** `desktop-preferences.json`（或工作区 `config/runtime.json`）：

```json
{
  "jre": {
    "source": "bundled-jlink",
    "customHome": null,
    "downloadedHome": null,
    "minVersion": "17",
    "lastVerifiedAt": "2026-07-21T12:00:00Z",
    "lastVerificationError": null
  }
}
```

**优先级：** 工作区 `config/runtime.json` > 全局 `desktop-preferences.json` > 默认 `bundled-jlink`。

#### 5.3.4 Electron 改动要点

`resolveJavaExecutable()` 扩展：

```typescript
function resolveJavaExecutable(): string {
  const jre = readJrePreferences()
  switch (jre.source) {
    case 'custom':
      return join(jre.customHome!, 'bin', process.platform === 'win32' ? 'java.exe' : 'java')
    case 'download':
      return join(jre.downloadedHome!, 'bin', ...)
    case 'system':
      return detectSystemJava(jre.minVersion) // 读 JAVA_HOME / which java
    default:
      return bundledJavaPath() // 现有 jre/bin/java
  }
}
```

启动前校验：`java -version` 解析 major ≥ 17；失败则阻断启动并打开「运行环境」设置页。

#### 5.3.5 jlink 精简 JRE（构建时）

```bash
jlink \
  --add-modules java.base,java.logging,java.xml,java.naming,java.sql,java.management,java.instrument,java.desktop \
  --strip-debug --no-header-files --no-man-pages \
  --compress=2 \
  -o resources/desktop/backend/jre
```

模块列表以 Spring Boot 3 + 实际启动为准，需在 CI 中验证 `datawise-server.jar` 可正常启动。

#### 5.3.6 JRE 下载（Phase 3）

- Electron 主进程下载（不经后端，避免鸡生蛋）
- 使用 catalog `jrePackages` 中按 `process.platform` + arch 匹配的条目
- 解压到 `config/jre/temurin-17-win-x64/`
- SHA-256 校验后写入 `runtime.json`

#### 5.3.7 后端只读报告

`GET /api/runtime/jre`（登录用户）：

```json
{
  "version": "17.0.12",
  "vendor": "Eclipse Adoptium",
  "home": "…",
  "source": "bundled-jlink"
}
```

由 JVM 系统属性 `java.version`、`java.vendor`、`java.home` 提供；`source` 由启动参数 `-Ddatawise.runtime.jre.source=…` 传入。

---

### 5.4 运行时总览 API

`GET /api/runtime` — 设置页「运行环境」总览：

```json
{
  "jre": { "version": "17.0.12", "vendor": "Eclipse Adoptium", "source": "bundled-jlink" },
  "connectors": {
    "installed": 4,
    "catalogTotal": 36,
    "pluginsBytes": 10485760,
    "failures": []
  },
  "drivers": {
    "cachedJars": 2,
    "totalBytes": 5242880
  },
  "workspace": {
    "configDir": "/path/to/config",
    "diskUsageBytes": 15728640
  }
}
```

---

## 6. 打包 Profile

### 6.1 Profile 定义

| Profile | JCEF host + server.jar | JRE | Connectors | catalog | 预估体积 |
|---------|----------------------|-----|------------|---------|---------|
| `slim` | ✓ | 无 | 0 | ✓ | ~180 MB |
| `core`（**推荐默认**） | ✓ | jlink | 4（core tier） | ✓ | ~220 MB |
| `full` | ✓ | 完整 JRE | 36（全部） | ✓ | ~500 MB+ |

### 6.2 构建命令

```bash
cd datawise-frontend

# 默认 core
npm run dist:desktop

# 显式指定
npm run dist:desktop -- --profile slim
npm run dist:desktop -- --profile core
npm run dist:desktop -- --profile full
```

### 6.3 `bundle-backend.mjs` 变更

```javascript
// 伪代码
const profile = parseProfile(argv) // slim | core | full

// JRE
if (profile === 'slim') {
  // 不复制 jre
} else if (profile === 'core') {
  copyJlinkJre(javaHome, dest) // 或 copyJre 若 jlink 未就绪
} else {
  copyJre(javaHome, dest) // 完整
}

// Connectors
const modules = profile === 'full'
  ? CONNECTOR_MODULES
  : profile === 'core'
    ? CORE_CONNECTOR_MODULES
    : []

// 始终复制 runtime-catalog.json；plugins 目录按 modules 构建结果复制
```

### 6.4 `paths.mjs` 新增

```javascript
export const CORE_CONNECTOR_MODULES = [
  'datawise-connectors/datawise-connector-mysql',
  'datawise-connectors/datawise-connector-postgresql',
  'datawise-connectors/datawise-connector-sqlite',
  'datawise-connectors/datawise-connector-h2',
]
```

`DESKTOP_BACKEND_MODULES` 按 profile 动态组装，避免 slim 仍编译 36 个模块（可选：slim 只编 server + catalog 生成）。

---

## 7. 前端设计

### 7.1 设置 → 运行环境（新页面）

| 区块 | 内容 |
|------|------|
| **Java 运行时** | 当前版本/供应商/来源；切换模式；「检测」「浏览目录」「下载 JRE」 |
| **连接器** | 已装数量/总 catalog 数；跳转连接器市场；已占用空间 |
| **JDBC 驱动** | 缓存列表（文件名、大小、关联库）；删除；上传 |
| **磁盘占用** | plugins + drivers + logs 分项；打开文件夹（桌面） |

路由建议：`/settings/runtime` 或并入「系统监控」。

### 7.2 首次启动向导

仅 **packaged 桌面版** 且工作区为**新建**时展示（`!hasExistingConfig`）。

| Step | 标题 | 内容 |
|------|------|------|
| 1 | 欢迎 | 说明按需安装；选「推荐」或「稍后自行配置」 |
| 2 | 选择数据库 | 多选，默认勾选 core tier |
| 3 | 下载组件 | 进度条：connector + driver 并行；可跳过 |
| 4 | Java 环境 | slim 包：检测/下载 JRE；其他：显示已就绪 |
| 5 | 完成 | 进入「新建连接」或工作台 |

可跳过：直接进入工作台，连接器市场 Banner 提示待安装数量（已有 `pendingBannerTitle` 文案）。

### 7.3 连接器市场增强

在现有页面上增加：

- 列：大小、安装状态、磁盘占用
- 操作：安装 / 重装 / **卸载**
- 工具栏：**安装全部 Core**（管理员）
- 安装连接器后 toast：「是否下载 JDBC 驱动？」

### 7.4 i18n

新增 `settings.runtime.*`、`onboarding.*` 中英文键；复用 `plugin.connectorMarket.*` 部分文案。

---

## 8. CLI 设计（headless-cli）

```bash
# 状态
datawise runtime status [--json]

# 连接器
datawise runtime install connector <id> [--channel stable]
datawise runtime install connectors --tier core
datawise runtime uninstall connector <id>
datawise runtime import connector <path-to.jar>

# 驱动
datawise runtime install driver <maven-coords> --class <driverClass>
datawise runtime install driver-bundle hive
datawise runtime import driver <path-to.jar>
datawise runtime list drivers

# JRE（仅检测，下载仍走桌面或手动）
datawise runtime jre check [--min 17]
```

实现：调用与 UI 相同的后端 REST API；需后端已启动。离线导入可在 CLI 侧直接写 `config/plugins` / `config/drivers` 后调 `plugins/reload`。

---

## 9. 安全与治理

| 风险 | 对策 |
|------|------|
| 恶意 JAR | catalog/manifest **SHA-256 必填**（生产 `datawise.connectors.require-manifest-integrity=true`） |
| SSRF | 下载 URL 仅 `https`；host 白名单（`github.com`、`repo1.maven.org`、配置的 `mirror`） |
| 路径穿越 | 沿用 `sanitizeJarName()`；upload 禁止 `..` 与绝对路径 |
| 权限 | 安装/卸载/上传 connector 与 driver → **管理员**；普通用户可读列表、建连时触发 driver resolve |
| 供应链 | Phase 4：catalog 整体签名（可选） |
| Windows 文件锁 | 热加载失败 → `restartRequired` + 明确文案（已有模式） |
| 磁盘耗尽 | 下载前检查可用空间；单 JAR 大小上限（connector 120MB，driver 200MB 可配置） |

与 [GOVERNANCE.md](../GOVERNANCE.md) 无冲突：本功能不涉及生产写 SQL。

---

## 10. 实施分期

### Phase 1 — 瘦身快赢（约 1–2 周）

**范围**

- [ ] `bundle-backend.mjs` / `paths.mjs`：`--profile slim|core|full`
- [ ] `scripts/generate-runtime-catalog.mjs`
- [ ] `resources/bundle-config/runtime-catalog.json`（生成物）
- [ ] jlink 精简 JRE（core profile）
- [ ] 文档更新：`DESKTOP_*.md`

**验收**

- `core` 安装包体积较 `full` 减少 ≥ 40%
- 瘦包首次启动后，通过市场安装 MySQL connector 并建连成功
- 现有 `full` profile 行为与当前一致

### Phase 2 — 运行时管理 UI（约 2–3 周）

**范围**

- [ ] `GET /api/runtime`、`GET /api/datasources/drivers`
- [ ] `DELETE` drivers、connector `install-batch` / `uninstall` / `import`
- [ ] 设置页「运行环境」
- [ ] 首次启动向导
- [ ] 建连页驱动一键下载

**验收**

- 用户全程 UI 完成 connector + driver 安装，无需手动拷文件
- Playwright 覆盖：向导跳过、市场安装、建连下载驱动

### Phase 3 — JRE 可配置（约 1–2 周）

**范围**

- [ ] `config/runtime.json` + Electron `resolveJavaExecutable()` 扩展
- [ ] 设置页 JRE 模式切换与检测
- [ ] slim：JRE 按需下载（Electron 主进程）
- [ ] `GET /api/runtime/jre`

**验收**

- slim 包 + 系统 Java 17 可启动
- 或下载 JRE 后启动；切换 custom 路径生效

### Phase 4 — 企业 / 离线（按需）

**范围**

- [ ] `datawise.jdbc.maven-repo-url` 配置 UI
- [ ] 离线 zip 包（catalog + 全量 JAR）导入
- [ ] catalog 签名验证
- [ ] `headless-cli runtime` 子命令

---

## 11. 测试策略

| 层级 | 内容 |
|------|------|
| 单元测试 | `install-batch`、driver 列表/删除、catalog 解析 |
| 集成测试 | 已有 `ConnectorPluginRemoteInstallSupportTest`、`JdbcDriverLoadIntegrationTest` 扩展 |
| 前端 | `connector-market.service.test.ts` 扩展；新 `runtime.service.test.ts` |
| E2E | Playwright：向导、市场安装、设置页磁盘展示 |
| 打包 | CI 构建三种 profile 并比对 artifact 大小 |

---

## 12. 迁移与兼容

| 场景 | 行为 |
|------|------|
| 老用户升级（full → core 安装包） | 工作区 `config/plugins` **保留**，不删除已装 connector |
| 仅有 `manifest.json` 无 `runtime-catalog.json` | 后端优先读 catalog，fallback 到 manifest |
| 开发 `mvn install` | 仍复制 connector 到 `config/plugins/`（不变） |
| Web 联调模式 | 不展示向导；运行环境页仍可用（JRE 段仅桌面有效） |
| 团队服务器部署 | 不使用本设计的打包 profile；仍用 Docker + 自行挂载 `config/plugins` |

---

## 13. 决策记录（评审清单）

### 已确认 ✅

| # | 问题 | **决策** |
|---|------|---------|
| 1 | 默认发布 profile | **`core`**（4 connector + jlink JRE） |
| 2 | core 包含哪几个 connector | **mysql, postgresql, sqlite, h2** |
| 3 | 首次向导是否强制 | **可跳过**（跳过后进工作台，市场 Banner 提示待安装项） |
| 4 | 安装 connector 是否连带下载 JDBC driver | **默认是**（UI 提供取消勾选；向导与市场中均适用） |
| 5 | JRE 默认模式 | **`bundled-jlink`**（jlink 精简 JRE） |
| 6 | slim 是否对外发布 | **是**（开发者向，可选下载） |
| 7 | `manifest.json` 迁移 | **长期并存**，`runtime-catalog.json` 为主 |
| 8 | driver 删除权限 | **仅管理员** |
| 9 | 卸载 core connector | **允许，仅警告** |
| 10 | catalog 托管位置 | **GitHub Release** 随版本发布 |

---

## 14. 相关代码路径

| 模块 | 路径 |
|------|------|
| 连接器远程安装 | `datawise-connector-api/.../ConnectorPluginRemoteInstallSupport.java` |
| 连接器加载 | `datawise-connector-api/.../ConnectorPluginLoader.java` |
| 市场 API | `DatasourceCatalogService.java`、`DatasourceController.java` |
| JDBC 驱动 | `jdbc/support/JdbcDriverLoader.java`、`JdbcDriverService.java` |
| 桌面打包 | `datawise-frontend/scripts/desktop/bundle-backend.mjs`、`paths.mjs` |
| Electron 启动 | `datawise-frontend/electron/backend-service.ts` |
| 前端市场 | `features/datasource/services/connector-market.service.ts` |
| 工作区布局 | `shared/config/data-directory-layout.ts` |

---

## 15. 修订记录

| 日期 | 版本 | 说明 |
|------|------|------|
| 2026-07-21 | 0.1 | 初稿，待评审 |
| 2026-07-21 | 0.2 | 确认 #1–4：core profile、core 四库、向导可跳过、默认连带下载 driver |
| 2026-07-21 | 1.0 | 评审完成，#5–10 按建议默认确认 |
