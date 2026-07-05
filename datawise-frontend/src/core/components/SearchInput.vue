<script setup lang="ts">
import {DwIcon} from '@/core/icons'

const model = defineModel<string>({required: true})

withDefaults(
    defineProps<{
      placeholder?: string
      id?: string
      size?: 'default' | 'sm'
    }>(),
    {size: 'default'},
)
</script>

<template>
  <label class="dw-search" :class="{ 'dw-search--sm': size === 'sm' }">
    <DwIcon name="search" :size="size === 'sm' ? 'sm' : 'md'" :stroke-width="1.5"/>
    <input :id="id" v-model="model" type="search" :placeholder="placeholder"/>
    <slot name="suffix"/>
  </label>
</template>

<style scoped>
.dw-search--sm {
  height: 32px;
  border-radius: 8px;
}
</style>
