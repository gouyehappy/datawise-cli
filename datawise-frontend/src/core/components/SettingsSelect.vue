<script setup lang="ts">
import DwSelect from '@/core/components/DwSelect.vue'
import type {SelectOption} from '@/core/components/select.types'

export type {SelectOption}

withDefaults(
    defineProps<{
      options: SelectOption[]
      id?: string
      useOptionFont?: boolean
      size?: 'default' | 'sm'
      disabled?: boolean
      placeholder?: string
    }>(),
    {size: 'default'},
)

const model = defineModel<string>({required: true})
</script>

<template>
  <DwSelect
      :id="id"
      v-model="model"
      :options="options"
      :use-option-font="useOptionFont"
      :size="size"
      :disabled="disabled"
      :placeholder="placeholder"
  />
</template>
