<script setup lang="ts">
import {ContextMenuHost} from '@/core/context-menu'
import {useExplorerAddMenu} from '@/features/explorer/composables/useExplorerAddMenu'

defineProps<{
  x: number
  y: number
}>()

const emit = defineEmits<{ close: []; 'create-folder': [] }>()

const {menuItems, onMenuSelect} = useExplorerAddMenu({
  onClose: () => emit('close'),
  onCreateFolder: () => emit('create-folder'),
})
</script>

<template>
  <ContextMenuHost
      visible
      :items="menuItems"
      :x="x"
      :y="y"
      @select="onMenuSelect"
      @close="emit('close')"
  />
</template>
