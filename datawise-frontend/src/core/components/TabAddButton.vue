<script setup lang="ts">
import PlusIcon from '@/core/components/PlusIcon.vue'

defineProps<{
  title: string
}>()

const emit = defineEmits<{
  click: []
}>()
</script>

<template>
  <button class="dw-tab-add" :title="title" type="button" @click="emit('click')">
    <PlusIcon :size="13"/>
  </button>
</template>
