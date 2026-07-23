# Application icons

应用图标与首页品牌 Logo 同源：`src/assets/brand-logo.svg`。

---

## 文件

| 文件 | 用途 |
|------|------|
| `../src/assets/brand-logo.svg` | 源 SVG（AppBrandLogo、标题栏） |
| `icon.png` | Electron / macOS 主图（1024×1024） |
| `icon.ico` | Windows exe、安装包、托盘（多尺寸） |
| `../public/favicon.png` | 浏览器标签页（32×32） |

---

## 重新生成

修改 SVG 后：

```bash
npm run gen:icons
```

Windows 打包时 `signAndEditExecutable: false` 不会自动写入 exe 图标；`scripts/embed-win-icon.cjs` 在 afterPack 阶段用 rcedit 嵌入 `icon.ico`。

然后重新打桌面包：

```bash
npm run dist:desktop
```
