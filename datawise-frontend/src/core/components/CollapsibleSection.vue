<script setup lang="ts">
import {ref} from 'vue'
import {DwIcon} from '@/core/icons'

const props = withDefaults(
    defineProps<{
      title: string
      description?: string
      defaultOpen?: boolean
      joined?: 'top' | 'middle' | 'bottom' | 'single' | 'none'
    }>(),
    {defaultOpen: false, joined: 'none'},
)

const expanded = ref(props.defaultOpen)

function toggle() {
  expanded.value = !expanded.value
}
</script>

<template>
  <section
      class="collapse-section"
      :class="[
      joined !== 'none' ? `join-${joined}` : 'join-standalone',
      { expanded },
    ]"
  >
    <button class="collapse-head" type="button" @click="toggle">
      <span v-if="$slots.icon" class="collapse-icon">
        <slot name="icon"/>
      </span>

      <span class="collapse-title">
        <span class="collapse-title__main">{{ title }}</span>
        <span v-if="description" class="collapse-title__desc">{{ description }}</span>
      </span>

      <span v-if="$slots.badge" class="collapse-badge">
        <slot name="badge"/>
      </span>

      <DwIcon class="collapse-chevron" name="chevron-right" size="sm" :stroke-width="1.5"/>
    </button>

    <div class="collapse-body-wrap" :class="{ open: expanded }">
      <div class="collapse-body">
        <slot/>
      </div>
    </div>
  </section>
</template>

<style scoped>
.collapse-section.join-standalone {
  border: 1px solid var(--dw-border-light);
  border-radius: 10px;
  background: var(--dw-bg);
  box-shadow: 0 1px 2px rgba(15, 23, 42, 0.03);
  overflow: hidden;
  transition: border-color 0.15s ease, box-shadow 0.15s ease;
}

.collapse-section.join-standalone.expanded {
  border-color: color-mix(in srgb, var(--dw-primary) 18%, var(--dw-border-light));
  box-shadow: 0 2px 8px rgba(15, 23, 42, 0.05);
}

.collapse-section.join-top,
.collapse-section.join-middle,
.collapse-section.join-bottom,
.collapse-section.join-single {
  border: 1px solid var(--dw-border-light);
  border-radius: 10px;
  background: var(--dw-bg);
  overflow: hidden;
}

.collapse-section.join-top {
  border-radius: 10px 10px 0 0;
}

.collapse-section.join-middle {
  border-radius: 0;
  border-top: none;
}

.collapse-section.join-bottom {
  border-radius: 0 0 10px 10px;
  border-top: none;
}

.collapse-head {
  display: flex;
  align-items: center;
  gap: 10px;
  width: 100%;
  min-height: 44px;
  padding: 8px 12px;
  border: none;
  background: transparent;
  color: var(--dw-text);
  text-align: left;
  cursor: pointer;
  transition: background 0.12s ease;
}

.collapse-head:hover {
  background: var(--dw-bg-hover);
}

.collapse-section.expanded .collapse-head {
  background: var(--dw-bg-panel);
}

.collapse-icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  width: 30px;
  height: 30px;
  border-radius: 8px;
  background: var(--dw-bg-muted);
  color: var(--dw-text-secondary);
  transition: background 0.15s ease, color 0.15s ease;
}

.collapse-section.expanded .collapse-icon {
  background: var(--dw-primary-soft);
  color: var(--dw-primary);
}

.collapse-title {
  display: flex;
  flex: 1;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
}

.collapse-title__main {
  font-size: 13px;
  font-weight: 600;
  line-height: 1.2;
}

.collapse-title__desc {
  font-size: 11px;
  font-weight: 400;
  color: var(--dw-text-muted);
  line-height: 1.35;
}

.collapse-badge {
  flex-shrink: 0;
}

.collapse-chevron {
  flex-shrink: 0;
  color: var(--dw-text-muted);
  opacity: 0.6;
  transition: transform 0.2s ease, opacity 0.15s ease, color 0.15s ease;
}

.collapse-section.expanded .collapse-chevron {
  transform: rotate(90deg);
  opacity: 1;
  color: var(--dw-primary);
}

.collapse-body-wrap {
  display: grid;
  grid-template-rows: 0fr;
  transition: grid-template-rows 0.22s cubic-bezier(0.22, 1, 0.36, 1);
}

.collapse-body-wrap.open {
  grid-template-rows: 1fr;
}

.collapse-body {
  display: flex;
  flex-direction: column;
  gap: 10px;
  min-height: 0;
  overflow: hidden;
  padding: 0 12px;
  transition: padding 0.22s ease;
}

.collapse-body-wrap.open .collapse-body {
  padding: 10px 12px 12px;
  border-top: 1px solid var(--dw-border-light);
  background: color-mix(in srgb, var(--dw-bg-muted) 55%, var(--dw-bg));
}
</style>
