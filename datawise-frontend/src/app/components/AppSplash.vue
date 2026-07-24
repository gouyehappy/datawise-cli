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
    <div class="app-splash__atmosphere" aria-hidden="true">
      <span class="app-splash__orb app-splash__orb--a"/>
      <span class="app-splash__orb app-splash__orb--b"/>
      <span class="app-splash__orb app-splash__orb--c"/>
      <span class="app-splash__grid"/>
    </div>

    <div class="app-splash__stage">
      <div class="app-splash__hero">
        <div class="app-splash__mark">
          <span class="app-splash__ring" aria-hidden="true"/>
          <span class="app-splash__ring app-splash__ring--lag" aria-hidden="true"/>
          <AppBrandLogo size="lg" class="app-splash__logo"/>
        </div>

        <p class="app-splash__kicker">{{ t('app.splashKicker') }}</p>
        <h1 class="app-splash__title">{{ t('app.title') }}</h1>
        <p class="app-splash__tagline">{{ t('app.splashTagline') }}</p>
      </div>

      <div class="app-splash__load">
        <div class="app-splash__load-row">
          <p class="app-splash__status">{{ statusText }}</p>
          <span class="app-splash__percent">{{ progressValue }}%</span>
        </div>
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
        <p class="app-splash__footer-line">
          <span>{{ t('app.splashFooter') }}</span>
          <span class="app-splash__dot" aria-hidden="true"/>
          <span>{{ t('app.splashVersion', {version: APP_VERSION}) }}</span>
        </p>
      </div>
    </div>
  </div>
</template>

<style scoped>
.app-splash {
  --splash-accent: var(--dw-primary);
  --splash-accent-deep: var(--dw-primary-hover);
  --splash-glow: color-mix(in srgb, var(--dw-primary) 28%, transparent);
  --splash-sky: color-mix(in srgb, var(--mp-tone-sky) 55%, var(--dw-primary));

  position: relative;
  display: flex;
  flex-direction: column;
  flex: 1;
  min-height: 0;
  width: 100%;
  overflow: hidden;
  background:
      radial-gradient(120% 80% at 50% -10%, color-mix(in srgb, var(--dw-primary) 10%, transparent), transparent 55%),
      linear-gradient(
          165deg,
          color-mix(in srgb, var(--dw-bg-editor) 88%, var(--dw-bg-chrome)) 0%,
          var(--dw-bg-editor) 48%,
          color-mix(in srgb, var(--dw-bg-muted) 70%, var(--dw-bg-editor)) 100%
      );
  color: var(--dw-text);
}

.app-splash__atmosphere {
  position: absolute;
  inset: 0;
  pointer-events: none;
  overflow: hidden;
}

.app-splash__orb {
  position: absolute;
  border-radius: 50%;
  filter: blur(2px);
}

.app-splash__orb--a {
  width: min(58vw, 560px);
  height: min(58vw, 560px);
  top: -18%;
  left: 50%;
  translate: -50% 0;
  background: radial-gradient(circle, var(--splash-glow) 0%, transparent 68%);
  animation: splash-drift 12s ease-in-out infinite alternate;
}

.app-splash__orb--b {
  width: min(42vw, 380px);
  height: min(42vw, 380px);
  right: -8%;
  bottom: 8%;
  background: radial-gradient(circle, color-mix(in srgb, var(--splash-sky) 22%, transparent) 0%, transparent 70%);
  animation: splash-drift 16s ease-in-out infinite alternate-reverse;
}

.app-splash__orb--c {
  width: min(36vw, 300px);
  height: min(36vw, 300px);
  left: -6%;
  bottom: -4%;
  background: radial-gradient(circle, color-mix(in srgb, var(--dw-primary) 12%, transparent) 0%, transparent 72%);
  animation: splash-drift 14s ease-in-out infinite alternate;
}

.app-splash__grid {
  position: absolute;
  inset: 0;
  opacity: 0.35;
  background-image:
      linear-gradient(color-mix(in srgb, var(--dw-text) 5%, transparent) 1px, transparent 1px),
      linear-gradient(90deg, color-mix(in srgb, var(--dw-text) 5%, transparent) 1px, transparent 1px);
  background-size: 48px 48px;
  mask-image: radial-gradient(ellipse 70% 60% at 50% 42%, #000 20%, transparent 75%);
}

.app-splash__stage {
  position: relative;
  z-index: 1;
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: clamp(40px, 7vh, 72px);
  padding: clamp(32px, 6vh, 64px) clamp(24px, 5vw, 56px);
}

.app-splash__hero {
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
  max-width: 42rem;
  animation: splash-rise 0.7s cubic-bezier(0.22, 1, 0.36, 1) both;
}

.app-splash__mark {
  position: relative;
  display: grid;
  place-items: center;
  width: 96px;
  height: 96px;
  margin-bottom: var(--dw-space-9);
}

.app-splash__ring {
  position: absolute;
  inset: 0;
  border-radius: 50%;
  border: 1px solid color-mix(in srgb, var(--dw-primary) 28%, transparent);
  box-shadow: 0 0 0 8px color-mix(in srgb, var(--dw-primary) 5%, transparent);
  animation: splash-pulse 2.8s ease-out infinite;
}

.app-splash__ring--lag {
  inset: -10px;
  border-color: color-mix(in srgb, var(--splash-sky) 22%, transparent);
  box-shadow: none;
  animation-delay: 0.9s;
  opacity: 0.7;
}

.app-splash__logo {
  position: relative;
  z-index: 1;
  width: 64px !important;
  height: 64px !important;
  box-shadow:
      0 12px 32px color-mix(in srgb, var(--dw-primary) 34%, transparent),
      0 2px 8px color-mix(in srgb, var(--dw-text) 8%, transparent) !important;
}

.app-splash__kicker {
  margin: 0 0 var(--dw-space-4);
  font-size: var(--dw-text-xs);
  font-weight: 650;
  letter-spacing: 0.14em;
  text-transform: uppercase;
  color: color-mix(in srgb, var(--dw-primary) 72%, var(--dw-text-secondary));
}

.app-splash__title {
  margin: 0;
  font-size: clamp(40px, 6.2vw, 56px);
  font-weight: 750;
  letter-spacing: -0.045em;
  line-height: 1;
  background: linear-gradient(
      120deg,
      var(--dw-text) 12%,
      color-mix(in srgb, var(--dw-primary) 55%, var(--dw-text)) 52%,
      var(--dw-text) 88%
  );
  -webkit-background-clip: text;
  background-clip: text;
  color: transparent;
}

.app-splash__tagline {
  margin: var(--dw-space-6) 0 0;
  max-width: 34rem;
  font-size: clamp(15px, 1.7vw, 17px);
  font-weight: 500;
  line-height: var(--dw-leading-relaxed);
  color: var(--dw-text-secondary);
  letter-spacing: 0.01em;
}

.app-splash__load {
  width: min(100%, 420px);
  animation: splash-rise 0.75s cubic-bezier(0.22, 1, 0.36, 1) 0.12s both;
}

.app-splash__load-row {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: var(--dw-gap);
  margin-bottom: var(--dw-space-4);
}

.app-splash__status {
  margin: 0;
  font-size: var(--dw-text-sm);
  color: var(--dw-text-secondary);
}

.app-splash__percent {
  font-size: var(--dw-text-xs);
  font-weight: 650;
  font-variant-numeric: tabular-nums;
  letter-spacing: 0.04em;
  color: var(--dw-primary);
}

.app-splash__progress {
  position: relative;
  height: 3px;
  border-radius: var(--dw-radius-pill);
  background: color-mix(in srgb, var(--dw-text) 8%, var(--dw-border-light));
  overflow: hidden;
}

.app-splash__progress-fill {
  position: relative;
  display: block;
  height: 100%;
  border-radius: inherit;
  background: linear-gradient(90deg, var(--splash-accent) 0%, var(--splash-sky) 55%, var(--splash-accent-deep) 100%);
  box-shadow: 0 0 12px color-mix(in srgb, var(--dw-primary) 45%, transparent);
  transition: width 0.4s cubic-bezier(0.22, 1, 0.36, 1);
}

.app-splash__progress-fill::after {
  content: '';
  position: absolute;
  inset: 0;
  background: linear-gradient(
      90deg,
      transparent 0%,
      color-mix(in srgb, var(--dw-on-accent) 45%, transparent) 50%,
      transparent 100%
  );
  animation: splash-shimmer 1.6s ease-in-out infinite;
}

.app-splash__footer-line {
  display: flex;
  align-items: center;
  justify-content: center;
  flex-wrap: wrap;
  gap: var(--dw-space-3);
  margin: var(--dw-space-7) 0 0;
  font-size: var(--dw-text-xs);
  color: var(--dw-text-muted);
}

.app-splash__dot {
  width: 3px;
  height: 3px;
  border-radius: 50%;
  background: color-mix(in srgb, var(--dw-text-muted) 70%, transparent);
}

@keyframes splash-rise {
  from {
    opacity: 0;
    transform: translateY(14px) scale(0.985);
  }
  to {
    opacity: 1;
    transform: translateY(0) scale(1);
  }
}

@keyframes splash-pulse {
  0% {
    transform: scale(0.92);
    opacity: 0.85;
  }
  70% {
    transform: scale(1.12);
    opacity: 0;
  }
  100% {
    transform: scale(1.12);
    opacity: 0;
  }
}

@keyframes splash-drift {
  from {
    transform: translate3d(0, 0, 0);
  }
  to {
    transform: translate3d(12px, -18px, 0);
  }
}

@keyframes splash-shimmer {
  0% {
    transform: translateX(-120%);
  }
  100% {
    transform: translateX(120%);
  }
}

@media (max-width: 560px) {
  .app-splash__mark {
    width: 84px;
    height: 84px;
  }

  .app-splash__logo {
    width: 56px !important;
    height: 56px !important;
  }
}

@media (prefers-reduced-motion: reduce) {
  .app-splash__hero,
  .app-splash__load,
  .app-splash__orb,
  .app-splash__ring,
  .app-splash__progress-fill::after {
    animation: none;
  }
}
</style>
