<script setup lang="ts">
import {computed, nextTick, onUnmounted, ref, watch} from 'vue'
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
const menuRef = ref<HTMLElement>()
const open = ref(false)

const MENU_GAP = 6
const MENU_MAX_HEIGHT = 280

type MenuPlacement = 'bottom' | 'top'

const menuPosition = ref({
  left: 0,
  minWidth: 0,
  top: 0,
  anchorTop: 0,
  placement: 'bottom' as MenuPlacement,
})

const selectedLabel = computed(() => {
  const match = props.options.find((item) => item.value === model.value)
  if (match) return match.label
  if (!model.value && props.placeholder) return props.placeholder
  return model.value
})

const isPlaceholder = computed(() => !model.value && !!props.placeholder)

const menuStyle = computed(() => {
  const base: Record<string, string> = {
    minWidth: props.menuMinWidth ?? `${menuPosition.value.minWidth}px`,
    width: 'max-content',
  }

  if (!open.value) return base

  const anchored: Record<string, string> = {
    ...base,
    left: `${menuPosition.value.left}px`,
  }

  if (menuPosition.value.placement === 'bottom') {
    anchored.top = `${menuPosition.value.top}px`
  } else {
    anchored.bottom = `${window.innerHeight - menuPosition.value.anchorTop + MENU_GAP}px`
  }

  return anchored
})

let removePositionListeners: (() => void) | null = null

function updateMenuPosition() {
  const trigger = rootRef.value
  if (!trigger) return

  const rect = trigger.getBoundingClientRect()
  const spaceBelow = window.innerHeight - rect.bottom - MENU_GAP
  const spaceAbove = rect.top - MENU_GAP
  const preferredHeight = Math.min(MENU_MAX_HEIGHT, 160)
  const placement: MenuPlacement =
      spaceBelow < preferredHeight && spaceAbove > spaceBelow ? 'top' : 'bottom'

  menuPosition.value = {
    left: rect.left,
    minWidth: rect.width,
    top: rect.bottom + MENU_GAP,
    anchorTop: rect.top,
    placement,
  }
}

function bindPositionListeners() {
  removePositionListeners?.()
  const onReposition = () => updateMenuPosition()
  const onScroll = (event: Event) => {
    const target = event.target
    if (target instanceof Node && menuRef.value?.contains(target)) return
    open.value = false
  }
  window.addEventListener('resize', onReposition)
  window.addEventListener('scroll', onScroll, true)
  removePositionListeners = () => {
    window.removeEventListener('resize', onReposition)
    window.removeEventListener('scroll', onScroll, true)
  }
}

watch(open, async (isOpen) => {
  if (!isOpen) {
    removePositionListeners?.()
    removePositionListeners = null
    return
  }
  await nextTick()
  updateMenuPosition()
  bindPositionListeners()
})

onUnmounted(() => {
  removePositionListeners?.()
})

usePopoverEscape(open, () => {
  open.value = false
}, {
  containRefs: () => [rootRef.value, menuRef.value],
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

    <Teleport to="body">
      <Transition name="dw-select-menu">
        <ul
            v-if="open"
            ref="menuRef"
            class="dw-select__menu dw-select__menu--portal"
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
    </Teleport>
  </div>
</template>
