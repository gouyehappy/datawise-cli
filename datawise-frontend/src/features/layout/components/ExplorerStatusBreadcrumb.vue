<script setup lang="ts">
import AppBrandLogo from '@/features/layout/components/AppBrandLogo.vue'
import {DwIcon} from '@/core/icons'
import {useExplorerStatusPath} from '@/features/explorer/composables/useExplorerStatusPath'

const {segments, hasPath} = useExplorerStatusPath()
</script>

<template>
  <nav
      v-if="hasPath"
      class="explorer-status-path"
      :aria-label="$t('explorer.statusPath.label')"
  >
    <AppBrandLogo size="xs" class="explorer-status-path__brand"/>
    <template v-for="segment in segments" :key="segment.id">
      <span class="explorer-status-path__sep" aria-hidden="true">&gt;</span>
      <span
          class="explorer-status-path__segment"
          :class="`explorer-status-path__segment--${segment.kind}`"
          :title="segment.label"
      >
        <DwIcon
            v-if="segment.kind === 'database'"
            class="explorer-status-path__db-icon"
            name="database"
            size="xs"
            :stroke-width="1.6"
        />
        {{ segment.label }}
      </span>
    </template>
  </nav>
</template>

<style scoped>
.explorer-status-path {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  min-width: 0;
  flex: 1;
  overflow: hidden;
  color: var(--dw-text-secondary);
  font-size: 11px;
  line-height: 1.2;
}

.explorer-status-path__brand {
  flex-shrink: 0;
}

.explorer-status-path__sep {
  flex-shrink: 0;
  color: var(--dw-text-muted);
  font-size: 10px;
  opacity: 0.72;
}

.explorer-status-path__segment {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  flex-shrink: 1;
}

.explorer-status-path__segment--connection {
  color: var(--dw-text);
  font-weight: 500;
}

.explorer-status-path__segment--database {
  color: var(--dw-text);
  font-weight: 500;
}

.explorer-status-path__segment--schema,
.explorer-status-path__segment--object {
  color: var(--dw-text-secondary);
}

.explorer-status-path__db-icon {
  flex-shrink: 0;
  color: #16a34a;
}

[data-theme='dark'] .explorer-status-path__db-icon {
  color: #4ade80;
}
</style>
