<script setup lang="ts">
import {computed, nextTick, onMounted, onUnmounted, ref, watch} from 'vue'
import {useI18n} from 'vue-i18n'
import {DwButton, IconButton} from '@/core/components'
import {DwIcon} from '@/core/icons'
import type {DwIconName} from '@/core/icons'
import {
    ONBOARDING_TOUR_STEPS,
    type OnboardingTourStep,
} from '@/features/onboarding/services/onboarding-tour.config'
import {
    layoutSpotlightTour,
    spotlightBoxStyle,
    TOOLTIP_ESTIMATED_HEIGHT,
    tooltipBoxStyle,
} from '@/features/onboarding/services/onboarding-spotlight.service'
import {useLayoutStore} from '@/features/layout/stores/layout'
import {useAppConfigStore} from '@/features/layout/stores/app-config-store'
import {useWorkspaceStore} from '@/features/workspace/stores/workspace'

const STEP_HEIGHT_HINT: Record<string, number> = {
    welcome: 400,
    tips: 340,
}

const STEP_ICON: Record<string, DwIconName> = {
  home: 'user',
  database: 'database',
  explorer: 'open',
  workspace: 'layout',
  ai: 'ai',
  terminal: 'terminal',
  tips: 'about',
  welcome: 'tab-welcome',
}

function stepIcon(stepId: string): DwIconName {
  return STEP_ICON[stepId] ?? 'star'
}

const props = defineProps<{ open: boolean }>()
const emit = defineEmits<{
    'update:open': [value: boolean]
    finish: []
    skip: []
}>()

const {t} = useI18n()
const layout = useLayoutStore()
const appConfig = useAppConfigStore()
const workspace = useWorkspaceStore()

const stepIndex = ref(0)
const layoutTick = ref(0)
const cardRef = ref<HTMLElement | null>(null)
const measuredCardHeight = ref(0)

const currentStep = computed(() => ONBOARDING_TOUR_STEPS[stepIndex.value])
const stepId = computed(() => currentStep.value.id)
const isFirstStep = computed(() => stepIndex.value === 0)
const isLastStep = computed(() => stepIndex.value === ONBOARDING_TOUR_STEPS.length - 1)
const isCenterStep = computed(() => !currentStep.value.target || currentStep.value.placement === 'center')

const layoutCardHeight = computed(() => {
    if (measuredCardHeight.value > 0) return measuredCardHeight.value
    return STEP_HEIGHT_HINT[stepId.value] ?? TOOLTIP_ESTIMATED_HEIGHT
})

const spotlightLayout = computed(() => {
    layoutTick.value
    const step = currentStep.value
    return layoutSpotlightTour(step.target, step.placement, undefined, layoutCardHeight.value)
})

const highlightStyle = computed(() => spotlightBoxStyle(spotlightLayout.value.highlight))
const cardStyle = computed(() =>
    tooltipBoxStyle(spotlightLayout.value.tooltip, spotlightLayout.value.arrowOffset),
)
const arrowSide = computed(() => spotlightLayout.value.arrowSide)
const resolvedPlacement = computed(() => spotlightLayout.value.resolvedPlacement)

const hintArrow = computed(() => {
    if (isCenterStep.value) return ''
    switch (resolvedPlacement.value) {
        case 'right': return '←'
        case 'left': return '→'
        case 'top': return '↓'
        case 'bottom': return '↑'
        default: return '→'
    }
})

const stepTitle = computed(() => t(`onboarding.steps.${stepId.value}.title`))
const stepBody = computed(() => {
    const key = `onboarding.steps.${stepId.value}.body`
    const text = t(key)
    return text === key ? '' : text
})
const stepHint = computed(() => {
    const key = `onboarding.steps.${stepId.value}.hint`
    const text = t(key)
    return text === key ? '' : text
})

function syncCardHeight() {
    if (!cardRef.value) return
    const nextHeight = Math.ceil(cardRef.value.getBoundingClientRect().height)
    if (nextHeight > 0 && nextHeight !== measuredCardHeight.value) {
        measuredCardHeight.value = nextHeight
        layoutTick.value += 1
    }
}

async function remeasure() {
    await nextTick()
    await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()))
    syncCardHeight()
    await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()))
    syncCardHeight()
}

async function applyStepPrepare(step: OnboardingTourStep) {
    if (step.prepare) {
        await step.prepare({layout, appConfig, workspace})
    }
    await nextTick()
    await remeasure()
    const target = step.target ? document.querySelector(`[data-onboarding="${step.target}"]`) : null
    target?.scrollIntoView({block: 'nearest', inline: 'nearest', behavior: 'smooth'})
    await new Promise<void>((resolve) => window.setTimeout(resolve, 280))
    await remeasure()
}

watch(
    () => props.open,
    async (isOpen) => {
        if (!isOpen) return
        stepIndex.value = 0
        measuredCardHeight.value = 0
        await applyStepPrepare(ONBOARDING_TOUR_STEPS[0])
    },
)

watch(stepIndex, async (index) => {
    if (!props.open) return
    measuredCardHeight.value = 0
    await applyStepPrepare(ONBOARDING_TOUR_STEPS[index])
})

let resizeObserver: ResizeObserver | null = null

watch(cardRef, (el, prev) => {
    if (!resizeObserver) return
    if (prev) resizeObserver.unobserve(prev)
    if (el) resizeObserver.observe(el)
})

onMounted(() => {
    window.addEventListener('resize', remeasure)
    window.addEventListener('scroll', remeasure, true)
    window.addEventListener('keydown', onKeydown)
    resizeObserver = new ResizeObserver(() => {
        syncCardHeight()
    })
    if (cardRef.value) resizeObserver.observe(cardRef.value)
})

onUnmounted(() => {
    window.removeEventListener('resize', remeasure)
    window.removeEventListener('scroll', remeasure, true)
    window.removeEventListener('keydown', onKeydown)
    resizeObserver?.disconnect()
    document.body.style.overflow = ''
})

function onKeydown(event: KeyboardEvent) {
    if (event.key === 'Escape' && props.open) {
        event.preventDefault()
        onSkip()
    }
}

watch(
    () => props.open,
    (isOpen) => {
        document.body.style.overflow = isOpen ? 'hidden' : ''
    },
    {immediate: true},
)

function close() {
    emit('update:open', false)
}

function onSkip() {
    emit('skip')
    close()
}

function onBack() {
    if (stepIndex.value > 0) stepIndex.value -= 1
}

async function onNext() {
    if (isLastStep.value) {
        await onFinish()
        return
    }
    stepIndex.value += 1
}

async function onFinish() {
    if (!appConfig.showExplorerPanel) {
        appConfig.setShowExplorerPanel(true)
    }
    layout.setModule('database')
    workspace.openConsole()
    emit('finish')
    close()
}
</script>

<template>
  <Teleport to="body">
    <Transition name="modal-overlay">
      <div v-if="open" class="onboarding-tour" role="dialog" aria-modal="true" :aria-label="t('onboarding.title')">
        <div v-if="isCenterStep" class="onboarding-tour__backdrop onboarding-tour__backdrop--full">
          <div class="onboarding-tour__mesh" aria-hidden="true"/>
        </div>
        <div
            v-else-if="highlightStyle"
            class="onboarding-tour__spotlight"
            :style="highlightStyle"
        >
          <span class="onboarding-tour__corner onboarding-tour__corner--tl" aria-hidden="true"/>
          <span class="onboarding-tour__corner onboarding-tour__corner--tr" aria-hidden="true"/>
          <span class="onboarding-tour__corner onboarding-tour__corner--bl" aria-hidden="true"/>
          <span class="onboarding-tour__corner onboarding-tour__corner--br" aria-hidden="true"/>
          <span class="onboarding-tour__pulse" aria-hidden="true"/>
          <span class="onboarding-tour__ring" aria-hidden="true"/>
        </div>

        <article
            ref="cardRef"
            class="onboarding-tour__card"
            :class="[
              `onboarding-tour__card--arrow-${arrowSide}`,
              `onboarding-tour__card--step-${stepId}`,
              { 'onboarding-tour__card--center': isCenterStep },
            ]"
            :style="cardStyle"
        >
          <div class="onboarding-tour__card-glow" aria-hidden="true"/>

          <div class="onboarding-tour__card-body">
            <header class="onboarding-tour__head">
              <div class="onboarding-tour__head-left">
                <span class="onboarding-tour__icon" :class="`onboarding-tour__icon--${stepId}`" aria-hidden="true">
                  <DwIcon :name="stepIcon(stepId)" :stroke-width="1.8"/>
                </span>
                <span class="onboarding-tour__badge">
                  {{ stepIndex + 1 }} / {{ ONBOARDING_TOUR_STEPS.length }}
                </span>
              </div>
              <IconButton size="sm" :title="t('onboarding.skip')" @click="onSkip">×</IconButton>
            </header>

            <div v-if="stepId === 'welcome'" class="onboarding-tour__hero" aria-hidden="true">
              <div class="onboarding-tour__orb onboarding-tour__orb--a"/>
              <div class="onboarding-tour__orb onboarding-tour__orb--b"/>
              <DwIcon name="tab-welcome" :size="48" :stroke-width="1.5"/>
            </div>

            <div v-if="stepId === 'tips'" class="onboarding-tour__kbd-row" aria-hidden="true">
              <kbd>Ctrl</kbd>
              <span>+</span>
              <kbd>K</kbd>
            </div>

            <h2 class="onboarding-tour__title">{{ stepTitle }}</h2>
            <p v-if="stepId === 'welcome'" class="onboarding-tour__subtitle">{{ t('onboarding.subtitle') }}</p>
            <p v-if="stepBody" class="onboarding-tour__body">{{ stepBody }}</p>
            <p v-if="stepHint" class="onboarding-tour__hint">
              <span class="onboarding-tour__hint-arrow" aria-hidden="true">{{ hintArrow }}</span>
              {{ stepHint }}
            </p>

            <div class="onboarding-tour__progress" role="progressbar" :aria-valuenow="stepIndex + 1" :aria-valuemax="ONBOARDING_TOUR_STEPS.length">
              <span
                  v-for="(_, index) in ONBOARDING_TOUR_STEPS"
                  :key="index"
                  class="onboarding-tour__dot"
                  :class="{ 'is-active': index === stepIndex, 'is-done': index < stepIndex }"
              />
            </div>
          </div>

          <footer class="onboarding-tour__actions app-modal-footer">
            <DwButton variant="ghost" type="button" @click="onSkip">
              {{ t('onboarding.skip') }}
            </DwButton>
            <div class="onboarding-tour__nav">
              <DwButton v-if="!isFirstStep" variant="ghost" type="button" @click="onBack">
                {{ t('onboarding.back') }}
              </DwButton>
              <DwButton variant="primary" type="button" @click="onNext">
                {{ isLastStep ? t('onboarding.finish') : t('onboarding.next') }}
              </DwButton>
            </div>
          </footer>
        </article>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
.onboarding-tour {
  position: fixed;
  inset: 0;
  z-index: 2600;
  pointer-events: none;
}

.onboarding-tour__backdrop {
  position: absolute;
  inset: 0;
  overflow: hidden;
  background: var(--dw-overlay-bg-strong);
  backdrop-filter: blur(var(--dw-overlay-blur));
  pointer-events: none;
}

.onboarding-tour__backdrop--full {
  background: var(--dw-overlay-bg-strong);
  backdrop-filter: blur(var(--dw-overlay-blur));
}

.onboarding-tour__mesh {
  position: absolute;
  inset: -20%;
  background:
      radial-gradient(circle at 20% 30%, color-mix(in srgb, var(--dw-primary) 22%, transparent), transparent 42%),
      radial-gradient(circle at 78% 68%, color-mix(in srgb, #6366f1 18%, transparent), transparent 40%),
      radial-gradient(circle at 50% 50%, rgba(255, 255, 255, 0.04), transparent 55%);
  animation: tour-mesh-drift 12s ease-in-out infinite alternate;
}

@keyframes tour-mesh-drift {
  from { transform: translate(-2%, -1%) scale(1); }
  to { transform: translate(2%, 1%) scale(1.04); }
}

.onboarding-tour__spotlight {
  position: fixed;
  border-radius: 14px;
  box-shadow:
      0 0 0 9999px var(--dw-overlay-bg-strong),
      0 0 0 1px color-mix(in srgb, var(--dw-primary) 45%, white),
      0 0 24px color-mix(in srgb, var(--dw-primary) 35%, transparent),
      0 16px 48px color-mix(in srgb, var(--dw-text) 14%, transparent);
  transition:
      top 0.5s cubic-bezier(0.22, 1, 0.36, 1),
      left 0.5s cubic-bezier(0.22, 1, 0.36, 1),
      width 0.5s cubic-bezier(0.22, 1, 0.36, 1),
      height 0.5s cubic-bezier(0.22, 1, 0.36, 1);
  pointer-events: none;
}

.onboarding-tour__corner {
  position: absolute;
  width: 14px;
  height: 14px;
  border-color: var(--dw-primary);
  border-style: solid;
  opacity: 0.85;
}

.onboarding-tour__corner--tl { top: 6px; left: 6px; border-width: 2px 0 0 2px; border-radius: 4px 0 0 0; }
.onboarding-tour__corner--tr { top: 6px; right: 6px; border-width: 2px 2px 0 0; border-radius: 0 4px 0 0; }
.onboarding-tour__corner--bl { bottom: 6px; left: 6px; border-width: 0 0 2px 2px; border-radius: 0 0 0 4px; }
.onboarding-tour__corner--br { bottom: 6px; right: 6px; border-width: 0 2px 2px 0; border-radius: 0 0 4px 0; }

.onboarding-tour__pulse,
.onboarding-tour__ring {
  position: absolute;
  inset: -5px;
  border-radius: 16px;
  pointer-events: none;
}

.onboarding-tour__ring {
  border: 2px solid color-mix(in srgb, var(--dw-primary) 60%, transparent);
  animation: tour-ring 2.4s ease-out infinite;
}

.onboarding-tour__pulse {
  background: color-mix(in srgb, var(--dw-primary) 14%, transparent);
  animation: tour-pulse 2.4s ease-out infinite;
}

@keyframes tour-pulse {
  0% { transform: scale(0.95); opacity: 0.9; }
  70% { transform: scale(1.1); opacity: 0; }
  100% { opacity: 0; }
}

@keyframes tour-ring {
  0%, 100% { opacity: 0.45; }
  50% { opacity: 1; }
}

.onboarding-tour__card {
  position: fixed;
  display: flex;
  flex-direction: column;
  box-sizing: border-box;
  padding: 0;
  border-radius: 18px;
  border: 1px solid color-mix(in srgb, var(--dw-primary) 28%, var(--dw-border-light));
  background: var(--dw-bg);
  background-image: linear-gradient(
      145deg,
      color-mix(in srgb, var(--dw-bg) 96%, white),
      color-mix(in srgb, var(--dw-bg) 90%, transparent)
  );
  backdrop-filter: blur(20px) saturate(1.2);
  box-shadow:
      0 28px 70px rgba(8, 12, 24, 0.38),
      0 0 0 1px rgba(255, 255, 255, 0.06) inset;
  transition:
      top 0.5s cubic-bezier(0.22, 1, 0.36, 1),
      left 0.5s cubic-bezier(0.22, 1, 0.36, 1);
  pointer-events: auto;
  overflow: hidden;
  isolation: isolate;
}

.onboarding-tour__card-glow {
  position: absolute;
  inset: 0;
  border-radius: inherit;
  background: linear-gradient(
      120deg,
      color-mix(in srgb, var(--dw-primary) 10%, transparent) 0%,
      transparent 42%,
      color-mix(in srgb, #6366f1 8%, transparent) 100%
  );
  pointer-events: none;
}

.onboarding-tour__card-body {
  position: relative;
  z-index: 1;
  padding: 16px 18px 0;
}

.onboarding-tour__card--center {
  text-align: center;
}

.onboarding-tour__card--center .onboarding-tour__hint {
  margin-inline: auto;
}

.onboarding-tour__card--arrow-left::before,
.onboarding-tour__card--arrow-right::before,
.onboarding-tour__card--arrow-top::before,
.onboarding-tour__card--arrow-bottom::before {
  content: '';
  position: absolute;
  width: 14px;
  height: 14px;
  background: var(--dw-bg);
  border: 1px solid color-mix(in srgb, var(--dw-primary) 28%, var(--dw-border-light));
  transform: rotate(45deg);
  z-index: 0;
}

.onboarding-tour__card--arrow-left::before {
  left: -8px;
  top: var(--tour-arrow-offset, 72px);
  border-right: none;
  border-top: none;
}

.onboarding-tour__card--arrow-right::before {
  right: -8px;
  top: var(--tour-arrow-offset, 72px);
  border-left: none;
  border-bottom: none;
}

.onboarding-tour__card--arrow-top::before {
  top: -8px;
  left: var(--tour-arrow-offset, 50%);
  margin-left: -7px;
  border-right: none;
  border-bottom: none;
}

.onboarding-tour__card--arrow-bottom::before {
  bottom: -8px;
  left: var(--tour-arrow-offset, 50%);
  margin-left: -7px;
  border-left: none;
  border-top: none;
}

.onboarding-tour__head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 8px;
}

.onboarding-tour__head-left {
  display: flex;
  align-items: center;
  gap: 8px;
}

.onboarding-tour__icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  border-radius: 10px;
  background: color-mix(in srgb, var(--dw-primary) 12%, var(--dw-bg-muted));
  color: var(--dw-primary);
  box-shadow: 0 0 0 1px color-mix(in srgb, var(--dw-primary) 18%, transparent) inset;
}

.onboarding-tour__icon svg {
  width: 18px;
  height: 18px;
}

.onboarding-tour__badge {
  display: inline-flex;
  align-items: center;
  padding: 3px 10px;
  border-radius: 999px;
  background: color-mix(in srgb, var(--dw-primary) 10%, var(--dw-bg-muted));
  color: var(--dw-text-muted);
  font-size: 11px;
  font-weight: 600;
  letter-spacing: 0.04em;
}

.onboarding-tour__hero {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  height: 72px;
  margin: 2px 0 8px;
  color: var(--dw-primary);
}

.onboarding-tour__orb {
  position: absolute;
  border-radius: 999px;
  filter: blur(20px);
  opacity: 0.6;
}

.onboarding-tour__orb--a {
  width: 72px;
  height: 72px;
  background: color-mix(in srgb, var(--dw-primary) 38%, transparent);
  animation: tour-float 4s ease-in-out infinite;
}

.onboarding-tour__orb--b {
  width: 52px;
  height: 52px;
  background: color-mix(in srgb, #6366f1 30%, transparent);
  animation: tour-float 4s ease-in-out infinite reverse;
}

@keyframes tour-float {
  0%, 100% { transform: translate(-12px, 0); }
  50% { transform: translate(12px, -6px); }
}

.onboarding-tour__kbd-row {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  margin: 4px 0 12px;
  color: var(--dw-text-muted);
  font-size: 13px;
}

.onboarding-tour__kbd-row kbd {
  min-width: 38px;
  padding: 7px 11px;
  border: 1px solid var(--dw-border);
  border-radius: 9px;
  background: linear-gradient(180deg, var(--dw-bg-panel), var(--dw-bg-muted));
  box-shadow: 0 2px 0 color-mix(in srgb, var(--dw-border) 80%, transparent);
  font-family: var(--dw-mono);
  font-size: 12px;
  font-weight: 700;
  color: var(--dw-text);
}

.onboarding-tour__title {
  margin: 0 0 6px;
  font-size: 19px;
  font-weight: 700;
  letter-spacing: -0.02em;
}

.onboarding-tour__subtitle {
  margin: 0 0 8px;
  color: var(--dw-primary);
  font-size: 13px;
  font-weight: 600;
}

.onboarding-tour__body {
  margin: 0;
  color: var(--dw-text-secondary);
  font-size: 14px;
  line-height: 1.6;
}

.onboarding-tour__hint {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  margin: 10px 0 0;
  padding: 7px 11px;
  border-radius: 999px;
  background: color-mix(in srgb, var(--dw-primary) 10%, var(--dw-bg-muted));
  border: 1px solid color-mix(in srgb, var(--dw-primary) 16%, transparent);
  color: var(--dw-text-secondary);
  font-size: 12px;
  line-height: 1.4;
}

.onboarding-tour__hint-arrow {
  display: inline-flex;
  color: var(--dw-primary);
  font-size: 13px;
  font-weight: 700;
  animation: tour-hint-nudge 1.2s ease-in-out infinite;
}

@keyframes tour-hint-nudge {
  0%, 100% { transform: translate(0, 0); opacity: 0.7; }
  50% { transform: translate(-3px, -2px); opacity: 1; }
}

.onboarding-tour__progress {
  display: flex;
  gap: 5px;
  margin: 14px 0 0;
}

.onboarding-tour__dot {
  flex: 1;
  height: 4px;
  border-radius: 999px;
  background: var(--dw-border-light);
  transition: background 0.25s ease, transform 0.25s ease, box-shadow 0.25s ease;
}

.onboarding-tour__dot.is-active {
  background: linear-gradient(90deg, var(--dw-primary), color-mix(in srgb, #6366f1 70%, var(--dw-primary)));
  transform: scaleY(1.25);
  box-shadow: 0 0 10px color-mix(in srgb, var(--dw-primary) 45%, transparent);
}

.onboarding-tour__dot.is-done {
  background: color-mix(in srgb, var(--dw-primary) 50%, var(--dw-border-light));
}

.onboarding-tour__actions {
  position: relative;
  z-index: 1;
  justify-content: space-between;
  margin-top: 14px;
  border-radius: 0 0 18px 18px;
}

.onboarding-tour__nav {
  display: flex;
  gap: 8px;
}
</style>
