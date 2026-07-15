<script setup lang="ts">
import {computed, ref, useAttrs} from 'vue'
import {useI18n} from 'vue-i18n'
import {DwIcon} from '@/core/icons'
import DwInput from './DwInput.vue'

defineOptions({inheritAttrs: false})

const model = defineModel<string>({default: ''})

const props = withDefaults(defineProps<{
  id?: string
  placeholder?: string
  disabled?: boolean
  readonly?: boolean
  autocomplete?: string
  variant?: 'default' | 'sm' | 'mono'
  showLabel?: string
  hideLabel?: string
}>(), {
  disabled: false,
  readonly: false,
  autocomplete: 'off',
  variant: 'default',
})

const attrs = useAttrs()
const {t} = useI18n()
const visible = ref(false)

const ariaLabel = computed(() => (
    visible.value
        ? (props.hideLabel ?? t('auth.hidePassword'))
        : (props.showLabel ?? t('auth.showPassword'))
))
</script>

<template>
  <div class="dw-secret-input">
    <DwInput
        :id="id"
        v-model="model"
        :variant="variant"
        :type="visible ? 'text' : 'password'"
        :placeholder="placeholder"
        :disabled="disabled"
        :readonly="readonly"
        :autocomplete="autocomplete"
        spellcheck="false"
        v-bind="attrs"
    />
    <button
        type="button"
        class="dw-secret-input__toggle"
        tabindex="-1"
        :disabled="disabled"
        :aria-label="ariaLabel"
        @click="visible = !visible"
    >
      <DwIcon :name="visible ? 'visibility-off' : 'visibility'" size="sm" :stroke-width="1.75"/>
    </button>
  </div>
</template>

<style scoped>
.dw-secret-input {
  position: relative;
}

.dw-secret-input :deep(.dw-input) {
  padding-right: 40px;
}

.dw-secret-input__toggle {
  position: absolute;
  top: 50%;
  right: 8px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: var(--dw-btn-height);
  border: none;
  border-radius: var(--dw-btn-radius);
  background: transparent;
  color: var(--dw-text-muted);
  transform: translateY(-50%);
  transition: background var(--dw-duration-fast) var(--dw-ease), color var(--dw-duration-fast) var(--dw-ease);
  cursor: pointer;
}

.dw-secret-input__toggle:hover:not(:disabled) {
  background: var(--dw-bg-hover);
  color: var(--dw-text-secondary);
}

.dw-secret-input__toggle:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.dw-secret-input__toggle :deep(.dw-icon-root) {
  width: var(--dw-icon-size-md);
  height: var(--dw-icon-size-md);
}
</style>
