# @datawise/sql-editor

Embeddable **SQL editor** for Vue 3 + Monaco — schema-aware completion, snippets, and multi-dialect support.

![Demo](docs/demo.gif)

## Features

- Grammar-driven completion (tables, columns, JOIN hints, keywords)
- Schema-aware IntelliSense and FK-aware JOIN lines
- Snippets and quick chips (`selj`, `lf`, `grp`, …)
- Multi-dialect keywords and formatting (MySQL, PostgreSQL, Flink, Hive, …)
- Embeddable runtime: host supplies schema, dialect, and snippet layers

## Install

```bash
npm install @datawise/sql-editor vue monaco-editor sql-formatter
```

Monorepo:

```json
"@datawise/sql-editor": "file:../sql-editor"
```

## Quick start

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

## Demo

```bash
npm install && npm run dev   # http://localhost:5175
```

## Exports

| Import | Purpose |
|--------|---------|
| `@datawise/sql-editor` | Components, plugin, runtime |
| `@datawise/sql-editor/completion` | Grammar, snapshot, provider |
| `@datawise/sql-editor/sql-parser` | Parse / validate |
| `@datawise/sql-editor/types` | TypeScript types |

## Development

```bash
npm run typecheck
npm test
npm run build
```

## License

MIT
