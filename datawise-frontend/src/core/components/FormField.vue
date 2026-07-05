<script setup lang="ts">
import {computed, useId} from 'vue'

const props = withDefaults(defineProps<{
  label: string
  inputId?: string
  error?: string
  /** 控件组（radio 等），label 用 span + aria-labelledby，不绑定 for */
  group?: boolean
}>(), {
  group: false,
})

const autoId = useId()
const labelId = useId()

const controlId = computed(() => props.inputId ?? (props.group ? undefined : autoId))
</script>

<template>
  <div
      class="dw-field"
      :class="{ 'dw-field--group': group }"
      :role="group ? 'group' : undefined"
      :aria-labelledby="group ? labelId : undefined"
  >
    <component
        :is="group ? 'span' : 'label'"
        :id="group ? labelId : undefined"
        :for="group ? undefined : controlId"
        class="dw-field__label"
    >
      {{ label }}
    </component>
    <slot :id="controlId" :label-id="labelId"/>
    <p v-if="error" class="dw-form-error" role="alert">{{ error }}</p>
  </div>
</template>
