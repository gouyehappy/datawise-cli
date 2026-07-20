# DataWise 界面截图清单

> 由 `npm run capture:demos --prefix datawise-frontend` 自动生成（Mock API，无需后端）。

| 文件 | 标题 | 图中信息说明 |
|------|------|--------------|
| `01-dashboard.png` | 仪表盘 | 工作台概览：顶部可进入数据库/AI；中间为运行指标与快捷操作；左下连接状态；右侧当前工作区与已启用插件。 |
| `02-explorer.png` | 资源树与命令面板 | 左侧连接树已展开至 AI 能力入口；中间为工作区；叠加命令面板（Ctrl+K）可搜索模块、书签与对象。 |
| `03-sql-console.png` | SQL 控制台 | 上方为 Monaco 编辑器与执行按钮；下方为结果网格（已执行 SELECT 1）；可继续导出、格式化或唤起 AI。 |
| `04-ai-analysis.png` | AI 分析 | AI 工作台：中央对话与分析进度/结果；可配置模型与数据范围；完成后可将 SQL 打开到控制台或保存为画布。 |
| `05-plugins.png` | 插件中心 | 插件中心列出已安装能力卡片（AI、导出、格式化等）；可搜索、启停，并进入连接器/开发者相关入口。 |
| `06-settings-basic.png` | 设置 · 基础设置 | 设置页左侧为分组导航；基础设置含语言、主题外观与皮肤等个人偏好。快捷键 Ctrl+, 打开。 |
| `07-settings-layout.png` | 设置 · 界面布局 | 控制导航栏、工具栏、右侧栏显隐，并提供工作台预览，与顶栏「配置」快捷开关一致。 |
| `08-settings-connection-health.png` | 设置 · 连接健康 | 配置连接探测间隔、异常告警与监视列表；与仪表盘「连接状态」联动，异常时写入通知抽屉。 |
| `09-settings-ai.png` | 设置 · AI 模型 | 配置 AI Provider、密钥与默认模型；是 AI 聊天、Text-to-SQL 与分析画布的前提。 |
| `10-platform-canvas.png` | 平台 · 分析画布 | 从资源树「AI → 分析画布」打开目录 Tab；可查看已保存画布、参数个数，并重新运行或打开到控制台。 |
| `11-platform-federated.png` | 平台 · 联邦视图 | 联邦视图目录：跨源虚拟视图列表；可新建向导、执行查询（注意行数边界）或 AI 生成跨源 SQL。 |
| `12-platform-drift.png` | 平台 · Schema 漂移 | 结构漂移监控列表：源/目标库、表模式、漂移数量与上次检查时间；可运行对比并打开迁移向导。 |
| `13-connection-form.png` | 新建连接 | 新建数据源流程：选择类型后填写基本信息、主机端口、认证，可选 SSH/驱动；先「测试连接」再保存。 |

重新生成：

```bash
npm run capture:demos --prefix datawise-frontend
```
