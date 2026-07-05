<script setup lang="ts">
defineProps<{
  label: string
  caption?: string
  active: boolean
}>()

const emit = defineEmits<{ toggle: [] }>()
</script>

<template>
  <button
      class="layout-toggle"
      :class="{ active }"
      type="button"
      :aria-pressed="active"
      @click="emit('toggle')"
  >
    <span class="layout-toggle__text">
      <strong>{{ label }}</strong>
      <span v-if="caption" class="layout-toggle__caption">{{ caption }}</span>
    </span>
    <span class="layout-toggle__track" aria-hidden="true">
      <span class="layout-toggle__thumb"/>
    </span>
  </button>
</template>

<style scoped>
.layout-toggle {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: clamp(10px, 1.2vmin, 12px);
  width: 100%;
  padding: clamp(8px, 1vmin, 10px) clamp(10px, 1.2vmin, 12px);
  border: 1px solid var(--dw-border-light);
  border-radius: var(--dw-panel-radius);
  background: var(--dw-bg-panel);
  text-align: left;
  cursor: pointer;
  transition: border-color 0.15s ease,
  background 0.15s ease,
  box-shadow 0.15s ease,
  transform 0.12s ease;
}

.layout-toggle:hover {
  border-color: color-mix(in srgb, var(--dw-primary) 30%, var(--dw-border));
  background: var(--dw-bg-hover);
}

.layout-toggle.active {
  border-color: var(--dw-primary-border);
  background: var(--dw-primary-softer);
  box-shadow: inset 0 0 0 1px var(--dw-primary-ring);
}

.layout-toggle__text {
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
}

.layout-toggle__text strong {
  font-size: var(--mp-sub);
  font-weight: 600;
  color: var(--dw-text);
}

.layout-toggle__caption {
  color: var(--dw-text-muted);
  font-size: clamp(10px, 1.05vmin, 11px);
  line-height: 1.35;
}

.layout-toggle__track {
  position: relative;
  flex-shrink: 0;
  width: 36px;
  height: 20px;
  border-radius: 999px;
  background: color-mix(in srgb, var(--dw-text) 14%, transparent);
  transition: background 0.18s ease;
}

.layout-toggle.active .layout-toggle__track {
  background: var(--dw-primary);
}

.layout-toggle__thumb {
  position: absolute;
  top: 2px;
  left: 2px;
  width: 16px;
  height: 16px;
  border-radius: 50%;
  background: #fff;
  box-shadow: 0 1px 3px rgba(15, 23, 42, 0.18);
  transition: transform 0.18s ease;
}

.layout-toggle.active .layout-toggle__thumb {
  transform: translateX(16px);
}
</style>
