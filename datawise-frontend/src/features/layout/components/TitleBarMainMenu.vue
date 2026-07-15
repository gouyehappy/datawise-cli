<script setup lang="ts">
import {computed, ref} from 'vue'
import {useI18n} from 'vue-i18n'
import {DwIcon} from '@/core/icons'
import {useShortcutSettingsStore} from '@/features/settings/stores/shortcut-settings-store'
import {formatBinding} from '@/core/shortcuts/shortcut.service'
import {runExplorerRefresh} from '@/features/explorer/services/explorer-toolbar.actions'
import {useWorkspaceActions} from '@/features/layout/composables/useWorkspaceActions'
import {
    useTitleBarAuthMenuItems,
    useTitleBarPreferenceMenuItems,
} from '@/features/layout/composables/useProfileMenuGroups'
import {useFeaturePermission} from '@/features/auth/composables/useFeaturePermission'
import {FeaturePermission} from '@/features/auth/types/feature-permission.types'
import type {WorkspaceListEntry} from '@/features/settings/services/config-dir-settings.service'

const props = defineProps<{
  menuStyle?: {top: string; left: string}
}>()

const emit = defineEmits<{ close: [] }>()

const rootRef = ref<HTMLElement | null>(null)

const {t} = useI18n()
const shortcuts = useShortcutSettingsStore()
const {
    canSwitch,
    recentWorkspaces,
    activeEntry,
    displayName,
    createWorkspace,
    openFolder,
    confirmSwitch,
    useDefaultWorkspace,
} = useWorkspaceActions()
const {can} = useFeaturePermission()

const recentOpen = ref(false)

const settingsShortcut = computed(() => formatBinding(shortcuts.getBinding('app.openSettings')))

const showDefaultWorkspace = computed(() => {
    const active = activeEntry()
    return Boolean(active && !active.isDefault && canSwitch.value)
})

const recentEntries = computed(() => recentWorkspaces.value.filter((entry) => !entry.active))

const sectionVisible = computed(() => ({
    workspace: canSwitch.value && can(FeaturePermission.TitleBarWorkspace),
    preferences: preferenceMenuItems.value.length > 0,
    auth: authMenuItems.value.length > 0,
    exit: true,
}))

const visibleSections = computed(() =>
    (['workspace', 'preferences', 'auth', 'exit'] as const).filter((id) => sectionVisible.value[id]),
)

function showSectionDivider(sectionId: (typeof visibleSections.value)[number]) {
    return visibleSections.value.indexOf(sectionId) > 0
}

function closeMenu() {
    recentOpen.value = false
    emit('close')
}

function onReloadExplorer() {
    void runExplorerRefresh().finally(() => closeMenu())
}

const preferenceMenuItems = useTitleBarPreferenceMenuItems(closeMenu, onReloadExplorer)
const authMenuItems = useTitleBarAuthMenuItems(closeMenu)

function exitApp() {
    void window.datawise?.chrome?.close()
    closeMenu()
}

function onSelectRecent(entry: WorkspaceListEntry) {
    recentOpen.value = false
    confirmSwitch(entry)
    closeMenu()
}

function onCreateWorkspace() {
    createWorkspace()
    closeMenu()
}

function onOpenFolder() {
    void openFolder().finally(() => closeMenu())
}

function onUseDefault() {
    useDefaultWorkspace()
    closeMenu()
}

defineExpose({
    containsNode(target: Node): boolean {
        return rootRef.value?.contains(target) ?? false
    },
})
</script>

<template>
  <div
      ref="rootRef"
      class="titlebar-main-menu"
      :class="{ 'titlebar-main-menu--anchored': !!props.menuStyle }"
      :style="props.menuStyle"
      @click.stop
  >
    <section v-if="sectionVisible.workspace" class="titlebar-main-menu__section">
      <button type="button" class="titlebar-main-menu__item" @click="onCreateWorkspace">
        <span class="titlebar-main-menu__icon" aria-hidden="true">
          <DwIcon name="plus" size="menu" :stroke-width="1.35"/>
        </span>
        <span class="titlebar-main-menu__label">{{ t('app.titleBar.mainMenu.newWorkspace') }}</span>
      </button>

      <button type="button" class="titlebar-main-menu__item" @click="onOpenFolder">
        <span class="titlebar-main-menu__icon" aria-hidden="true">
          <DwIcon name="open" size="menu" :stroke-width="1.35"/>
        </span>
        <span class="titlebar-main-menu__label">{{ t('app.titleBar.mainMenu.openFolder') }}</span>
      </button>

      <div
          class="titlebar-main-menu__submenu"
          @mouseenter="recentOpen = true"
          @mouseleave="recentOpen = false"
      >
        <button
            type="button"
            class="titlebar-main-menu__item"
            :class="{ 'is-open': recentOpen }"
            :aria-expanded="recentOpen"
            @click="recentOpen = !recentOpen"
        >
          <span class="titlebar-main-menu__icon" aria-hidden="true">
            <DwIcon name="history" size="menu" :stroke-width="1.35"/>
          </span>
          <span class="titlebar-main-menu__label">{{ t('app.titleBar.mainMenu.recentWorkspaces') }}</span>
          <DwIcon class="titlebar-main-menu__arrow" name="chevron-right" size="xs" :stroke-width="1.3"/>
        </button>

        <div v-if="recentOpen" class="titlebar-main-menu__flyout">
          <template v-if="recentEntries.length">
            <button
                v-for="entry in recentEntries"
                :key="entry.path"
                type="button"
                class="titlebar-main-menu__flyout-item"
                @click="onSelectRecent(entry)"
            >
              <span class="titlebar-main-menu__flyout-name">{{ displayName(entry) }}</span>
              <span class="titlebar-main-menu__flyout-path">{{ entry.path }}</span>
            </button>
          </template>
          <p v-else class="titlebar-main-menu__flyout-empty">
            {{ t('app.titleBar.mainMenu.recentEmpty') }}
          </p>
          <button
              v-if="showDefaultWorkspace"
              type="button"
              class="titlebar-main-menu__flyout-item titlebar-main-menu__flyout-item--accent"
              @click="onUseDefault"
          >
            {{ t('app.titleBar.workspaceSwitcher.useDefault') }}
          </button>
        </div>
      </div>
    </section>

    <div v-if="showSectionDivider('preferences')" class="titlebar-main-menu__divider"/>

    <section v-if="sectionVisible.preferences" class="titlebar-main-menu__section">
      <button
          v-for="item in preferenceMenuItems"
          :key="item.id"
          type="button"
          class="titlebar-main-menu__item"
          :class="{'titlebar-main-menu__item--accent': item.accent}"
          @click="item.onClick"
      >
        <span class="titlebar-main-menu__icon" aria-hidden="true">
          <DwIcon :name="item.icon" size="menu" :stroke-width="item.icon === 'users' ? 1.25 : 1.35"/>
        </span>
        <span class="titlebar-main-menu__label">{{ t(item.labelKey) }}</span>
        <kbd v-if="item.id === 'settings' && settingsShortcut" class="titlebar-main-menu__shortcut">{{ settingsShortcut }}</kbd>
      </button>
    </section>

    <div v-if="showSectionDivider('auth')" class="titlebar-main-menu__divider"/>

    <section v-if="sectionVisible.auth" class="titlebar-main-menu__section">
      <button
          v-for="item in authMenuItems"
          :key="item.id"
          type="button"
          class="titlebar-main-menu__item"
          :class="{'titlebar-main-menu__item--accent': item.accent}"
          @click="item.onClick"
      >
        <span class="titlebar-main-menu__icon" aria-hidden="true">
          <DwIcon :name="item.icon" size="menu" :stroke-width="item.icon === 'users' ? 1.25 : 1.35"/>
        </span>
        <span class="titlebar-main-menu__label">{{ t(item.labelKey) }}</span>
        <span v-if="item.badgeKey" class="titlebar-main-menu__badge">{{ t(item.badgeKey) }}</span>
      </button>
    </section>

    <div v-if="showSectionDivider('exit')" class="titlebar-main-menu__divider"/>

    <section v-if="sectionVisible.exit" class="titlebar-main-menu__section">
      <button type="button" class="titlebar-main-menu__item" @click="exitApp">
        <span class="titlebar-main-menu__icon" aria-hidden="true"/>
        <span class="titlebar-main-menu__label">{{ t('app.titleBar.mainMenu.exit') }}</span>
      </button>
    </section>
  </div>
</template>

<style scoped>
.titlebar-main-menu {
  position: fixed;
  left: calc(var(--dw-rail-width) + 8px);
  top: 10px;
  z-index: var(--dw-z-max);
  width: min(300px, calc(100vw - 24px));
  padding: var(--dw-space-2) 0;
  border: 1px solid var(--dw-border-light);
  border-radius: var(--dw-radius-lg);
  background: var(--dw-bg-panel);
  box-shadow: var(--dw-menu-shadow);
}

.titlebar-main-menu--anchored {
  left: auto;
  top: auto;
}

.titlebar-main-menu__section {
  display: flex;
  flex-direction: column;
  padding: var(--dw-space-1) 0;
}

.titlebar-main-menu__divider {
  height: 1px;
  margin: var(--dw-space-2) 0;
  background: var(--dw-border-light);
}

.titlebar-main-menu__item {
  display: grid;
  grid-template-columns: 22px minmax(0, 1fr) auto;
  align-items: center;
  gap: var(--dw-gap);
  width: 100%;
  min-height: var(--dw-control-h-sm);
  padding: 0 var(--dw-space-6);
  border: none;
  background: transparent;
  color: var(--dw-text);
  font-size: var(--dw-text-md);
  text-align: left;
  cursor: pointer;
  transition: var(--dw-transition-bg);
}

.titlebar-main-menu__item:hover,
.titlebar-main-menu__item.is-open {
  background: color-mix(in srgb, var(--dw-primary) 10%, var(--dw-bg-hover));
}

.titlebar-main-menu__item--accent .titlebar-main-menu__label {
  color: var(--dw-primary);
  font-weight: 500;
}

.titlebar-main-menu__badge {
  justify-self: end;
  padding: 1px var(--dw-space-3);
  border-radius: var(--dw-radius-pill);
  background: var(--dw-primary-soft);
  color: var(--dw-primary);
  font-size: var(--dw-text-xs);
  font-weight: 600;
  line-height: var(--dw-leading-relaxed);
}

.titlebar-main-menu__icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  color: var(--dw-text-muted);
}

.titlebar-main-menu__icon svg {
  display: block;
}

.titlebar-main-menu__label {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.titlebar-main-menu__shortcut {
  justify-self: end;
  padding: 1px var(--dw-space-3);
  border: 1px solid var(--dw-border-light);
  border-radius: var(--dw-control-radius-sm);
  background: color-mix(in srgb, var(--dw-bg) 88%, var(--dw-text) 4%);
  color: var(--dw-text-muted);
  font-family: inherit;
  font-size: var(--dw-text-xs);
  line-height: var(--dw-leading);
}

.titlebar-main-menu__arrow {
  width: var(--dw-icon-size-xs);
  height: var(--dw-icon-size-xs);
  margin-left: auto;
  opacity: 0.55;
}

.titlebar-main-menu__submenu {
  position: relative;
}

.titlebar-main-menu__flyout {
  position: absolute;
  top: -4px;
  left: calc(100% + 4px);
  z-index: 1;
  width: min(320px, calc(100vw - 48px));
  max-height: min(360px, 50vh);
  overflow: auto;
  padding: var(--dw-space-2) 0;
  border: 1px solid var(--dw-border-light);
  border-radius: var(--dw-radius-lg);
  background: var(--dw-bg-panel);
  box-shadow: var(--dw-shadow);
}

.titlebar-main-menu__flyout-item {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: var(--dw-space-1);
  width: 100%;
  padding: var(--dw-space-3) var(--dw-space-6);
  border: none;
  background: transparent;
  text-align: left;
  cursor: pointer;
  transition: var(--dw-transition-bg);
}

.titlebar-main-menu__flyout-item:hover,
.titlebar-main-menu__flyout-item--accent:hover {
  background: color-mix(in srgb, var(--dw-primary) 10%, var(--dw-bg-hover));
}

.titlebar-main-menu__flyout-name {
  font-size: var(--dw-text-md);
  font-weight: 500;
  color: var(--dw-text);
}

.titlebar-main-menu__flyout-path {
  max-width: 100%;
  font-family: var(--dw-mono);
  font-size: var(--dw-text-xs);
  line-height: var(--dw-leading-snug);
  color: var(--dw-text-muted);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.titlebar-main-menu__flyout-empty {
  margin: 0;
  padding: var(--dw-pad-control-lg);
  color: var(--dw-text-muted);
  font-size: var(--dw-text-sm);
}

.titlebar-main-menu__flyout-item--accent {
  border-top: 1px solid var(--dw-border-light);
  margin-top: var(--dw-space-1);
  padding-top: 9px;
  color: var(--dw-primary);
  font-size: var(--dw-text-md);
  font-weight: 500;
}
</style>
