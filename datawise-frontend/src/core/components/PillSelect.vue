<script setup lang="ts">
import {computed} from 'vue'
import DwSelect from '@/core/components/DwSelect.vue'

const props = withDefaults(
    defineProps<{
      options: string[]
      size?: 'default' | 'compact'
      menuMinWidth?: string
    }>(),
    {size: 'default'},
)

const model = defineModel<string>({required: true})

const selectOptions = computed(() =>
    props.options.map((option) => ({value: option, label: option})),
)

const dwSize = computed(() => (props.size === 'compact' ? 'compact' : 'pill'))
</script>

<template>
  <DwSelect v-model="model" :options="selectOptions" :size="dwSize" :menu-min-width="menuMinWidth"/>
</template>
