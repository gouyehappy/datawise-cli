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
  box-shadow: 0 2px 8px color-mix(in srgb, var(--dw-primary) 28%, transparent),
  var(--dw-shadow-xs);
  transition: transform var(--dw-duration) var(--dw-ease), box-shadow 0.15s ease;
}

.app-brand-logo :deep(svg) {
  display: block;
  width: 100%;
  height: 100%;
  shape-rendering: geometricPrecision;
}

.app-brand-logo--xs {
  width: var(--dw-icon-size-md);
  height: var(--dw-icon-size-md);
  box-shadow: none;
}

.app-brand-logo--titlebar {
  width: 28px;
  height: var(--dw-btn-height);
  box-shadow: 0 1px 4px color-mix(in srgb, var(--dw-primary) 18%, transparent);
}

.app-brand-logo--sm {
  width: 28px;
  height: var(--dw-btn-height);
}

.app-brand-logo--md {
  width: 40px;
  height: 40px;
  box-shadow: 0 6px 16px color-mix(in srgb, var(--dw-primary) 32%, transparent),
  var(--dw-shadow-xs);
}

.app-brand-logo--lg {
  width: 56px;
  height: 56px;
  box-shadow: 0 10px 24px color-mix(in srgb, var(--dw-primary) 32%, transparent),
  var(--dw-shadow-sm);
}
</style>
