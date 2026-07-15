<script setup lang="ts">
import type {ContextMenuIcon} from '@/core/types'
import {DwIcon} from '@/core/icons'
import type {DwIconName} from '@/core/icons'

defineProps<{
  name?: ContextMenuIcon
  danger?: boolean
}>()
</script>

<template>
  <DwIcon
      v-if="name"
      class="dw-ctx-menu__icon"
      :name="name as DwIconName"
      :danger="danger"
      :filled="name === 'run'"
      size="sm"
      :stroke-width="1.6"
  />
</template>

<style scoped>
:deep(.dw-icon-root) {
  width: var(--dw-icon-size-lg);
  height: var(--dw-icon-size-lg);
  color: var(--dw-text-muted);
}

:deep(.dw-icon-root.dw-icon--danger) {
  color: var(--dw-danger);
}
</style>
