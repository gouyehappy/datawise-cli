<script setup lang="ts">
import type {WorkspaceTabType} from '@/core/types'
import {DwIcon, workspaceTabDwIcon} from '@/core/icons'

defineProps<{
  type: WorkspaceTabType
}>()
</script>

<template>
  <span class="dw-tab__icon" aria-hidden="true">
    <DwIcon :name="workspaceTabDwIcon(type)" size="tab" :stroke-width="1.4"/>
  </span>
</template>
