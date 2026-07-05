<!-- 最左侧竖条导航：模块切换 + 底部 Terminal（IDEA 工具窗口布局） -->
<script setup lang="ts">
import {computed} from 'vue'
import {useI18n} from 'vue-i18n'
import {storeToRefs} from 'pinia'
import {usePopoverEscape} from '@/core/composables/usePopoverEscape'
import ProfileMenuPopover from '@/features/layout/components/ProfileMenuPopover.vue'
import AppBrandLogo from '@/features/layout/components/AppBrandLogo.vue'
import {DwIcon, sideRailDwIcon} from '@/core/icons'
import {useAppConfigStore} from '@/features/layout/stores/app-config-store'
import {SIDE_RAIL_NAV_DEFS, type SideRailItemId} from '@/features/layout/constants/side-rail-nav'
import {useLayoutStore} from '@/features/layout/stores/layout'
import {useNotificationStore} from '@/features/layout/stores/notification-store'
import {usePluginStore} from '@/features/plugin/stores/plugin-store'
import {runExplorerRefresh} from '@/features/explorer/services/explorer-toolbar.actions'
import {isDesktopApp} from '@/features/layout/services/desktop-chrome'
import type {NavModule} from '@/core/types'

const {t} = useI18n()
const layout = useLayoutStore()
const appConfig = useAppConfigStore()
const pluginStore = usePluginStore()
const notifications = useNotificationStore()
const {showProfileMenu} = storeToRefs(layout)
const desktopApp = isDesktopApp()

usePopoverEscape(showProfileMenu, () => layout.closeProfileMenu())

interface NavItem {
  id: SideRailItemId
  labelKey: string
  caption: string
  section: 'main' | 'util' | 'bottom'
}

const navDefs = SIDE_RAIL_NAV_DEFS

const mainItems = computed(() =>
    navDefs
        .filter((item) => item.section === 'main' && appConfig.isSideRailVisible(item.id))
        .filter((item) => item.id !== 'ai' || pluginStore.isEnabled('p-ai-workbench'))
        .map((item) => ({...item, label: t(item.labelKey)})),
)

const utilItems = computed(() =>
    navDefs
        .filter((item) => item.section === 'util' && appConfig.isSideRailVisible(item.id))
        .map((item) => ({...item, label: t(item.labelKey)})),
)

const terminalItem = computed(() => {
  const item = navDefs.find((entry) => entry.id === 'terminal')
  if (!item || !appConfig.isSideRailVisible('terminal')) return null
  return {...item, label: t(item.labelKey)}
})

function onClick(id: NavItem['id']) {
  if (!appConfig.isSideRailVisible(id)) return
  if (id === 'refresh') {
    void runExplorerRefresh()
    return
  }
  if (id === 'notify') {
    layout.activeShortcutPanel = null
    layout.showNotificationDrawer = !layout.showNotificationDrawer
    return
  }
  if (id === 'feedback') {
    layout.showToast(t('nav.feedbackToast'))
    return
  }
  if (id === 'terminal') {
    layout.toggleTerminalPanel()
    return
  }
  if (id === 'database') {
    if (layout.activeModule === 'database' && appConfig.showExplorerPanel) {
      appConfig.setShowExplorerPanel(false)
      return
    }
    if (!appConfig.showExplorerPanel) {
      appConfig.setShowExplorerPanel(true)
    }
    layout.setModule('database')
    return
  }
  layout.setModule(id)
}

function isActive(id: NavItem['id']) {
  if (id === 'notify') return layout.showNotificationDrawer
  if (id === 'terminal') return layout.showTerminalPanel
  if (id === 'database') {
    return layout.activeModule === 'database' && appConfig.showExplorerPanel
  }
  return id === layout.activeModule
}

function toggleProfileMenu() {
  layout.toggleProfileMenu()
}
</script>

<template>
  <aside class="tool-stripe tool-stripe--left">
    <div v-if="!desktopApp" class="nav-brand" data-onboarding="nav-home">
      <button
          class="tool-btn tool-btn--brand tool-btn--stack"
          :class="{ active: layout.showProfileMenu }"
          type="button"
          :aria-label="layout.profileName"
          @click="toggleProfileMenu"
      >
        <span class="tool-btn__graphic tool-btn__graphic--brand">
          <AppBrandLogo/>
        </span>
        <span class="tool-btn__caption">Home</span>
      </button>
      <ProfileMenuPopover v-if="layout.showProfileMenu" @close="layout.closeProfileMenu()"/>
    </div>

    <nav class="tool-stripe__group" :aria-label="t('nav.mainLabel')">
      <button
          v-for="item in mainItems"
          :key="item.id"
          class="tool-btn tool-btn--stack"
          :class="{ active: isActive(item.id) }"
          :data-onboarding="item.id === 'database' ? 'nav-database' : item.id === 'ai' ? 'nav-ai' : undefined"
          type="button"
          :aria-label="item.label"
          :aria-current="isActive(item.id) ? 'page' : undefined"
          @click="onClick(item.id)"
      >
        <span class="tool-btn__graphic">
          <DwIcon :name="sideRailDwIcon(item.id)" size="rail" :stroke-width="1.7"/>
        </span>
        <span class="tool-btn__caption">{{ item.caption }}</span>
      </button>
    </nav>

    <div class="tool-stripe__spacer" aria-hidden="true"/>

    <nav class="tool-stripe__group" :aria-label="t('nav.utilLabel')">
      <button
          v-for="item in utilItems"
          :key="item.id"
          class="tool-btn tool-btn--stack"
          :class="{ active: isActive(item.id) }"
          type="button"
          :aria-label="item.label"
          @click="onClick(item.id)"
      >
        <span class="tool-btn__graphic">
          <template v-if="item.id === 'notify'">
            <DwIcon :name="sideRailDwIcon(item.id)" size="rail" :stroke-width="1.7"/>
            <span v-if="notifications.unreadCount" class="tool-btn__badge">{{ notifications.unreadCount }}</span>
          </template>
          <DwIcon v-else :name="sideRailDwIcon(item.id)" size="rail" :stroke-width="1.7"/>
        </span>
        <span class="tool-btn__caption">{{ item.caption }}</span>
      </button>
    </nav>

    <nav
        v-if="terminalItem"
        class="tool-stripe__group tool-stripe__group--bottom"
        :aria-label="terminalItem.label"
    >
      <button
          class="tool-btn tool-btn--stack"
          :class="{ active: isActive('terminal') }"
          type="button"
          data-onboarding="nav-terminal"
          :aria-label="terminalItem.label"
          :aria-pressed="layout.showTerminalPanel"
          @click="onClick('terminal')"
      >
        <span class="tool-btn__graphic">
          <DwIcon name="terminal" size="rail" :stroke-width="1.7"/>
        </span>
        <span class="tool-btn__caption">{{ terminalItem.caption }}</span>
      </button>
    </nav>
  </aside>
</template>
