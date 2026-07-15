<script setup lang="ts">
withDefaults(defineProps<{
    title: string
    hint?: string
    compact?: boolean
    /** 卡片/列表内嵌空态，无最小高度 */
    embedded?: boolean
    /** 虚线边框（快捷面板等紧凑区域） */
    bordered?: boolean
}>(), {
    compact: false,
    embedded: false,
    bordered: false,
})
</script>

<template>
  <div
      class="dw-empty"
      :class="{
        'dw-empty--compact': compact,
        'dw-empty--embedded': embedded,
        'dw-empty--bordered': bordered,
      }"
  >
    <div v-if="$slots.icon" class="dw-empty__icon" aria-hidden="true">
      <slot name="icon"/>
    </div>
    <p>{{ title }}</p>
    <span v-if="hint || $slots.hint">
      <slot name="hint">{{ hint }}</slot>
    </span>
  </div>
</template>

<style scoped>
.dw-empty {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: var(--dw-gap-sm);
    min-height: 180px;
    padding: var(--dw-space-10) var(--dw-space-8);
    text-align: center;
}

.dw-empty__icon {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 52px;
    height: 52px;
    margin-bottom: var(--dw-space-2);
    border-radius: var(--dw-radius-xl);
    background: var(--dw-bg-muted);
    color: var(--dw-text-muted);
}

.dw-empty p {
    margin: 0;
    font-size: var(--dw-text-md);
    font-weight: 600;
    color: var(--dw-text-secondary);
}

.dw-empty span {
    max-width: 220px;
    color: var(--dw-text-muted);
    font-size: var(--dw-text-sm);
    line-height: var(--dw-leading-relaxed);
}

.dw-empty--compact {
    min-height: 120px;
    padding: var(--dw-space-8) var(--dw-space-6);
}

.dw-empty--embedded {
    min-height: 0;
    padding: var(--dw-space-9) var(--dw-space-8);
    align-items: stretch;
}

.dw-empty--embedded p {
    font-weight: 400;
    color: var(--dw-text-muted);
}

.dw-empty--bordered {
    border: 1px dashed var(--dw-border-light);
    border-radius: var(--dw-radius-lg);
    padding: var(--dw-space-6);
    min-height: 0;
}

.dw-empty--bordered p {
    font-size: var(--dw-text-sm);
    font-weight: 400;
    color: var(--dw-text-muted);
}
</style>
