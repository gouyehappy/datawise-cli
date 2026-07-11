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
npm run dist:desktop        # 推荐：内嵌后端 + JRE，生成 NSIS 安装包与便携版
npm run dist:desktop:clean  # 全量重建（清理前后端产物 + mvn clean）
npm run pack:desktop        # 仅生成 release/win-unpacked/ 目录，便于快速测试
npm run prepare:desktop     # 只打包后端资源到 resources/desktop/（不构建 Electron）
```

产物在 `release/`。配置目录：便携版为 exe 同目录 `config/`；安装版为 `%APPDATA%\DataWise CLI\config`。

脚本说明见 [scripts/desktop/README.md](./scripts/desktop/README.md)。

图标资源见 [build/README.md](./build/README.md)。

## 技术栈

Vue 3 · Pinia · Vite · Monaco · vue-i18n · Electron · `@datawise/sql-editor`
