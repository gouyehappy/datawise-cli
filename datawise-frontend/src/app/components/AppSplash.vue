<script setup lang="ts">
import {computed} from 'vue'
import {useI18n} from 'vue-i18n'
import AppBrandLogo from '@/features/layout/components/AppBrandLogo.vue'
import {bootstrapProgress, type BootstrapStepId} from '@/app/services/bootstrap-app.service'
import {isDesktopApp} from '@/features/layout/services/desktop-chrome'

const {t} = useI18n()
const desktopApp = isDesktopApp()

const statusText = computed(() => {
  if (desktopApp) {
    return t('app.splashLoading')
  }
  return t(`app.splashSteps.${bootstrapProgress.currentStep as BootstrapStepId}`)
})
</script>

<template>
  <div class="app-splash" role="status" aria-live="polite" :aria-label="statusText">
    <div class="app-splash__panel">
      <AppBrandLogo size="lg" class="app-splash__logo"/>
      <h1 class="app-splash__title">{{ t('app.title') }}</h1>
      <p class="app-splash__status">{{ statusText }}</p>
      <span class="app-splash__spinner" aria-hidden="true"/>
    </div>
  </div>
</template>

<style scoped>
.app-splash {
  display: flex;
  align-items: center;
  justify-content: center;
  flex: 1;
  min-height: 0;
  width: 100%;
  background: var(--dw-bg-muted);
  color: var(--dw-text);
}

.app-splash__panel {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 14px;
  padding: 32px 40px;
  animation: splash-enter 0.45s ease both;
}

.app-splash__logo {
  margin-bottom: 4px;
}

.app-splash__title {
  margin: 0;
  font-size: 22px;
  font-weight: 700;
  letter-spacing: -0.03em;
}

.app-splash__status {
  margin: 0;
  font-size: 13px;
  color: var(--dw-text-secondary);
}

.app-splash__spinner {
  width: 28px;
  height: 28px;
  margin-top: 8px;
  border-radius: 50%;
  border: 3px solid color-mix(in srgb, var(--dw-primary) 18%, transparent);
  border-top-color: var(--dw-primary);
  animation: splash-spin 0.75s linear infinite;
}

@keyframes splash-enter {
  from {
    opacity: 0;
    transform: translateY(10px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

@keyframes splash-spin {
  to {
    transform: rotate(360deg);
  }
}
</style>
