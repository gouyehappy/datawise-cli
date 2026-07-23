# 仓库脚本

根目录 `scripts/` — 联调、提交检查与少量工具脚本。桌面打包脚本在前端目录。

---

## 提交前检查

读取 `scripts/project-config.json`，实现位于 `scripts/sop/pre-commit-check.mjs`。

```bash
node scripts/pre-commit-check.mjs        # 默认检查
node scripts/pre-commit-check.mjs --test # 含测试
node scripts/pre-commit-check.mjs --full # 全量
```

---

## 本地前后端联调

在 `datawise-frontend` 下：

```bash
npm run dev:all     # → node ../scripts/dev-start.mjs
npm run stop:dev    # → node ../scripts/dev-stop.mjs
```

或直接：

```bash
node scripts/dev-start.mjs
node scripts/dev-stop.mjs
```

默认端口：前端 `28413` · 后端 `18421`。

---

## OpenAPI 导出

后端已启动时：

```bash
node scripts/export-openapi.mjs
```

说明：[../docs/OPENAPI.md](../docs/OPENAPI.md)

---

## 品牌图标 path

从 `.tmp-icons/` 重新提取品牌 SVG path（少用）：

```bash
node scripts/extract-brand-icon-paths.mjs
```

---

## 桌面打包

见 [`datawise-frontend/scripts/desktop/README.md`](../datawise-frontend/scripts/desktop/README.md)。
