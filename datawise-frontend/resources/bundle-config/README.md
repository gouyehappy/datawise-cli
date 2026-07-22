# Desktop 默认工作区模板（打包种子）

本目录是**入库的默认配置源**，首次创建工作区时会整份复制过去。

## 打包链路

```
resources/bundle-config/          ← 本目录（源，纳入 Git）
        │  npm run prepare:desktop / bundle-backend.mjs
        ▼
resources/desktop/config-bundle/  ← 构建产物（gitignore，可含 plugins/drivers）
        │  electron-builder extraResources
        ▼
安装包 resources/config-bundle/
        │  首次启动 bootstrapConfigDirectory()
        ▼
用户工作区（默认 %APPDATA%/datawise-cli/workspaces，或 desktop-preferences.json 的 configDir）
```

## 目录内容

| 路径 | 说明 |
|------|------|
| `users.json` | 默认账号：admin / demo（bcrypt 与 `config/users.json.example` 一致）+ guest |
| `workspace.xml` | 脚本根目录等全局工作区设置 |
| `teams.json` | 根目录 legacy 空快照（兼容旧修复逻辑；运行时以租户文件为准） |
| `tenants/index.json` | 默认租户索引 |
| `tenants/default/connections.xml` | 空连接目录 |
| `tenants/default/teams.json` | 空团队快照 |
| `tenants/default/oidc.json` | 本地登录（OIDC 关闭） |
| `tenants/default/roles.json` | 空；启动时由 TenantBootstrap 写入系统角色 |
| `tenants/default/memberships.json` | 空；启动时为注册用户补 membership |
| `tenants/default/sql-snippets.shared.xml` | 空团队共享片段 |
| `api-tokens.example.json` | API Token 示例（勿当作正式 `api-tokens.json`） |
| `plugins/` / `drivers/` / `scripts/` | 占位目录；打包时由 bundle-backend 注入 JAR |

## 不要放进本目录的内容

- `sessions.json`、`.datawise-master-key`、运行日志
- JDBC 驱动 JAR、connector 插件 JAR（打包时从仓库 `config/plugins|drivers` 注入）
- 个人连接账号密码、真实 `api-tokens.json`

## 开发态

未打包时 Electron 同样以本目录为种子（不再用仓库根 `config/`，避免开发脏数据进新工作区）。
