<!--
  根组件：启动加载页 → 初始化完成后进入 AppShell。
-->
<script setup lang="ts">
import {computed, onMounted, ref, watch} from 'vue'
import {useI18n} from 'vue-i18n'
import AppShell from './AppShell.vue'
import AppSplash from './components/AppSplash.vue'
import DesktopTitleBar from '@/features/layout/components/DesktopTitleBar.vue'
import {bootstrapApp} from './services/bootstrap-app.service'
import {currentLocale} from '@/i18n'
import {isDesktopApp} from '@/features/layout/services/desktop-chrome'

const {locale} = useI18n()
const bootReady = ref(false)
const desktopApp = computed(() => isDesktopApp())

watch(
    [currentLocale, locale],
    () => {
      document.documentElement.lang = currentLocale.value
    },
    {immediate: true},
)

onMounted(() => {
  void bootstrapApp().finally(() => {
    bootReady.value = true
  })
})
</script>

<template>
  <div class="app" :class="{'app--desktop': desktopApp}">
    <DesktopTitleBar/>
    <div class="app-body">
      <Transition name="app-boot" mode="out-in">
        <AppSplash v-if="!bootReady" key="splash"/>
        <AppShell v-else key="shell"/>
      </Transition>
    </div>
  </div>
</template>

<style scoped>
.app {
  display: flex;
  flex-direction: column;
  width: 100%;
  height: 100%;
}

.app--desktop {
  --dw-titlebar-height: 44px;
  background: var(--dw-bg-chrome);
}

.app--desktop .app-body {
  background: var(--dw-bg-chrome);
}

.app-body {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
}

.app-boot-enter-active,
.app-boot-leave-active {
  transition: opacity 0.28s ease;
}

.app-boot-enter-from,
.app-boot-leave-to {
  opacity: 0;
}
</style>
