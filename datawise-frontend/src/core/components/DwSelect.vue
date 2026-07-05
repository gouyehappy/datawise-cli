<script setup lang="ts">
import {computed, ref} from 'vue'
import type {SelectOption} from '@/core/components/select.types'
import {usePopoverEscape} from '@/core/composables/usePopoverEscape'
import {DwIcon} from '@/core/icons'

export type {SelectOption}

const props = withDefaults(
    defineProps<{
      options: SelectOption[]
      id?: string
      placeholder?: string
      disabled?: boolean
      /** 选项以 font-family 展示（字体选择） */
      useOptionFont?: boolean
      size?: 'default' | 'sm' | 'pill' | 'compact' | 'inline'
      /** 下拉菜单最小宽度（inline / pill 等窄触发器场景） */
      menuMinWidth?: string
    }>(),
    {size: 'default'},
)

const model = defineModel<string>({required: true})

const rootRef = ref<HTMLElement>()
const open = ref(false)

const selectedLabel = computed(() => {
  const match = props.options.find((item) => item.value === model.value)
  if (match) return match.label
  if (!model.value && props.placeholder) return props.placeholder
  return model.value
})

const isPlaceholder = computed(() => !model.value && !!props.placeholder)

const menuStyle = computed(() => ({
  minWidth: props.menuMinWidth ?? undefined,
  width: 'max-content',
}))

usePopoverEscape(open, () => {
  open.value = false
})

function toggle() {
  if (props.disabled) return
  open.value = !open.value
}

function select(value: string) {
  model.value = value
  open.value = false
}
</script>

<template>
  <div
      :id="id"
      ref="rootRef"
      class="dw-select"
      :class="[
        `dw-select--${size}`,
        {
          'is-open': open,
          'is-disabled': disabled,
          'is-placeholder': isPlaceholder,
        },
      ]"
  >
    <button
        class="dw-select__trigger"
        type="button"
        :disabled="disabled"
        aria-haspopup="listbox"
        :aria-expanded="open"
        @click="toggle"
    >
      <span
          class="dw-select__value"
          :style="useOptionFont && model ? { fontFamily: model } : undefined"
      >
        {{ selectedLabel }}
      </span>
      <DwIcon class="dw-select__chevron" name="chevron-down" size="sm" :stroke-width="1.5"/>
    </button>

    <Transition name="dw-select-menu">
      <ul
          v-if="open"
          class="dw-select__menu"
          role="listbox"
          :style="menuStyle"
      >
        <li
            v-for="option in options"
            :key="option.value"
            role="option"
            :aria-selected="option.value === model"
        >
          <button
              class="dw-select__item"
              :class="{ 'is-active': option.value === model }"
              type="button"
              :disabled="option.disabled"
              @click="select(option.value)"
          >
            <span
                class="dw-select__item-label"
                :style="useOptionFont ? { fontFamily: option.value } : undefined"
            >
              {{ option.label }}
            </span>
            <DwIcon
                v-if="option.value === model"
                class="dw-select__check"
                name="submit"
                size="sm"
                :stroke-width="1.6"
            />
          </button>
        </li>
      </ul>
    </Transition>
  </div>
</template>
