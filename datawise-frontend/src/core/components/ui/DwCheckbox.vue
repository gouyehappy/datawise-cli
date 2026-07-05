<script setup lang="ts">
defineOptions({inheritAttrs: false})

const model = defineModel<boolean>({required: true})

withDefaults(defineProps<{
  id?: string
  label?: string
  disabled?: boolean
  /** 块级布局（标题 + 说明），用于设置页开关类场景 */
  block?: boolean
}>(), {
  disabled: false,
  block: false,
})
</script>

<template>
  <label
      class="dw-checkbox"
      :class="{ 'dw-checkbox--block': block }"
      v-bind="$attrs"
  >
    <input
        :id="id"
        v-model="model"
        class="dw-checkbox__control"
        type="checkbox"
        :disabled="disabled"
    >
    <span v-if="label || $slots.default" class="dw-checkbox__label">
      <slot>{{ label }}</slot>
    </span>
  </label>
</template>
