<script setup lang="ts">
import {computed, useAttrs} from 'vue'

defineOptions({inheritAttrs: false})

const model = defineModel<string | number>()

const props = withDefaults(defineProps<{
  id?: string
  type?: 'text' | 'search' | 'number' | 'password' | 'email' | 'url'
  placeholder?: string
  disabled?: boolean
  readonly?: boolean
  autocomplete?: string
  spellcheck?: boolean | 'true' | 'false'
  min?: number | string
  max?: number | string
  step?: number | string
  /** 大于 1 时渲染 textarea */
  rows?: number
  variant?: 'default' | 'sm' | 'cell' | 'mono'
}>(), {
  type: 'text',
  variant: 'default',
  disabled: false,
  readonly: false,
})

const attrs = useAttrs()

const inputClass = computed(() => [
  'dw-input',
  props.variant !== 'default' && `dw-input--${props.variant}`,
  props.rows && props.rows > 1 && 'dw-textarea--cell',
])
</script>

<template>
  <textarea
      v-if="rows && rows > 1"
      :id="id"
      v-model="model"
      :class="inputClass"
      :rows="rows"
      :placeholder="placeholder"
      :disabled="disabled"
      :readonly="readonly"
      :spellcheck="spellcheck"
      v-bind="attrs"
  />
  <input
      v-else
      :id="id"
      v-model="model"
      :class="inputClass"
      :type="type"
      :placeholder="placeholder"
      :disabled="disabled"
      :readonly="readonly"
      :autocomplete="autocomplete"
      :spellcheck="spellcheck"
      :min="min"
      :max="max"
      :step="step"
      v-bind="attrs"
  >
</template>
