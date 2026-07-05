<script setup lang="ts">
import {DwIcon} from '@/core/icons'

withDefaults(
    defineProps<{ size?: number }>(),
    {size: 11},
)
</script>

<template>
  <DwIcon name="x" :size="size" :stroke-width="1.5"/>
</template>
