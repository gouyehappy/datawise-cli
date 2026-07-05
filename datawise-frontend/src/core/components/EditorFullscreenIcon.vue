<script setup lang="ts">
import {DwIcon} from '@/core/icons'

withDefaults(
    defineProps<{
      active?: boolean
      size?: number
      fit?: boolean
    }>(),
    {
      fit: false,
      size: 16,
    },
)
</script>

<template>
  <DwIcon
      class="editor-fs-icon"
      name="fullscreen"
      :active="active"
      :fit="fit"
      :size="size"
  />
</template>

<style scoped>
.editor-fs-icon {
  display: block;
  flex-shrink: 0;
}
</style>
