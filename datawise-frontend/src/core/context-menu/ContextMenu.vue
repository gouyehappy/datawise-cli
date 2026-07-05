<script setup lang="ts">
import {nextTick, onMounted, onUnmounted, ref} from 'vue'
import ContextMenuIcon from './ContextMenuIcon.vue'
import {DwIcon} from '@/core/icons'
import {resolveContextMenuSubmenuPanel} from './submenu-panels'
import type {ContextMenuItem} from '@/core/types'

const props = defineProps<{
  items: ContextMenuItem[]
  x: number
  y: number
  title?: string
}>()

const emit = defineEmits<{
  select: [id: string]
  close: []
}>()

const rootRef = ref<HTMLElement>()
const submenuId = ref<string | null>(null)
const pos = ref({x: props.x, y: props.y})

function onSelect(id: string) {
  emit('select', id)
  emit('close')
}

function hasSubmenu(item: ContextMenuItem) {
  return !!item.children?.length || !!item.submenuPanel
}

function onKeydown(event: KeyboardEvent) {
  if (event.key === 'Escape') {
    event.preventDefault()
    emit('close')
  }
}

function onPointerDownOutside(event: PointerEvent) {
  if (event.button !== 0) return
  const target = event.target
  if (target instanceof Node && rootRef.value?.contains(target)) return
  emit('close')
}

onMounted(async () => {
  document.addEventListener('keydown', onKeydown, true)
  document.addEventListener('pointerdown', onPointerDownOutside, true)
  await nextTick()
  clampPosition()
})

onUnmounted(() => {
  document.removeEventListener('keydown', onKeydown, true)
  document.removeEventListener('pointerdown', onPointerDownOutside, true)
})

function openSubmenu(id: string) {
  submenuId.value = id
}

function closeSubmenu() {
  submenuId.value = null
}

function clampPosition() {
  if (!rootRef.value) return
  const rect = rootRef.value.getBoundingClientRect()
  const padding = 8
  let x = props.x
  let y = props.y
  if (x + rect.width > window.innerWidth - padding) {
    x = Math.max(padding, window.innerWidth - rect.width - padding)
  }
  if (y + rect.height > window.innerHeight - padding) {
    y = Math.max(padding, window.innerHeight - rect.height - padding)
  }
  pos.value = {x, y}
}
</script>

<template>
  <div
      ref="rootRef"
      class="dw-ctx-menu"
      :style="{ left: `${pos.x}px`, top: `${pos.y}px` }"
      @click.stop
  >
    <div v-if="title" class="dw-ctx-menu__head">{{ title }}</div>

    <div class="dw-ctx-menu__body">
      <template v-for="item in items" :key="item.id">
        <div v-if="item.divider" class="dw-ctx-menu__divider"/>

        <button
            v-else
            class="dw-ctx-menu__item"
            :class="{
            'is-disabled': item.disabled,
            'is-accent': item.accent,
            'is-danger': item.danger,
            'has-submenu': hasSubmenu(item),
            'is-submenu-open': hasSubmenu(item) && submenuId === item.id,
          }"
            type="button"
            :title="item.disabled && item.disabledHint ? item.disabledHint : undefined"
            @mouseenter="hasSubmenu(item) ? openSubmenu(item.id) : closeSubmenu()"
            @click="!hasSubmenu(item) && !item.disabled && onSelect(item.id)"
        >
          <ContextMenuIcon v-if="item.icon" :name="item.icon" :danger="item.danger"/>
          <span v-else class="dw-ctx-menu__icon-spacer" aria-hidden="true"/>

          <span class="dw-ctx-menu__label">{{ item.label }}</span>

          <kbd v-if="item.shortcut" class="dw-ctx-menu__shortcut">{{ item.shortcut }}</kbd>
          <DwIcon
              v-else-if="hasSubmenu(item)"
              class="dw-ctx-menu__arrow"
              name="chevron-right"
              size="xs"
              :stroke-width="1.5"
          />

          <div
              v-if="item.children?.length && submenuId === item.id"
              class="dw-ctx-menu__submenu"
              @mouseenter="openSubmenu(item.id)"
          >
            <button
                v-for="child in item.children"
                :key="child.id"
                class="dw-ctx-menu__item"
                :class="{ 'is-disabled': child.disabled }"
                type="button"
                :title="child.disabled && child.disabledHint ? child.disabledHint : undefined"
                @click.stop="!child.disabled && onSelect(child.id)"
            >
              <ContextMenuIcon v-if="child.icon" :name="child.icon"/>
              <span v-else class="dw-ctx-menu__icon-spacer" aria-hidden="true"/>
              <span class="dw-ctx-menu__label">{{ child.label }}</span>
              <kbd v-if="child.shortcut" class="dw-ctx-menu__shortcut">{{ child.shortcut }}</kbd>
            </button>
          </div>

          <div
              v-if="item.submenuPanel && submenuId === item.id"
              class="dw-ctx-menu__submenu dw-ctx-menu__submenu--panel"
              @mouseenter="openSubmenu(item.id)"
          >
            <component
                :is="resolveContextMenuSubmenuPanel(item.submenuPanel)"
                @select="onSelect"
            />
          </div>
        </button>
      </template>
    </div>
  </div>
</template>
