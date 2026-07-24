# 01 · 快速开始

## 1.1 产品定位

DataWise 不是单纯的 JDBC 图形客户端，而是团队数据工作台：在统一界面完成连接管理、Schema 浏览、可治理 SQL、AI 分析、联邦查询、迁移与审批。

适用角色：

| 角色 | 典型用法 |
|------|----------|
| 数据分析师 | AI 提问、仪表盘、结果导出、洞察分享 |
| 数据开发 | SQL 控制台、可视化查询、联邦视图、迁移 |
| DBA / 平台 | 连接健康、Schema 漂移、数据质量门禁、审计 |
| 团队管理员 | 共享连接、权限、审批、租户与配额 |

## 1.2 环境要求

| 组件 | 要求 |
|------|------|
| Node.js | 18+ |
| JDK | 17+ |
| Maven | 3.9+ |
| 操作系统 | Windows / macOS / Linux（桌面包见第 12 章） |

## 1.3 本地启动（Web 联调）

### 步骤 1：准备配置

```bash
cp config/connections.xml.example config/connections.xml
cp config/users.json.example config/users.json
```

将 Connector JAR 放入 `config/plugins/`，JDBC 驱动放入 `config/drivers/`。说明见 [config/README.md](../../config/README.md)。

### 步骤 2：启动后端

```bash
cd datawise-backend
mvn spring-boot:run -pl datawise-server -am
# → http://localhost:18421  （GET /api/health）
```

### 步骤 3：构建 SQL 编辑器（首次）

```bash
cd sql-editor && npm install && npm run build
```

### 步骤 4：启动前端

```bash
cd datawise-frontend
cp .env.development.example .env.development   # 首次
npm install && npm run dev
# → http://localhost:28413
```

默认端口：

| 环境 | 后端 | 前端 |
|------|------|------|
| 开发 | `18421` | `28413` |
| 桌面 | `18423` | JCEF 内嵌 |

## 1.4 首次进入（照着做）

1. 浏览器打开前端地址，等待启动页结束。
2. 若出现 **新手指引**：可体验「选表 → AI 提问 → 保存洞察」，或点 **跳过**。
3. 打开 **仪表盘**（截图如下），点 **进入数据库**。
4. 资源树点 **新建数据源** → 选类型 → 填主机账号 → **测试连接** → 保存（详见 [第 3 章](./03-connections-explorer.md)，表单截图 `13-connection-form.png`）。
5. 点连接左侧 **箭头** 展开（不要双击数据库名——双击会打开 SQL 编辑器）。
6. 双击一张表看数据，或右键库 → **SQL 控制台** 执行 `SELECT 1`。
7. （可选）库右键 → **查看所有表** → AI 打标 → 顶栏 **AI** 提问（[第 5.9](./05-table-data.md) / [第 6 章](./06-ai-analysis.md)）。

![仪表盘](../assets/screenshots/01-dashboard.png)

**图中信息：** 顶部「进入数据库 / 打开 AI」；中间快捷操作含新建控制台、AI 分析；左下连接状态。完整链路：新建连接 → 资源树 → SQL → AI / 画布 → 分享与定时。

## 1.5 登录与账号

- 本地默认用户配置在 `config/users.json`（勿提交真实密钥）。
- 企业环境可启用 **OIDC SSO**（Authorization Code + PKCE），由管理员在集成设置中配置。
- 访客模式部分写操作（如测试连接）不可用，请登录后再操作。

## 1.6 桌面版快速打包

```bash
cd datawise-frontend
npm run dist:desktop    # 需要 JAVA_HOME + Maven；在目标 OS 上执行
# → datawise-frontend/release/DataWiseCLI-*-{windows|linux|macos}-*.zip
```

macOS / Linux 说明见 [DESKTOP_MAC.md](../DESKTOP_MAC.md)、[DESKTOP_LINUX.md](../DESKTOP_LINUX.md)。

## 1.7 常见启动问题

| 现象 | 处理 |
|------|------|
| 前端 API 404 / 代理失败 | 确认后端已启动；检查 `VITE_API_BASE_URL` 与 `runtime-ports.json` |
| 连接提示缺少驱动 | 在连接表单填写 Maven 坐标并下载，或手动放入 `config/drivers/` |
| 某类数据库不在树中 | 安装对应 Connector 插件并启用 Explorer 插件（见第 11 章） |
| AI 不可用 | 在 **设置 → AI 模型** 配置 Provider / API Key |

## 下一章

→ [02 · 界面总览](./02-interface.md)
