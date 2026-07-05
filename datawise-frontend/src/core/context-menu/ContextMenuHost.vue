<script setup lang="ts">
import {Teleport} from 'vue'
import ContextMenu from './ContextMenu.vue'
import type {ContextMenuItem} from '@/core/types'

defineProps<{
  visible: boolean
  items: ContextMenuItem[]
  x: number
  y: number
  title?: string
}>()

const emit = defineEmits<{
  select: [id: string]
  close: []
}>()
</script>

<template>
  <Teleport to="body">
    <ContextMenu
        v-if="visible"
        :items="items"
        :x="x"
        :y="y"
        :title="title"
        @select="emit('select', $event)"
        @close="emit('close')"
    />
  </Teleport>
</template>
