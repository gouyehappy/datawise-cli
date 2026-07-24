<script setup lang="ts">
import {useI18n} from 'vue-i18n'
import {DwIcon} from '@/core/icons'
import AppBrandLogo from '@/features/layout/components/AppBrandLogo.vue'
import DesktopTitleBarMenu from '@/features/layout/components/DesktopTitleBarMenu.vue'
import TitleBarAppMenu from '@/features/layout/components/TitleBarAppMenu.vue'
import WorkspaceActionDialogs from '@/features/layout/components/WorkspaceActionDialogs.vue'
import {useDesktopTitleBar} from '@/features/layout/composables/useDesktopTitleBar'

withDefaults(
    defineProps<{
      /** 启动页：只保留拖拽区与窗口按钮，隐藏菜单，背景与 Splash 融合 */
      minimal?: boolean
    }>(),
    {minimal: false},
)

const {t} = useI18n()
const {visible, maximized, isMac, minimize, toggleMaximize, close, beginFramelessWindowDrag} = useDesktopTitleBar()
</script>

<template>
  <header
      v-if="visible"
      class="desktop-titlebar"
      :class="{
        'desktop-titlebar--mac': isMac,
        'desktop-titlebar--minimal': minimal,
      }"
  >
    <div class="desktop-titlebar__lead">
      <div
          class="desktop-titlebar__icon"
          @pointerdown="beginFramelessWindowDrag"
          @dblclick.stop="toggleMaximize"
      >
        <AppBrandLogo v-if="!minimal" size="titlebar"/>
      </div>
      <TitleBarAppMenu v-if="!minimal"/>
    </div>

    <div
        v-if="minimal"
        class="desktop-titlebar__drag"
        @pointerdown="beginFramelessWindowDrag"
        @dblclick.stop="toggleMaximize"
    />
    <DesktopTitleBarMenu
        v-else
        class="desktop-titlebar__menu"
        @dblclick-drag="toggleMaximize"
    />

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

  <WorkspaceActionDialogs v-if="!minimal"/>
</template>

<style scoped>
.desktop-titlebar {
  display: flex;
  align-items: center;
  flex-shrink: 0;
  min-width: 0;
  height: var(--dw-titlebar-height);
  background: var(--dw-bg-chrome);
  position: relative;
  z-index: var(--dw-z-toolbar);
  user-select: none;
}

.desktop-titlebar--minimal {
  background: transparent;
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
  padding-right: var(--dw-space-1);
  -webkit-app-region: no-drag;
}

.desktop-titlebar--minimal .desktop-titlebar__lead {
  width: var(--dw-space-7);
  padding: 0;
}

.desktop-titlebar__icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  height: 100%;
  padding: 0 0 0 var(--dw-space-7);
  -webkit-app-region: drag;
}

.desktop-titlebar--minimal .desktop-titlebar__icon {
  padding: 0;
  width: 0;
  overflow: hidden;
}

.desktop-titlebar__drag {
  flex: 1;
  min-width: 0;
  height: 100%;
  -webkit-app-region: drag;
}

.desktop-titlebar__menu {
  flex: 1;
  min-width: 0;
  margin-left: var(--dw-space-6);
  padding-left: var(--dw-space-3);
}

.desktop-titlebar__controls {
  display: flex;
  align-items: center;
  gap: var(--dw-gap-xs);
  flex-shrink: 0;
  height: 100%;
  padding: 0 var(--dw-space-5) 0 var(--dw-space-2);
  -webkit-app-region: no-drag;
}

.desktop-titlebar__btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: var(--dw-titlebar-chip-size);
  height: var(--dw-titlebar-chip-size);
  border: none;
  border-radius: var(--dw-titlebar-chip-radius);
  background: transparent;
  color: var(--dw-text-secondary);
  cursor: pointer;
  transition: background var(--dw-duration-fast) var(--dw-ease), color var(--dw-duration-fast) var(--dw-ease);
}

.desktop-titlebar__btn:hover {
  background: var(--dw-titlebar-chip-hover);
  color: var(--dw-text);
}

.desktop-titlebar__btn--close:hover {
  background: var(--dw-danger);
  color: var(--dw-on-accent);
}

.desktop-titlebar__btn svg {
  width: var(--dw-icon-size-xs);
  height: var(--dw-icon-size-xs);
}
</style>
