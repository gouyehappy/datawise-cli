<script setup lang="ts">
import {nextTick, onMounted, onUnmounted, ref} from 'vue'
import {useI18n} from 'vue-i18n'
import {usePopoverEscape} from '@/core/composables/usePopoverEscape'
import {IconButton} from '@/core/components'
import {DwIcon} from '@/core/icons'

defineProps<{
  layoutEditMode: boolean
}>()

const emit = defineEmits<{
  'toggle-layout-edit': []
  customize: []
  'ai-widget': []
  shares: []
}>()

const {t} = useI18n()
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
  const menuWidth = 220
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

function run(action: 'toggle-layout-edit' | 'customize' | 'ai-widget' | 'shares') {
  close()
  // Narrow before emit: Vue's typed emit uses per-event overloads, so a union is rejected.
  switch (action) {
    case 'customize':
      emit('customize')
      break
    case 'toggle-layout-edit':
      emit('toggle-layout-edit')
      break
    case 'ai-widget':
      emit('ai-widget')
      break
    case 'shares':
      emit('shares')
      break
  }
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
  <div ref="triggerRef" class="dash-settings">
    <IconButton
        :title="t('dashboard.settingsMenu.aria')"
        :active="open || layoutEditMode"
        @click="toggle"
    >
      <DwIcon name="settings" :stroke-width="1.6"/>
    </IconButton>

    <Teleport to="body">
      <div
          v-if="open"
          ref="menuRef"
          class="dash-settings__menu"
          :style="menuStyle"
          role="menu"
          :aria-label="t('dashboard.settingsMenu.aria')"
      >
        <button
            type="button"
            class="dash-settings__item"
            role="menuitem"
            @click="run('customize')"
        >
          <DwIcon name="settings-layout" :stroke-width="1.6"/>
          <span>{{ t('dashboard.settingsMenu.customize') }}</span>
        </button>
        <button
            type="button"
            class="dash-settings__item"
            role="menuitem"
            @click="run('toggle-layout-edit')"
        >
          <DwIcon name="settings-basic" :stroke-width="1.6"/>
          <span>
            {{
              layoutEditMode
                ? t('dashboard.settingsMenu.layoutEditDone')
                : t('dashboard.settingsMenu.layoutEdit')
            }}
          </span>
        </button>
        <div class="dash-settings__divider" role="separator"/>
        <button
            type="button"
            class="dash-settings__item"
            role="menuitem"
            @click="run('ai-widget')"
        >
          <DwIcon name="settings-ai" :stroke-width="1.6"/>
          <span>{{ t('dashboard.settingsMenu.aiWidget') }}</span>
        </button>
        <button
            type="button"
            class="dash-settings__item"
            role="menuitem"
            @click="run('shares')"
        >
          <DwIcon name="link" :stroke-width="1.6"/>
          <span>{{ t('dashboard.settingsMenu.shares') }}</span>
        </button>
      </div>
    </Teleport>
  </div>
</template>

<style scoped>
.dash-settings {
  position: relative;
  display: inline-flex;
}
</style>

<style>
/* Teleported to body — must be unscoped */
.dash-settings__menu {
  position: fixed;
  z-index: var(--dw-z-popover);
  min-width: 220px;
  padding: var(--dw-space-1);
  border: 1px solid var(--dw-panel-border);
  border-radius: var(--dw-control-radius);
  background: var(--dw-bg-editor);
  box-shadow: var(--dw-panel-shadow);
}

.dash-settings__item {
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

.dash-settings__item:hover {
  background: color-mix(in srgb, var(--dw-primary) 10%, transparent);
}

.dash-settings__item svg {
  flex-shrink: 0;
  width: 15px;
  height: 15px;
  color: var(--dw-text-secondary);
}

.dash-settings__divider {
  height: 1px;
  margin: var(--dw-space-1) 6px;
  background: var(--dw-panel-border);
}
</style>
