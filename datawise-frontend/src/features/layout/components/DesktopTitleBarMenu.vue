<script setup lang="ts">
import {computed, onMounted, onUnmounted, ref} from 'vue'
import {useI18n} from 'vue-i18n'
import {usePopoverEscape} from '@/core/composables/usePopoverEscape'
import {useLayoutStore} from '@/features/layout/stores/layout'
import {useAppConfigStore} from '@/features/layout/stores/app-config-store'
import {
    buildTitleBarNav,
    titleBarMenuIsDropdown,
    type TitleBarMenuItem,
} from '@/features/layout/services/title-bar-nav.service'
import TitleBarMenuIcon from '@/features/layout/components/TitleBarMenuIcon.vue'
import {DwIcon} from '@/core/icons'
import {useTitleBarMenuDensity} from '@/features/layout/composables/useTitleBarMenuDensity'
import {useOnboardingStore} from '@/features/onboarding/stores/onboarding-store'
import {getActiveFeaturePermissions} from '@/features/auth/services/feature-permission.service'

const {t, te} = useI18n()
const layout = useLayoutStore()
const appConfig = useAppConfigStore()
const onboarding = useOnboardingStore()

const openMenuId = ref<string | null>(null)
const rootRef = ref<HTMLElement | null>(null)
const contentRef = ref<HTMLElement | null>(null)
const dropdownPanelRef = ref<HTMLElement | null>(null)
const dropdownPlacement = ref<{top: number; left: number} | null>(null)

const menus = computed(() => {
    // Track permission changes so nav items refresh after account switch.
    getActiveFeaturePermissions()
    return buildTitleBarNav(
        {
            activeModule: layout.activeModule,
            settingsSection: layout.settingsSection,
            config: {
                showSideRailStrip: appConfig.showSideRailStrip,
                showExplorerPanel: appConfig.showExplorerPanel,
                showShortcutRailStrip: appConfig.showShortcutRailStrip,
            },
        },
        {
            setModule: (module) => layout.setModule(module),
            openSettings: (section) => layout.openSettingsModule(section ?? 'basic'),
            openOnboarding: () => onboarding.showGuide(),
            config: {
                openPreferences: () => layout.openSettingsModule('basic'),
                toggleSideRailStrip: () => appConfig.setShowSideRailStrip(!appConfig.showSideRailStrip),
                toggleExplorerPanel: () => appConfig.setShowExplorerPanel(!appConfig.showExplorerPanel),
                toggleShortcutRailStrip: () => {
                    appConfig.setShowShortcutRailStrip(!appConfig.showShortcutRailStrip)
                },
                applyFocusMode: () => appConfig.applyFocusMode(),
            },
        },
    )
})

const menuLayoutStats = computed(() => ({
    primaryCount: menus.value.length,
    contextItemCount: 0,
    contextGroupCount: 0,
}))

const remeasureKey = computed(() => `${layout.activeModule}:${menus.value.length}`)

const {density} = useTitleBarMenuDensity(rootRef, contentRef, menuLayoutStats, remeasureKey)

const openDropdownMenu = computed(() =>
    menus.value.find((item) => item.id === openMenuId.value && titleBarMenuIsDropdown(item)) ?? null,
)

const dropdownStyle = computed(() => {
    const placement = dropdownPlacement.value
    if (!placement) return undefined
    return {
        top: `${placement.top}px`,
        left: `${placement.left}px`,
    }
})

usePopoverEscape(
    () => openMenuId.value !== null,
    () => {
        closeMenu()
    },
    {closeOnOutside: false}, // 已有 mousedown outside
)

function labelOf(item: TitleBarMenuItem): string {
    if (!item.labelKey) return ''
    return te(item.labelKey) ? t(item.labelKey) : item.labelKey
}

function closeMenu() {
    openMenuId.value = null
    dropdownPlacement.value = null
}

function setDropdownPlacement(button: HTMLElement) {
    const rect = button.getBoundingClientRect()
    dropdownPlacement.value = {
        top: rect.bottom + 5,
        left: rect.left,
    }
}

function toggleMenu(item: TitleBarMenuItem, event: MouseEvent) {
    if (titleBarMenuIsDropdown(item)) {
        if (openMenuId.value === item.id) {
            closeMenu()
            return
        }
        openMenuId.value = item.id
        setDropdownPlacement(event.currentTarget as HTMLElement)
        return
    }
    item.run?.()
    closeMenu()
}

function selectChild(item: TitleBarMenuItem) {
    if (!item.run) return
    item.run()
    const keepOpen = item.kind === 'action' && item.checked !== undefined
    if (!keepOpen) closeMenu()
}

function onDocumentMouseDown(event: MouseEvent) {
    if (!openMenuId.value) return
    const target = event.target
    if (!(target instanceof Node)) return
    if (rootRef.value?.contains(target)) return
    if (dropdownPanelRef.value?.contains(target)) return
    closeMenu()
}

function onWindowResize() {
    if (openMenuId.value) closeMenu()
}

onMounted(() => {
    document.addEventListener('mousedown', onDocumentMouseDown)
    window.addEventListener('resize', onWindowResize)
})

onUnmounted(() => {
    document.removeEventListener('mousedown', onDocumentMouseDown)
    window.removeEventListener('resize', onWindowResize)
})
</script>

<template>
  <nav
      ref="rootRef"
      class="titlebar-menu"
      :class="`titlebar-menu--${density}`"
      :aria-label="t('app.titleBar.menu.label')"
  >
    <div ref="contentRef" class="titlebar-menu__content">
      <div
          v-for="item in menus"
          :key="item.id"
          class="titlebar-menu__item"
          :class="{ 'is-open': openMenuId === item.id, 'is-active': item.active }"
      >
        <button
            type="button"
            class="titlebar-menu__btn"
            :class="{ 'is-active': item.active, 'has-children': titleBarMenuIsDropdown(item) }"
            :aria-expanded="titleBarMenuIsDropdown(item) ? openMenuId === item.id : undefined"
            :title="labelOf(item)"
            @click="toggleMenu(item, $event)"
        >
          <TitleBarMenuIcon v-if="item.icon" :name="item.icon" size="sm" class="titlebar-menu__btn-icon"/>
          <span class="titlebar-menu__btn-label">{{ labelOf(item) }}</span>
          <span v-if="item.badge" class="titlebar-menu__badge">{{ item.badge }}</span>
          <DwIcon
              v-if="titleBarMenuIsDropdown(item)"
              class="titlebar-menu__caret"
              name="chevron-down"
              size="xs"
              :stroke-width="1.3"
          />
        </button>
      </div>
    </div>

    <div class="titlebar-menu__drag" aria-hidden="true" @dblclick="$emit('dblclick-drag')"/>

    <Teleport to="body">
      <Transition name="titlebar-dropdown">
        <div
            v-if="openDropdownMenu"
            :key="openDropdownMenu.id"
            ref="dropdownPanelRef"
            class="titlebar-menu__dropdown titlebar-menu__dropdown--fixed"
            :style="dropdownStyle"
            role="menu"
        >
          <div class="titlebar-menu__dropdown-head">
            <TitleBarMenuIcon
                v-if="openDropdownMenu.icon"
                :name="openDropdownMenu.icon"
                size="md"
                class="titlebar-menu__dropdown-head-icon"
            />
            <span class="titlebar-menu__dropdown-title">{{ labelOf(openDropdownMenu) }}</span>
          </div>
          <div class="titlebar-menu__dropdown-body">
            <template v-for="child in openDropdownMenu.children" :key="child.id">
              <div
                  v-if="child.kind === 'header'"
                  class="titlebar-menu__dropdown-group"
              >
                {{ labelOf(child) }}
              </div>
              <div
                  v-else-if="child.divider"
                  class="titlebar-menu__dropdown-divider"
                  role="separator"
              />
              <button
                  v-else
                  type="button"
                  class="titlebar-menu__dropdown-item"
                  :class="{'is-active': child.active, 'is-checked': child.checked}"
                  role="menuitemcheckbox"
                  :aria-checked="child.checked ? 'true' : 'false'"
                  @click="selectChild(child)"
              >
                <span class="titlebar-menu__dropdown-leading" aria-hidden="true">
                  <TitleBarMenuIcon v-if="child.icon" :name="child.icon" size="md"/>
                </span>
                <span class="titlebar-menu__dropdown-copy">
                  <span class="titlebar-menu__dropdown-label">{{ labelOf(child) }}</span>
                </span>
                <span v-if="child.checked" class="titlebar-menu__dropdown-check" aria-hidden="true">✓</span>
              </button>
            </template>
          </div>
        </div>
      </Transition>
    </Teleport>
  </nav>
</template>

<style scoped>
.titlebar-menu {
  display: flex;
  align-items: center;
  flex: 1;
  min-width: 0;
  height: 100%;
  gap: var(--dw-space-1);
  padding: 0 var(--dw-space-3) 0 0;
  overflow: hidden;
  -webkit-app-region: no-drag;
}

.titlebar-menu__content {
  display: flex;
  align-items: center;
  flex: 0 1 auto;
  min-width: 0;
  max-width: calc(100% - 24px);
  gap: var(--dw-space-1);
  overflow: hidden;
}

.titlebar-menu__item {
  position: relative;
  display: flex;
  align-items: center;
  flex-shrink: 0;
  height: 100%;
}

.titlebar-menu__item.is-open .titlebar-menu__btn {
  background: color-mix(in srgb, var(--dw-text) 8%, transparent);
  color: var(--dw-text);
}

.titlebar-menu__btn {
  display: inline-flex;
  align-items: center;
  gap: var(--dw-space-2);
  height: var(--dw-titlebar-chip-size);
  padding: 0 var(--dw-space-5);
  border: none;
  border-radius: var(--dw-titlebar-chip-radius);
  background: transparent;
  color: var(--dw-text-muted);
  font-size: var(--dw-text-sm);
  font-weight: 500;
  line-height: 1;
  white-space: nowrap;
  cursor: pointer;
  transition: background var(--dw-duration-fast) var(--dw-ease), color var(--dw-duration-fast) var(--dw-ease), box-shadow 0.12s ease;
}

.titlebar-menu__btn.has-children {
  padding-right: 7px;
}

.titlebar-menu__btn:hover,
.titlebar-menu__item.is-open .titlebar-menu__btn:hover {
  background: color-mix(in srgb, var(--dw-text) 9%, transparent);
  color: var(--dw-text);
}

.titlebar-menu__btn.is-active {
  background: color-mix(in srgb, var(--dw-primary) 14%, transparent);
  color: var(--dw-primary);
  box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--dw-primary) 18%, transparent);
}

.titlebar-menu__btn-icon {
  opacity: 0.88;
}

.titlebar-menu__btn.is-active .titlebar-menu__btn-icon {
  opacity: 1;
}

.titlebar-menu__caret {
  width: var(--dw-icon-size-xs);
  height: var(--dw-icon-size-xs);
  opacity: 0.65;
  transition: transform var(--dw-duration) var(--dw-ease);
}

.titlebar-menu__item.is-open .titlebar-menu__caret {
  transform: rotate(180deg);
}

.titlebar-menu__dropdown {
  min-width: 196px;
  max-width: 260px;
  border: 1px solid color-mix(in srgb, var(--dw-panel-border) 88%, var(--dw-primary) 12%);
  border-radius: var(--dw-radius-xl);
  background: color-mix(in srgb, var(--dw-bg-editor) 94%, transparent);
  backdrop-filter: blur(14px);
  box-shadow:
      0 16px 40px rgba(0, 0, 0, 0.14),
      0 0 0 1px color-mix(in srgb, var(--dw-text) 4%, transparent);
  overflow: hidden;
}

.titlebar-menu__dropdown--fixed {
  position: fixed;
  z-index: var(--dw-z-window);
  -webkit-app-region: no-drag;
}

.titlebar-menu--nav-compact .titlebar-menu__btn-label {
  display: none;
}

.titlebar-menu--nav-compact .titlebar-menu__btn {
  padding: 0 var(--dw-space-3);
}

.titlebar-menu--nav-compact .titlebar-menu__btn.has-children {
  padding-right: 5px;
}

.titlebar-menu__dropdown-head {
  display: flex;
  align-items: center;
  gap: var(--dw-space-3);
  padding: 9px var(--dw-space-6) 7px;
  border-bottom: 1px solid color-mix(in srgb, var(--dw-text) 8%, transparent);
  background: color-mix(in srgb, var(--dw-primary) 5%, var(--dw-bg-editor));
}

.titlebar-menu__dropdown-head-icon {
  color: var(--dw-primary);
  opacity: 0.92;
}

.titlebar-menu__dropdown-title {
  font-size: var(--dw-text-xs);
  font-weight: 600;
  color: var(--dw-text);
  letter-spacing: 0.01em;
}

.titlebar-menu__dropdown-body {
  max-height: min(420px, 52vh);
  overflow-y: auto;
  padding: var(--dw-space-3);
}

.titlebar-menu__dropdown-group {
  padding: var(--dw-space-3) var(--dw-space-4) var(--dw-space-2);
  font-size: var(--dw-text-xs);
  font-weight: 600;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  color: var(--dw-text-muted);
}

.titlebar-menu__dropdown-group:not(:first-child) {
  padding-top: var(--dw-space-4);
}

.titlebar-menu__dropdown-divider {
  height: 1px;
  margin: var(--dw-space-2) var(--dw-space-3);
  background: color-mix(in srgb, var(--dw-text) 8%, transparent);
}

.titlebar-menu__dropdown-item {
  display: grid;
  grid-template-columns: 16px minmax(0, 1fr) auto;
  align-items: center;
  gap: var(--dw-gap);
  width: 100%;
  min-height: var(--dw-control-h);
  padding: 0 var(--dw-space-4);
  border: none;
  border-radius: var(--dw-control-radius);
  background: transparent;
  color: var(--dw-text);
  text-align: left;
  cursor: pointer;
  transition: background var(--dw-duration-fast) var(--dw-ease), color var(--dw-duration-fast) var(--dw-ease);
}

.titlebar-menu__dropdown-item:hover {
  background: color-mix(in srgb, var(--dw-primary) 10%, transparent);
  color: var(--dw-primary);
}

.titlebar-menu__dropdown-item.is-active {
  background: color-mix(in srgb, var(--dw-primary) 12%, transparent);
  color: var(--dw-primary);
}

.titlebar-menu__dropdown-leading {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: var(--dw-icon-size-md);
  height: var(--dw-icon-size-md);
}

.titlebar-menu__dropdown-copy {
  min-width: 0;
}

.titlebar-menu__dropdown-label {
  font-size: var(--dw-text-sm);
  line-height: var(--dw-leading-tight);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.titlebar-menu__dropdown-item.is-checked {
  color: var(--dw-text);
}

.titlebar-menu__dropdown-check {
  font-size: var(--dw-text-xs);
  font-weight: 700;
  color: var(--dw-primary);
}

.titlebar-menu__dropdown-item.is-active .titlebar-menu__dropdown-label {
  font-weight: 600;
}

.titlebar-menu__drag {
  flex: 1 1 0;
  min-width: 24px;
  height: 100%;
  -webkit-app-region: drag;
}

.titlebar-menu__badge {
  min-width: var(--dw-icon-size-sm);
  height: var(--dw-icon-size-sm);
  padding: 0 var(--dw-space-2);
  border-radius: var(--dw-radius-pill);
  background: color-mix(in srgb, var(--dw-warning) 18%, transparent);
  color: var(--dw-warning);
  font-size: var(--dw-text-2xs);
  font-weight: 700;
  line-height: var(--dw-tab-title-line);
  flex-shrink: 0;
}

.titlebar-dropdown-enter-active,
.titlebar-dropdown-leave-active {
  transition: opacity var(--dw-duration) var(--dw-ease), transform var(--dw-duration) var(--dw-ease);
}

.titlebar-dropdown-enter-from,
.titlebar-dropdown-leave-to {
  opacity: 0;
  transform: translateY(-4px);
}
</style>
