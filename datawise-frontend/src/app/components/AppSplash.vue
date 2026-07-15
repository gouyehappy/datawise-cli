<script setup lang="ts">
import {computed} from 'vue'
import {useI18n} from 'vue-i18n'
import AppBrandLogo from '@/features/layout/components/AppBrandLogo.vue'
import {bootstrapProgress, type BootstrapStepId} from '@/app/services/bootstrap-app.service'
import {
    desktopStartupProgress,
    type BackendStartupPhase,
} from '@/features/layout/services/desktop-backend-startup.service'
import {isDesktopApp} from '@/features/layout/services/desktop-chrome'
import {APP_VERSION} from '@/features/settings/services/about-settings.service'

const {t} = useI18n()
const desktopApp = isDesktopApp()

const progressValue = computed(() => {
    if (desktopApp) {
        return Math.round(desktopStartupProgress.displayProgress)
    }
    return bootstrapProgress.progress
})

const statusText = computed(() => {
    if (desktopApp) {
        const phase = desktopStartupProgress.phase as BackendStartupPhase
        switch (phase) {
            case 'config':
                return t('app.splashBackend.startupConfig')
            case 'spawning':
                return t('app.splashBackend.startupSpawning')
            case 'warming':
                return t('app.splashBackend.startupWarming')
            case 'session':
                return t('app.splashBackend.startupSession')
            case 'sync':
                return t('app.splashBackend.startupSync')
            case 'ready':
                return t('app.splashBackend.startupFinalize')
            default:
                return t('app.splashLoading')
        }
    }
    return t(`app.splashSteps.${bootstrapProgress.currentStep as BootstrapStepId}`)
})
</script>

<template>
  <div class="app-splash" role="status" aria-live="polite" :aria-label="statusText">
    <div class="app-splash__wave app-splash__wave--a" aria-hidden="true"/>
    <div class="app-splash__wave app-splash__wave--b" aria-hidden="true"/>

    <div class="app-splash__main">
      <div class="app-splash__brand">
        <AppBrandLogo size="md" class="app-splash__logo"/>
        <h1 class="app-splash__title">{{ t('app.title') }}</h1>
      </div>
      <p class="app-splash__tagline">{{ t('app.splashTagline') }}</p>
    </div>

    <div class="app-splash__footer">
      <p class="app-splash__status">{{ statusText }}</p>
      <div
          class="app-splash__progress"
          role="progressbar"
          :aria-valuenow="progressValue"
          aria-valuemin="0"
          aria-valuemax="100"
          :aria-label="t('app.startupProgress', {progress: progressValue})"
      >
        <span class="app-splash__progress-fill" :style="{width: `${progressValue}%`}"/>
      </div>
      <p class="app-splash__version">{{ t('app.splashVersion', {version: APP_VERSION}) }}</p>
    </div>
  </div>
</template>

<style scoped>
.app-splash {
  --splash-bg: var(--dw-bg-muted);
  --splash-text: var(--dw-text);
  --splash-muted: var(--dw-text-muted);
  --splash-track: var(--dw-border-light);
  --splash-accent: #6d72f8;
  --splash-accent-end: #5248e8;

  position: relative;
  display: flex;
  flex-direction: column;
  flex: 1;
  min-height: 0;
  width: 100%;
  overflow: hidden;
  background: var(--splash-bg);
  color: var(--splash-text);
}

.app-splash__wave {
  position: absolute;
  border-radius: 50%;
  pointer-events: none;
}

.app-splash__wave--a {
  width: 72%;
  height: 140%;
  top: -42%;
  left: -18%;
  background: radial-gradient(
      ellipse at 40% 55%,
      rgba(109, 114, 248, 0.14) 0%,
      rgba(109, 114, 248, 0.04) 42%,
      transparent 68%
  );
  transform: rotate(-8deg);
}

.app-splash__wave--b {
  width: 58%;
  height: 110%;
  right: -12%;
  bottom: -28%;
  background: radial-gradient(
      ellipse at 55% 45%,
      rgba(34, 211, 238, 0.1) 0%,
      rgba(82, 72, 232, 0.05) 38%,
      transparent 70%
  );
  transform: rotate(12deg);
}

.app-splash__main {
  position: relative;
  z-index: 1;
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: var(--dw-space-7);
  padding: var(--dw-space-12) 48px var(--dw-space-10);
  animation: splash-fade-in 0.5s ease both;
}

.app-splash__brand {
  display: flex;
  align-items: center;
  gap: var(--dw-space-7);
}

.app-splash__logo {
  flex-shrink: 0;
}

.app-splash__title {
  margin: 0;
  font-size: var(--dw-text-display);
  font-weight: 700;
  letter-spacing: -0.03em;
  line-height: 1;
  color: var(--splash-text);
}

.app-splash__tagline {
  margin: 0;
  font-size: var(--dw-text-lg);
  font-weight: 500;
  color: var(--splash-muted);
  letter-spacing: 0.01em;
}

.app-splash__footer {
  position: relative;
  z-index: 1;
  padding: 0 48px 36px;
  animation: splash-fade-in 0.55s ease 0.08s both;
}

.app-splash__status {
  margin: 0 0 var(--dw-space-5);
  font-size: var(--dw-text-sm);
  color: var(--splash-muted);
}

.app-splash__progress {
  height: 2px;
  border-radius: var(--dw-radius-pill);
  background: var(--splash-track);
  overflow: hidden;
}

.app-splash__progress-fill {
  display: block;
  height: 100%;
  border-radius: inherit;
  background: linear-gradient(90deg, var(--splash-accent) 0%, var(--splash-accent-end) 100%);
  transition: width 0.35s ease;
}

.app-splash__version {
  margin: var(--dw-space-8) 0 0;
  text-align: center;
  font-size: var(--dw-text-sm);
  color: var(--splash-muted);
}

@keyframes splash-fade-in {
  from {
    opacity: 0;
    transform: translateY(8px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

@media (max-width: 520px) {
  .app-splash__main,
  .app-splash__footer {
    padding-left: var(--dw-space-11);
    padding-right: var(--dw-space-11);
  }

  .app-splash__title {
    font-size: var(--dw-text-display);
  }

  .app-splash__tagline {
    font-size: var(--dw-text-xl);
    text-align: center;
  }
}
</style>
