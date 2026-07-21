<script setup lang="ts">
import {computed, onMounted} from 'vue'
import {storeToRefs} from 'pinia'
import AppSideRail from '@/features/layout/components/AppSideRail.vue'
import MainContent from '@/features/layout/components/MainContent.vue'
import StatusBar from '@/features/layout/components/StatusBar.vue'
import NotificationDrawer from '@/features/layout/components/NotificationDrawer.vue'
import GlobalObjectSearchPalette from '@/features/layout/components/GlobalObjectSearchPalette.vue'
import LoginDialog from '@/features/auth/components/LoginDialog.vue'
import AppToast from '@/core/components/AppToast.vue'
import {useAuthStore} from '@/features/auth/stores/auth-store'
import {useLayoutStore} from '@/features/layout/stores/layout'
import {useAppConfigStore} from '@/features/layout/stores/app-config-store'
import {useAppShortcutListener} from '@/features/layout/composables/useAppShortcutListener'
import {useConnectionHealthMonitor} from '@/features/explorer/composables/useConnectionHealthMonitor'
import {useBackendHealthMonitor} from '@/features/layout/composables/useBackendHealthMonitor'
import {useSessionKeepalive} from '@/features/auth/composables/useSessionKeepalive'
import {useAppToast} from '@/features/layout/composables/useAppToast'
import {useI18n} from 'vue-i18n'

import OnboardingSpotlightTour from '@/features/onboarding/components/OnboardingSpotlightTour.vue'
import {useOnboardingGuide} from '@/features/onboarding/composables/useOnboardingGuide'
import {isDesktopApp} from '@/features/layout/services/desktop-chrome'
import {useDeepLinkListener} from '@/features/layout/composables/useDeepLinkListener'
import {useUpdaterListener} from '@/features/settings/composables/useUpdaterListener'

const layout = useLayoutStore()
const appConfig = useAppConfigStore()
const auth = useAuthStore()
const toast = useAppToast()
const {t} = useI18n()
const {loginDialogOpen} = storeToRefs(auth)
const {open: onboardingOpen, preset: onboardingPreset, showGuide, finishGuide, skipGuide} = useOnboardingGuide()

useAppShortcutListener()
useConnectionHealthMonitor()
useBackendHealthMonitor()
useSessionKeepalive()
useDeepLinkListener()
useUpdaterListener()

const hasEmbeddedToolRail = computed(
    () => layout.isWorkbenchModule && appConfig.showShortcutRail,
)

const showStandaloneNotification = computed(
    () => layout.showNotificationDrawer && !hasEmbeddedToolRail.value,
)

const desktopApp = isDesktopApp()

onMounted(async () => {
  const params = new URLSearchParams(window.location.search)
  const oidcSession = params.get('oidcSession')
  const oidcError = params.get('oidcError')
  const oidcUser = params.get('oidcUser')
  if (oidcError) {
    toast.error(t('auth.oidcFailed', {error: oidcError}))
  } else if (oidcSession) {
    try {
      await auth.completeOidcLogin(oidcSession, oidcUser || undefined)
      toast.success(t('auth.oidcSuccess'))
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t('auth.oidcFailed', {error: 'OIDC_FAILED'}))
    }
  }
  if (oidcSession || oidcError || oidcUser) {
    params.delete('oidcSession')
    params.delete('oidcError')
    params.delete('oidcUser')
    const next = `${window.location.pathname}${params.toString() ? `?${params}` : ''}${window.location.hash}`
    window.history.replaceState({}, '', next)
  }
})
</script>

<template>
  <div class="shell" :class="{'shell--desktop': desktopApp}">
    <div class="shell-body">
      <AppSideRail v-if="appConfig.showSideRailStrip"/>
      <div class="shell-main">
        <MainContent/>
      </div>
    </div>
    <StatusBar/>
    <NotificationDrawer v-if="showStandaloneNotification"/>
    <LoginDialog v-model:open="loginDialogOpen"/>
    <OnboardingSpotlightTour
        v-model:open="onboardingOpen"
        :preset="onboardingPreset"
        @finish="finishGuide"
        @skip="skipGuide"
    />
    <GlobalObjectSearchPalette/>
    <AppToast/>
  </div>
</template>

<style scoped>
.shell {
  display: flex;
  flex-direction: column;
  flex: 1;
  min-height: 0;
  width: 100%;
}

.shell-body {
  display: flex;
  flex: 1;
  min-height: 0;
  gap: var(--dw-panel-gap);
  padding: var(--dw-panel-gap);
  background: var(--dw-bg-chrome);
}

.shell-main {
  display: flex;
  flex-direction: column;
  flex: 1;
  min-width: 0;
  min-height: 0;
  gap: var(--dw-panel-gap);
  background: transparent;
}

.shell--desktop .shell-body {
  padding-top: 0;
}
</style>
