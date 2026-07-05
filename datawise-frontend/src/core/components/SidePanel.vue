<script setup lang="ts">
withDefaults(
    defineProps<{
      title: string
      subtitle?: string
      border?: 'left' | 'right' | 'none'
    }>(),
    {border: 'right'},
)
</script>

<template>
  <aside
      class="dw-side-panel"
      :class="{
      'dw-side-panel--border-left': border === 'left',
      'dw-side-panel--border-right': border === 'right',
    }"
  >
    <header v-if="title || $slots.head" class="dw-side-panel__head">
      <slot name="head">
        <div>
          <h2>{{ title }}</h2>
          <p v-if="subtitle">{{ subtitle }}</p>
        </div>
      </slot>
      <slot name="badge"/>
    </header>

    <div v-if="$slots.toolbar" class="dw-side-panel__toolbar">
      <slot name="toolbar"/>
    </div>

    <div class="dw-side-panel__body">
      <slot/>
    </div>
  </aside>
</template>
