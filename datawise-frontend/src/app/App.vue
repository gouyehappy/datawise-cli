<!--
  根组件：Web 版显示内嵌启动页；桌面版使用独立小窗启动页。
-->
<script setup lang="ts">
import {computed, nextTick, onMounted, onUnmounted, ref, watch} from 'vue'
import {useI18n} from 'vue-i18n'
import AppShell from './AppShell.vue'
import AppSplash from './components/AppSplash.vue'
import DesktopTitleBar from '@/features/layout/components/DesktopTitleBar.vue'
import {bootstrapApp, bootstrapProgress} from './services/bootstrap-app.service'
import {
    desktopStartupProgress,
    initDesktopBackendStartupListener,
    type BackendStartupPhase,
} from '@/features/layout/services/desktop-backend-startup.service'
import {readDesktopBridge} from '@/features/layout/services/desktop-bridge'
import {currentLocale} from '@/i18n'
import {isDesktopApp} from '@/features/layout/services/desktop-chrome'
import ports from '../../runtime-ports.json'

const DEV_BACKEND_ENDPOINT = `127.0.0.1:${ports.backend}`
const PACKAGED_BACKEND_ENDPOINT = `127.0.0.1:${ports.backendPackaged}`
const MAIN_SHELL_SETTLE_MS = 900
const SPLASH_PROGRESS_STEP_MS = 850
const SPLASH_AT_100_HOLD_MS = 1_600
const SPLASH_FINISH_HOLD_MS = 750

/** 从当前已显示进度平滑补到 100%，绝不回退 */
function buildSplashFinishSteps(from: number): number[] {
    const start = Math.max(0, Math.min(99, Math.round(from)))
    const gap = 100 - start
    if (gap <= 0) return [100]
    if (gap <= 6) return [100]
    if (gap <= 14) {
        const mid = start + Math.round(gap * 0.55)
        return mid >= 100 ? [100] : [mid, 100]
    }
    const step1 = start + Math.round(gap * 0.38)
    const step2 = start + Math.round(gap * 0.72)
    const steps = [step1, step2, 100]
    return steps.filter((value, index) => index === 0 || value > steps[index - 1])
}

function delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms))
}

function waitNextPaint(): Promise<void> {
    return new Promise((resolve) => {
        requestAnimationFrame(() => requestAnimationFrame(() => resolve()))
    })
}

const {t, locale} = useI18n()
const bootReady = ref(false)
const desktopApp = computed(() => isDesktopApp())

watch(
    [currentLocale, locale],
    () => {
      document.documentElement.lang = currentLocale.value
    },
    {immediate: true},
)

function resolveDesktopSplashStatus(): string {
    const phase = desktopStartupProgress.phase as BackendStartupPhase
    const bridge = readDesktopBridge()
    const isPackaged = bridge?.splash?.getMeta?.()?.isPackaged ?? false
    const endpoint = isPackaged ? PACKAGED_BACKEND_ENDPOINT : DEV_BACKEND_ENDPOINT

    switch (phase) {
        case 'config':
            return t('app.splashBackend.startupConfig')
        case 'spawning':
            return isPackaged
                ? t('app.splashBackend.startupSpawning')
                : t('app.splashBackend.startupSpawningDev', {endpoint})
        case 'warming':
            return isPackaged
                ? t('app.splashBackend.startupWarming', {endpoint})
                : t('app.splashBackend.startupWarmingDev', {endpoint})
        case 'session':
            return t('app.splashBackend.startupSession')
        case 'sync':
            return t('app.splashBackend.startupSync')
        case 'ready':
            return t('app.splashBackend.startupFinalize')
        case 'failed':
            return t('app.splashBackend.startupFailed')
        default:
            return t('app.splashBackend.startupIdle')
    }
}

function reportDesktopSplashProgress() {
    const bridge = readDesktopBridge()
    if (!bridge?.splash?.reportProgress) return
    const progress = Math.max(
        lastSplashProgressSent,
        Math.round(desktopStartupProgress.displayProgress),
        bootstrapProgress.progress,
    )
    bridge.splash.reportProgress({
        progress,
        status: resolveDesktopSplashStatus(),
    })
    lastSplashProgressSent = progress
}

let splashProgressTimer: ReturnType<typeof setInterval> | null = null
let desktopStartupFinalized = false
let lastSplashProgressSent = 0

function startDesktopSplashReporter() {
    reportDesktopSplashProgress()
    splashProgressTimer = setInterval(reportDesktopSplashProgress, 120)
}

function stopDesktopSplashReporter() {
    if (splashProgressTimer) {
        clearInterval(splashProgressTimer)
        splashProgressTimer = null
    }
}

function notifyDesktopSplashReady() {
    readDesktopBridge()?.splash?.notifyReady?.()
}

async function animateSplashProgressToComplete() {
    const bridge = readDesktopBridge()
    if (!bridge?.splash?.reportProgress) return

    reportDesktopSplashProgress()

    const finalizeStatus = t('app.splashBackend.startupFinalize')
    const completeStatus = t('app.splashBackend.startupComplete')
    const finishSteps = buildSplashFinishSteps(lastSplashProgressSent)

    for (const progress of finishSteps) {
        if (progress <= lastSplashProgressSent) continue
        bridge.splash.reportProgress({
            progress,
            status: progress >= 100 ? completeStatus : finalizeStatus,
        })
        lastSplashProgressSent = progress
        if (progress < 100) {
            await delay(SPLASH_PROGRESS_STEP_MS)
        }
    }

    await bridge.splash.waitBarComplete?.(100)
    await delay(SPLASH_AT_100_HOLD_MS)
}

async function completeDesktopStartup() {
    if (desktopStartupFinalized) return
    desktopStartupFinalized = true
    stopDesktopSplashReporter()

    await animateSplashProgressToComplete()

    bootReady.value = true
    await nextTick()
    await waitNextPaint()
    await delay(MAIN_SHELL_SETTLE_MS)
    await delay(SPLASH_FINISH_HOLD_MS)

    notifyDesktopSplashReady()
}

onMounted(() => {
  if (desktopApp.value) {
    initDesktopBackendStartupListener()
    startDesktopSplashReporter()
  }

  const BOOTSTRAP_MAX_MS = desktopApp.value ? 125_000 : 90_000
  const timeout = window.setTimeout(() => {
    if (desktopApp.value) {
      void completeDesktopStartup()
      return
    }
    stopDesktopSplashReporter()
    bootReady.value = true
  }, BOOTSTRAP_MAX_MS)

  void bootstrapApp().finally(() => {
    window.clearTimeout(timeout)
    if (desktopApp.value) {
      void completeDesktopStartup()
      return
    }
    stopDesktopSplashReporter()
    bootReady.value = true
  })
})

onUnmounted(() => {
  stopDesktopSplashReporter()
})
</script>

<template>
  <div class="app" :class="{'app--desktop': desktopApp}">
    <DesktopTitleBar v-if="bootReady || !desktopApp"/>
    <div class="app-body">
      <template v-if="desktopApp">
        <AppShell v-if="bootReady" key="shell"/>
      </template>
      <template v-else>
        <Transition name="app-boot" mode="out-in">
          <AppSplash v-if="!bootReady" key="splash"/>
          <AppShell v-else key="shell"/>
        </Transition>
      </template>
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
  overflow: hidden;
}

.app-body > :deep(.shell),
.app-body > :deep(.app-splash) {
  flex: 1;
  min-height: 0;
  width: 100%;
}

.app-boot-enter-active,
.app-boot-leave-active {
  transition: opacity 0.28s ease;
}

.app-boot-enter-active :deep(.shell),
.app-boot-enter-to :deep(.shell) {
  opacity: 1;
}

.app-boot-enter-from,
.app-boot-leave-to {
  opacity: 0;
}
</style>
