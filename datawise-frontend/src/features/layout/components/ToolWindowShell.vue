<script setup lang="ts">
import {CollapseButton} from '@/core/components'

withDefaults(
    defineProps<{
      title: string
      subtitle?: string
      /** 收起按钮文案，默认 common.collapse */
      collapseLabel?: string
    }>(),
    {},
)

const emit = defineEmits<{
  collapse: []
}>()
</script>

<template>
  <section class="tool-window dw-panel-hover-chrome">
    <header class="tool-window__head">
      <div class="tool-window__head-text">
        <h3 class="tool-window__title">{{ title }}</h3>
        <p v-if="subtitle" class="tool-window__subtitle">{{ subtitle }}</p>
      </div>
      <div class="tool-window__head-actions dw-panel-hover-actions">
        <slot name="head-actions"/>
        <CollapseButton :label="collapseLabel" @click="emit('collapse')"/>
      </div>
    </header>
    <div class="tool-window__body">
      <slot/>
    </div>
  </section>
</template>
