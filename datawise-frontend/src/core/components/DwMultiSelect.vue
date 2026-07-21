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
      size?: 'default' | 'sm' | 'pill' | 'compact' | 'inline'
      menuMinWidth?: string
    }>(),
    {size: 'default'},
)

const model = defineModel<string[]>({default: () => []})

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
  const selected = model.value
  if (!selected.length) {
    return props.placeholder ?? ''
  }
  const labels = selected.map((value) => {
    const match = props.options.find((item) => item.value === value)
    return match?.label ?? value
  })
  const joined = labels.join(', ')
  if (labels.length <= 2 && joined.length <= 36) {
    return joined
  }
  return `${labels[0]} +${labels.length - 1}`
})

const isPlaceholder = computed(() => !model.value.length && !!props.placeholder)

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

function isSelected(value: string) {
  return model.value.includes(value)
}

function toggleOption(value: string) {
  const next = [...model.value]
  const index = next.indexOf(value)
  if (index >= 0) {
    next.splice(index, 1)
  } else {
    next.push(value)
  }
  model.value = next
}
</script>

<template>
  <div
      :id="id"
      ref="rootRef"
      class="dw-select dw-select--multiple"
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
      <span class="dw-select__value">{{ selectedLabel }}</span>
      <DwIcon class="dw-select__chevron" name="chevron-down" size="sm" :stroke-width="1.5"/>
    </button>

    <Teleport to="body">
      <Transition name="dw-select-menu">
        <ul
            v-if="open"
            ref="menuRef"
            class="dw-select__menu dw-select__menu--portal"
            role="listbox"
            aria-multiselectable="true"
            :style="menuStyle"
        >
          <li
              v-for="option in options"
              :key="option.value"
              role="option"
              :aria-selected="isSelected(option.value)"
          >
            <button
                class="dw-select__item"
                :class="{ 'is-active': isSelected(option.value) }"
                type="button"
                :disabled="option.disabled"
                @click="toggleOption(option.value)"
            >
              <span class="dw-select__item-label">{{ option.label }}</span>
              <DwIcon
                  v-if="isSelected(option.value)"
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
