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
    gap: 6px;
    min-height: 180px;
    padding: 24px 16px;
    text-align: center;
}

.dw-empty__icon {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 52px;
    height: 52px;
    margin-bottom: 4px;
    border-radius: 14px;
    background: var(--dw-bg-muted);
    color: var(--dw-text-muted);
}

.dw-empty p {
    margin: 0;
    font-size: 13px;
    font-weight: 600;
    color: var(--dw-text-secondary);
}

.dw-empty span {
    max-width: 220px;
    color: var(--dw-text-muted);
    font-size: 12px;
    line-height: 1.5;
}

.dw-empty--compact {
    min-height: 120px;
    padding: 16px 12px;
}

.dw-empty--embedded {
    min-height: 0;
    padding: 20px 18px;
    align-items: stretch;
}

.dw-empty--embedded p {
    font-weight: 400;
    color: var(--dw-text-muted);
}

.dw-empty--bordered {
    border: 1px dashed var(--dw-border-light);
    border-radius: 10px;
    padding: 12px;
    min-height: 0;
}

.dw-empty--bordered p {
    font-size: 12px;
    font-weight: 400;
    color: var(--dw-text-muted);
}
</style>
