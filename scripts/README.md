# 脚本

## pre-commit-check

读 `scripts/project-config.json`

```bash
node scripts/pre-commit-check.mjs
node scripts/pre-commit-check.mjs --test
node scripts/pre-commit-check.mjs --full
```

实现：`scripts/sop/pre-commit-check.mjs`

## 本地前后端联调

从 `datawise-frontend` 目录：

```bash
npm run dev:all     # node ../scripts/dev-start.mjs
npm run stop:dev    # node ../scripts/dev-stop.mjs
```

也可直接：

```bash
node scripts/dev-start.mjs
node scripts/dev-stop.mjs
```

## 品牌图标 path 提取

手动从 `.tmp-icons/` 重新生成品牌 SVG path（少用）：

```bash
node scripts/extract-brand-icon-paths.mjs
```

## 桌面打包

见 [`datawise-frontend/scripts/desktop/README.md`](../datawise-frontend/scripts/desktop/README.md)。
