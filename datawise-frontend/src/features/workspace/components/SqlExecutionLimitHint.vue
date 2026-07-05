<script setup lang="ts">
import {useSqlExecutionLimitHint} from '@/features/workspace/composables/useSqlExecutionLimitHint'

const {label, compactLabel, hint} = useSqlExecutionLimitHint()
</script>

<template>
  <span class="sql-exec-limit" :title="`${label} · ${hint}`">
    <span class="sql-exec-limit__value">{{ compactLabel }}</span>
  </span>
</template>

<style scoped>
.sql-exec-limit {
  display: inline-flex;
  align-items: center;
  flex-shrink: 0;
  height: var(--dw-console-btn-size);
  padding: 0 4px;
  color: var(--dw-text-muted);
  font-family: var(--dw-font-mono, ui-monospace, monospace);
  font-size: 10px;
  font-weight: 600;
  line-height: 1;
  white-space: nowrap;
}

.sql-exec-limit__value {
  letter-spacing: 0.02em;
}
</style>
