<script setup lang="ts">
import brandLogoUrl from '@/assets/brand-logo.svg'

withDefaults(
    defineProps<{
      size?: 'xs' | 'sm' | 'md' | 'lg' | 'titlebar'
    }>(),
    {size: 'sm'},
)
</script>

<template>
  <span class="app-brand-logo" :class="`app-brand-logo--${size}`" aria-hidden="true">
    <img :src="brandLogoUrl" alt="" draggable="false"/>
  </span>
</template>

<style scoped>
.app-brand-logo {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  border-radius: 10px;
  box-shadow: 0 2px 8px rgba(99, 102, 241, 0.28),
  0 1px 2px rgba(15, 23, 42, 0.08);
  transition: transform 0.15s ease, box-shadow 0.15s ease;
}

.app-brand-logo img {
  display: block;
  width: 100%;
  height: 100%;
}

.app-brand-logo--xs {
  width: 16px;
  height: 16px;
  border-radius: 4px;
  box-shadow: none;
}

.app-brand-logo--titlebar {
  width: 23px;
  height: 23px;
  border-radius: 6px;
  box-shadow: 0 1px 4px rgba(99, 102, 241, 0.22);
}

.app-brand-logo--sm {
  width: 28px;
  height: 28px;
}

.app-brand-logo--md {
  width: 40px;
  height: 40px;
  border-radius: 12px;
  box-shadow: 0 6px 16px rgba(99, 102, 241, 0.32),
  0 2px 4px rgba(15, 23, 42, 0.08);
}

.app-brand-logo--lg {
  width: 56px;
  height: 56px;
  border-radius: 16px;
  box-shadow: 0 10px 24px rgba(124, 58, 237, 0.32),
  0 2px 6px rgba(15, 23, 42, 0.1);
}
</style>
