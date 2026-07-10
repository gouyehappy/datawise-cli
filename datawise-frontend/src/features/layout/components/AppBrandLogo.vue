<script setup lang="ts">
import brandLogoSvg from '@/assets/brand-logo.svg?raw'

withDefaults(
    defineProps<{
      size?: 'xs' | 'sm' | 'md' | 'lg' | 'titlebar'
    }>(),
    {size: 'sm'},
)
</script>

<template>
  <span
      class="app-brand-logo"
      :class="`app-brand-logo--${size}`"
      aria-hidden="true"
      v-html="brandLogoSvg"
  />
</template>

<style scoped>
.app-brand-logo {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  border-radius: 50%;
  box-shadow: 0 2px 8px rgba(99, 102, 241, 0.28),
  0 1px 2px rgba(15, 23, 42, 0.08);
  transition: transform 0.15s ease, box-shadow 0.15s ease;
}

.app-brand-logo :deep(svg) {
  display: block;
  width: 100%;
  height: 100%;
  shape-rendering: geometricPrecision;
}

.app-brand-logo--xs {
  width: 16px;
  height: 16px;
  box-shadow: none;
}

.app-brand-logo--titlebar {
  width: 28px;
  height: 28px;
  box-shadow: 0 1px 4px rgba(99, 102, 241, 0.18);
}

.app-brand-logo--sm {
  width: 28px;
  height: 28px;
}

.app-brand-logo--md {
  width: 40px;
  height: 40px;
  box-shadow: 0 6px 16px rgba(99, 102, 241, 0.32),
  0 2px 4px rgba(15, 23, 42, 0.08);
}

.app-brand-logo--lg {
  width: 56px;
  height: 56px;
  box-shadow: 0 10px 24px rgba(124, 58, 237, 0.32),
  0 2px 6px rgba(15, 23, 42, 0.1);
}
</style>
