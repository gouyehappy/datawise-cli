<script setup lang="ts">
import {computed} from 'vue'
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
import {useSessionKeepalive} from '@/features/auth/composables/useSessionKeepalive'

import OnboardingSpotlightTour from '@/features/onboarding/components/OnboardingSpotlightTour.vue'
import {useOnboardingGuide} from '@/features/onboarding/composables/useOnboardingGuide'
import {isDesktopApp} from '@/features/layout/services/desktop-chrome'
import {useDeepLinkListener} from '@/features/layout/composables/useDeepLinkListener'

const layout = useLayoutStore()
const appConfig = useAppConfigStore()
const auth = useAuthStore()
const {loginDialogOpen} = storeToRefs(auth)
const {open: onboardingOpen, showGuide, finishGuide, skipGuide} = useOnboardingGuide()

useAppShortcutListener()
useConnectionHealthMonitor()
useSessionKeepalive()
useDeepLinkListener()

const hasEmbeddedToolRail = computed(
    () => layout.isWorkbenchModule && appConfig.showShortcutRail,
)

const showStandaloneNotification = computed(
    () => layout.showNotificationDrawer && !hasEmbeddedToolRail.value,
)

const desktopApp = isDesktopApp()
</script>

<template>
  <div class="shell" :class="{'shell--desktop': desktopApp}">
    <div class="shell-body">
      <AppSideRail/>
      <div class="shell-main">
        <MainContent/>
      </div>
    </div>
    <StatusBar/>
    <NotificationDrawer v-if="showStandaloneNotification"/>
    <LoginDialog v-model:open="loginDialogOpen"/>
    <OnboardingSpotlightTour
        v-model:open="onboardingOpen"
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
  width: 100%;
  height: 100%;
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
