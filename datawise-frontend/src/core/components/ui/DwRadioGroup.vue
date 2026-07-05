<script setup lang="ts">
import {computed} from 'vue'

export interface RadioOption {
  value: string | number | boolean
  label: string
  disabled?: boolean
}

const model = defineModel<string | number | boolean>({required: true})

const props = withDefaults(defineProps<{
  options: RadioOption[]
  id?: string
  name?: string
  disabled?: boolean
}>(), {
  disabled: false,
})

const groupName = computed(() => props.name ?? props.id ?? 'dw-radio-group')

function select(value: string | number | boolean) {
  if (props.disabled) return
  model.value = value
}

function isChecked(value: string | number | boolean) {
  return model.value === value
}
</script>

<template>
  <div
      :id="id"
      class="dw-radio-group"
      role="radiogroup"
  >
    <label
        v-for="option in options"
        :key="String(option.value)"
        class="dw-radio-option"
        :class="{ 'is-disabled': disabled || option.disabled }"
    >
      <input
          type="radio"
          :name="groupName"
          :checked="isChecked(option.value)"
          :disabled="disabled || option.disabled"
          @change="select(option.value)"
      >
      <span>{{ option.label }}</span>
    </label>
  </div>
</template>
