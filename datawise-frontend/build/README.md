# Application icons

All icons use the same artwork as the Home menu brand logo (`src/assets/brand-logo.svg`).

| File | Purpose |
|------|---------|
| `../src/assets/brand-logo.svg` | Source SVG (AppBrandLogo, title bar) |
| `icon.png` | Electron runtime / macOS master (1024×1024) |
| `icon.ico` | Windows exe、安装包、托盘（多尺寸） |
| `../public/favicon.png` | Browser tab favicon (32×32) |

Regenerate after editing the SVG:

```bash
npm run gen:icons
```

Windows 打包时 `signAndEditExecutable: false` 不会自动写入 exe 图标；`scripts/embed-win-icon.cjs` 在 afterPack 阶段用 rcedit 嵌入 `icon.ico`。

Then rebuild: `npm run dist:desktop`
