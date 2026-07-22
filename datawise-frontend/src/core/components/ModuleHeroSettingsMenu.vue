<script setup lang="ts">
import {nextTick, onMounted, onUnmounted, ref} from 'vue'
import {usePopoverEscape} from '@/core/composables/usePopoverEscape'
import {IconButton} from '@/core/components'
import {DwIcon, type DwIconName} from '@/core/icons'

export interface ModuleHeroMenuItem {
    id: string
    label: string
    icon?: DwIconName
    disabled?: boolean
    dividerBefore?: boolean
}

const props = withDefaults(defineProps<{
    ariaLabel: string
    items: ModuleHeroMenuItem[]
    active?: boolean
}>(), {
    active: false,
})

const emit = defineEmits<{
    select: [id: string]
}>()

const open = ref(false)
const triggerRef = ref<HTMLElement | null>(null)
const menuRef = ref<HTMLElement | null>(null)
const menuStyle = ref<{top: string; left: string} | undefined>()

usePopoverEscape(
    () => open.value,
    () => close(),
    {
        containRefs: () => [triggerRef.value, menuRef.value],
    },
)

function close() {
    open.value = false
    menuStyle.value = undefined
}

function placeMenu() {
    const trigger = triggerRef.value
    if (!trigger) return
    const rect = trigger.getBoundingClientRect()
    const menuWidth = 240
    const left = Math.min(
        Math.max(8, rect.right - menuWidth),
        window.innerWidth - menuWidth - 8,
    )
    menuStyle.value = {
        top: `${rect.bottom + 6}px`,
        left: `${left}px`,
    }
}

async function toggle() {
    if (open.value) {
        close()
        return
    }
    open.value = true
    await nextTick()
    placeMenu()
}

function run(id: string, disabled?: boolean) {
    if (disabled) return
    close()
    emit('select', id)
}

function onWindowChange() {
    if (!open.value) return
    placeMenu()
}

onMounted(() => {
    window.addEventListener('resize', onWindowChange)
    window.addEventListener('scroll', onWindowChange, true)
})

onUnmounted(() => {
    window.removeEventListener('resize', onWindowChange)
    window.removeEventListener('scroll', onWindowChange, true)
})
</script>

<template>
  <div ref="triggerRef" class="mp-hero-settings">
    <IconButton
        :title="ariaLabel"
        :active="open || active"
        @click="toggle"
    >
      <DwIcon name="settings" :stroke-width="1.6"/>
    </IconButton>

    <Teleport to="body">
      <div
          v-if="open"
          ref="menuRef"
          class="mp-hero-settings__menu"
          :style="menuStyle"
          role="menu"
          :aria-label="ariaLabel"
      >
        <template v-for="item in items" :key="item.id">
          <div v-if="item.dividerBefore" class="mp-hero-settings__divider" role="separator"/>
          <button
              type="button"
              class="mp-hero-settings__item"
              role="menuitem"
              :disabled="item.disabled"
              @click="run(item.id, item.disabled)"
          >
            <DwIcon v-if="item.icon" :name="item.icon" :stroke-width="1.6"/>
            <span>{{ item.label }}</span>
          </button>
        </template>
      </div>
    </Teleport>
  </div>
</template>

<style scoped>
.mp-hero-settings {
  position: relative;
  display: inline-flex;
}
</style>

<style>
/* Teleported to body — unscoped */
.mp-hero-settings__menu {
  position: fixed;
  z-index: var(--dw-z-popover);
  min-width: 220px;
  padding: var(--dw-space-1);
  border: 1px solid var(--dw-panel-border);
  border-radius: var(--dw-control-radius);
  background: var(--dw-bg-editor);
  box-shadow: var(--dw-panel-shadow);
}

.mp-hero-settings__item {
  display: flex;
  align-items: center;
  gap: var(--dw-space-2);
  width: 100%;
  padding: 8px 10px;
  border: 0;
  border-radius: calc(var(--dw-control-radius) - 2px);
  background: transparent;
  color: var(--dw-text-primary);
  font: inherit;
  font-size: var(--dw-text-sm);
  text-align: left;
  cursor: pointer;
}

.mp-hero-settings__item:hover:not(:disabled) {
  background: color-mix(in srgb, var(--dw-primary) 10%, transparent);
}

.mp-hero-settings__item:disabled {
  opacity: 0.45;
  cursor: not-allowed;
}

.mp-hero-settings__item svg {
  flex-shrink: 0;
  width: 15px;
  height: 15px;
  color: var(--dw-text-secondary);
}

.mp-hero-settings__divider {
  height: 1px;
  margin: var(--dw-space-1) 6px;
  background: var(--dw-panel-border);
}
</style>
