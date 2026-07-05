<script setup lang="ts">
import {useI18n} from 'vue-i18n'
import {DwIcon} from '@/core/icons'
import AppBrandLogo from '@/features/layout/components/AppBrandLogo.vue'
import DesktopTitleBarMenu from '@/features/layout/components/DesktopTitleBarMenu.vue'
import TitleBarAppMenu from '@/features/layout/components/TitleBarAppMenu.vue'
import WorkspaceActionDialogs from '@/features/layout/components/WorkspaceActionDialogs.vue'
import {useDesktopTitleBar} from '@/features/layout/composables/useDesktopTitleBar'

const {t} = useI18n()
const {visible, maximized, isMac, minimize, toggleMaximize, close} = useDesktopTitleBar()
</script>

<template>
  <header v-if="visible" class="desktop-titlebar" :class="{'desktop-titlebar--mac': isMac}">
    <div class="desktop-titlebar__lead">
      <div class="desktop-titlebar__icon" @dblclick.stop="toggleMaximize">
        <AppBrandLogo size="titlebar"/>
      </div>
      <TitleBarAppMenu/>
    </div>

    <DesktopTitleBarMenu class="desktop-titlebar__menu" @dblclick-drag="toggleMaximize"/>

    <div v-if="!isMac" class="desktop-titlebar__controls">
      <button
          type="button"
          class="desktop-titlebar__btn"
          :aria-label="t('app.titleBar.minimize')"
          @click="minimize"
      >
        <DwIcon name="minus" :size="12" :stroke-width="1.2"/>
      </button>
      <button
          type="button"
          class="desktop-titlebar__btn"
          :aria-label="maximized ? t('app.titleBar.restore') : t('app.titleBar.maximize')"
          @click="toggleMaximize"
      >
        <DwIcon v-if="!maximized" name="fullscreen" :size="12" :stroke-width="1.1"/>
        <DwIcon v-else name="fullscreen" active :size="12" :stroke-width="1.1"/>
      </button>
      <button
          type="button"
          class="desktop-titlebar__btn desktop-titlebar__btn--close"
          :aria-label="t('app.titleBar.close')"
          @click="close"
      >
        <DwIcon name="x" :size="12" :stroke-width="1.2"/>
      </button>
    </div>
  </header>

  <WorkspaceActionDialogs/>
</template>

<style scoped>
.desktop-titlebar {
  --dw-titlebar-chip-size: 30px;
  --dw-titlebar-chip-radius: 7px;
  --dw-titlebar-chip-hover: color-mix(in srgb, var(--dw-text) 8%, transparent);
  --dw-titlebar-chip-active: color-mix(in srgb, var(--dw-text) 11%, transparent);

  display: flex;
  align-items: center;
  flex-shrink: 0;
  min-width: 0;
  height: var(--dw-titlebar-height, 44px);
  background: var(--dw-bg-chrome);
  user-select: none;
}

.desktop-titlebar--mac {
  padding-left: 72px;
}

.desktop-titlebar__lead {
  display: flex;
  align-items: center;
  gap: 0;
  flex-shrink: 0;
  height: 100%;
  padding-right: 2px;
  -webkit-app-region: no-drag;
}

.desktop-titlebar__icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  height: 100%;
  padding: 0 0 0 14px;
  -webkit-app-region: drag;
}

.desktop-titlebar__menu {
  flex: 1;
  min-width: 0;
  margin-left: 12px;
  padding-left: 6px;
}

.desktop-titlebar__controls {
  display: flex;
  align-items: center;
  gap: 4px;
  flex-shrink: 0;
  height: 100%;
  padding: 0 10px 0 4px;
  -webkit-app-region: no-drag;
}

.desktop-titlebar__btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: var(--dw-titlebar-chip-size, 30px);
  height: var(--dw-titlebar-chip-size, 30px);
  border: none;
  border-radius: var(--dw-titlebar-chip-radius, 7px);
  background: transparent;
  color: var(--dw-text-secondary);
  cursor: pointer;
  transition: background 0.12s ease, color 0.12s ease;
}

.desktop-titlebar__btn:hover {
  background: var(--dw-titlebar-chip-hover, color-mix(in srgb, var(--dw-text) 8%, transparent));
  color: var(--dw-text);
}

.desktop-titlebar__btn--close:hover {
  background: #e81123;
  color: #ffffff;
}

.desktop-titlebar__btn svg {
  width: 12px;
  height: 12px;
}
</style>
