# DataWise CLI 性能优化记录

> 更新：2026-07-11

本文档记录已识别与已落地的性能优化项，便于后续迭代与回归验证。

## 状态说明

| 状态 | 含义 |
|------|------|
| ✅ 已落地 | 代码已合并到主分支工作区 |
| 🔜 待做 | 已评估、尚未实现 |
| ⏸ 暂缓 | 收益/成本比低或需更大重构 |

---

## 第一期（已落地）

### 1. Grid 筛选防抖 ✅

- **文件**：`useDwDataGridState.ts`、`DataGrid.vue`
- **改动**：筛选输入 180ms 防抖后再触发 filter/sort，避免大结果集每键全量重算

### 2. useDwDataGridState 小优化 ✅

- **文件**：`useDwDataGridState.ts`
- **改动**：无筛选时返回原数组引用；选中行校验去掉 O(n) join

### 3. maxResultRows 默认值 ✅

- **文件**：`editor-presets.ts`
- **改动**：默认从 `0` 改为 `5000`

### 4. Vite manualChunks 拆包 ✅

- **文件**：`vite.config.ts`
- **改动**：独立 chunk：`monaco`、`echarts`、`spreadsheet`

### 5. Workspace Tab 懒加载 ✅

- **文件**：`tab-registry.ts`

### 6. Monaco / SqlEditor 延迟安装 ✅

- **文件**：`ensure-sql-editor-plugin.ts`、`main.ts`、SQL 相关 Tab 与设置面板

### 7. KeepAlive 策略 ✅

- **文件**：`WorkspaceArea.vue`
- **改动**：`max=5`；`exclude=['SqlConsoleTab']` 排除 SQL 控制台缓存（KeepAlive 容器常驻，避免切到控制台时清空其它 Tab 缓存）
- **补充**：`SqlConsoleTab.vue` 增加 `defineOptions({ name: 'SqlConsoleTab' })` 确保 exclude 生效

### 6b. SqlEditor Runtime 复用 ✅（回归修复）

- **文件**：`ensure-sql-editor-plugin.ts`
- **问题**：延迟安装若创建新 runtime，会与 `app-config` 启动时绑定的片段/设置 controller 脱节
- **修复**：`installSqlEditorPlugin({ runtime: getDefaultSqlEditorRuntime() })` 复用已有实例

### 8. Excel 导出动态 import ✅

- **文件**：`grid-xlsx.service.ts`

### 9. ECharts 渲染优化 ✅

- **文件**：`AiAnalysisChart.vue`

### 10. Schema 补全预加载并发限制 ✅

- **文件**：`sql-schema-loader.ts`

### 11. 游标加载行数提示 ✅

- **文件**：`query-result-limits.ts`、`DataGrid.vue`

---

### 12. DataGrid 行虚拟滚动 ✅

- **文件**：`useGridVirtualWindow.ts`、`DataGrid.vue`、`DwDataGrid.vue`
- **策略**：固定行高 30px；当前页 ≥80 行启用；`wrapCells` 时退化为全量渲染
- **覆盖**：SQL 结果网格（DataGrid）、Schema 表列表等 DwDataGrid 场景

### 13. 游标结果滑动窗口 ✅

- **文件**：`query-result-limits.ts`、`query-result-cursor.service.ts`、`useTableDataView.ts`、`useViewModelDataView.ts`、`DataGrid.vue`
- **策略**：内存最多保留 `CURSOR_LOADED_ROWS_MAX`（15_000）行；超出时 FIFO 丢弃最早批次
- **UI**：`cursorTrimmedRows` 顺延行号；工具栏提示已丢弃行数

### 14. settings-section-registry 懒加载 ✅

- **文件**：`settings-section-registry.ts`
- **改动**：各设置面板 `defineAsyncComponent` 按需加载

### 15. 生产环境可选 Perf 模式 ✅

- **文件**：`production-perf-mode.service.ts`、`perf-diagnostics.service.ts`、`query-limit.service.ts`、`perf-log.ts`、`EditorSettingsPanel.vue`
- **策略**：设置项 `productionPerfMode`（默认开启）；仅对标记为「生产」的连接生效
- **收紧**：单次返回行数上限 2000、游标内存窗口 8000（低于全局 15000）
- **诊断**：正式版对生产连接输出 `[PERF]` 控制台日志（开发版始终开启）

---

## 第二期（待做）

_暂无_

---

## 已有性能基建

- Explorer 树虚拟滚动、ETag、请求去重、搜索防抖
- SQL 游标分页、HikariCP、fetchSize 调优
- SQL 补全 Worker、增量 lexer、LRU 缓存
