# @datawise/sql-editor

可嵌入的 **SQL 编辑器组件**（Vue 3 + Monaco）：Schema 感知补全、片段与多方言支持。

![演示](docs/demo.gif)

## 特性

- 语法驱动补全（表、列、JOIN 提示、关键字）
- Schema 感知与外键 JOIN 一行生成
- 片段与快捷芯片（`selj`、`lf`、`grp` 等）
- 多方言关键字与格式化（MySQL、PostgreSQL、Flink、Hive 等）
- 独立 Runtime，宿主注入 Schema / 方言 / 片段配置

## 安装

```bash
npm install @datawise/sql-editor vue monaco-editor sql-formatter
```

Monorepo 本地引用：

```json
"@datawise/sql-editor": "file:../sql-editor"
```

## 快速开始

```vue
<script setup lang="ts">
import { ref } from 'vue'
import { SqlEditor } from '@datawise/sql-editor'

const sql = ref('SELECT 1')
</script>

<template>
  <SqlEditor v-model="sql" dialect="mysql" />
</template>
```

## 独立 Demo

```bash
npm install && npm run dev   # http://localhost:5175
```

## 子路径导出

| 导入 | 用途 |
|------|------|
| `@datawise/sql-editor` | 组件、插件、Runtime |
| `@datawise/sql-editor/completion` | 补全 grammar、provider |
| `@datawise/sql-editor/sql-parser` | 解析 / 校验 |
| `@datawise/sql-editor/types` | TypeScript 类型 |

## 开发

```bash
npm run typecheck
npm test
npm run build
```

## License

MIT
