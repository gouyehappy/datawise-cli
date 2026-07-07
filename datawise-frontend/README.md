# DataWise Frontend

Vue 3 + TypeScript 客户端（浏览器 / Electron）。

## 快速开始

```powershell
cd datawise-frontend
npm install
npm run dev          # http://localhost:28413
npm run dev:electron # 桌面版
npm run typecheck
```

联调见 [docs/README.md](../docs/README.md) 与 `.env.development.example`。

## Electron 打包（Windows）

```powershell
npm run dist:electron   # 仅打包前端 + Electron（不含 JRE/后端 JAR，需本机已有后端在 18421）
npm run dist:desktop    # 推荐安装包：内嵌后端 + JRE（需 JAVA_HOME 与 Maven）
npm run dist:electron:full  # 同 dist:desktop
```

产物在 `release/`。配置目录：便携版为 exe 同目录 `config/`；安装版为 `%APPDATA%\DataWise CLI\config`。

图标资源见 [build/README.md](./build/README.md)。

## 技术栈

Vue 3 · Pinia · Vite · Monaco · vue-i18n · Electron · `@datawise/sql-editor`
