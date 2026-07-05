<script setup lang="ts">
import {DwIcon} from '@/core/icons'
import type {DwIconName} from '@/core/icons'

withDefaults(
    defineProps<{
      name: DwIconName
      size?: number
      fit?: boolean
      title?: string
    }>(),
    {
      size: 15,
      fit: false,
    },
)
</script>

<template>
  <DwIcon :name="name" :size="size" :fit="fit" :title="title"/>
</template>
