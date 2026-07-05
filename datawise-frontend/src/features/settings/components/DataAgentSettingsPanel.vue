<script setup lang="ts">
import {computed, onMounted, ref} from 'vue'
import {useI18n} from 'vue-i18n'
import {DwIcon} from '@/core/icons'
import {
  AI_ANALYSIS_CONFIGURABLE_STEPS,
  type AiAnalysisConfigurableStepId,
  type AiAnalysisMode,
} from '@/features/ai/types/analysis'
import {disabledStepsForMode} from '@/features/ai/analysis/services/analysis-step.service'
import {
  fetchAiPythonRuntime,
  type AiPythonRuntime,
} from '@/features/ai/services/ai-python-runtime.service'
import {
  AI_LLM_ROUTE_STEPS,
} from '@/features/ai/shared/services/ai-llm-routing.service'
import type {AiAnalysisLlmRouteStep} from '@/shared/config/app-config.types'
import {useAppConfigStore} from '@/features/layout/stores/app-config-store'
import {useLayoutStore} from '@/features/layout/stores/layout'
import {UserResource} from '@/features/auth/types/user-resource.types'
import {useResourceWriteGuard} from '@/features/auth/composables/useResourceWriteGuard'
import LayoutToggleChip from '@/features/settings/components/LayoutToggleChip.vue'
import DwSelect from '@/core/components/DwSelect.vue'
import {StatusPill} from '@/core/components'
import type {SelectOption} from '@/core/components/select.types'

const props = withDefaults(defineProps<{
  embedded?: boolean
}>(), {
  embedded: false,
})

const {t} = useI18n()
const appConfig = useAppConfigStore()
const layout = useLayoutStore()
const {readOnly, hint, denyIfReadOnly} = useResourceWriteGuard(UserResource.AiPreferences)

const pythonRuntime = ref<AiPythonRuntime | null>(null)
const pythonRuntimeLoading = ref(false)

const ANALYSIS_MODES: AiAnalysisMode[] = ['quick', 'smart', 'custom']

const skipSqlConfirmation = computed({
  get: () => appConfig.aiPreferences.skipSqlConfirmation === true,
  set: (value: boolean) => {
    if (denyIfReadOnly()) return
    appConfig.setSkipSqlConfirmation(value)
  },
})

const analysisMode = computed(() => appConfig.aiPreferences.analysisMode ?? 'smart')

const showCustomSteps = computed(() => analysisMode.value === 'custom')

const llmProfiles = computed(() => appConfig.aiPreferences.llmProfiles)

const defaultRouteProfileId = computed(
    () => appConfig.aiPreferences.workbenchLlmId || appConfig.aiPreferences.defaultLlmId,
)

const defaultRouteProfileName = computed(
    () => llmProfiles.value.find((profile) => profile.id === defaultRouteProfileId.value)?.name ?? '',
)

function routeProfileId(step: AiAnalysisLlmRouteStep): string {
  return appConfig.aiPreferences.analysisStepLlmIds?.[step] ?? ''
}

function setRouteProfile(step: AiAnalysisLlmRouteStep, profileId: string) {
  if (denyIfReadOnly()) return
  appConfig.setAnalysisStepLlmId(step, profileId)
}

const llmRouteOptions = computed<SelectOption[]>(() => [
  {value: '', label: t('settings.dataAgent.llmRouteDefault')},
  ...llmProfiles.value.map((profile) => ({value: profile.id, label: profile.name})),
])

function applyAnalysisMode(mode: AiAnalysisMode) {
  if (denyIfReadOnly()) return
  appConfig.setAnalysisMode(mode)
  if (mode === 'quick') {
    appConfig.setDisabledAnalysisSteps(disabledStepsForMode('quick'))
  } else if (mode === 'smart') {
    appConfig.setDisabledAnalysisSteps([])
  }
  layout.showToast(t(`settings.dataAgent.analysisModeApplied.${mode}`))
}

function isAnalysisStepEnabled(step: AiAnalysisConfigurableStepId): boolean {
  return !(appConfig.aiPreferences.disabledAnalysisSteps ?? []).includes(step)
}

function toggleAnalysisStep(step: AiAnalysisConfigurableStepId) {
  setAnalysisStepEnabled(step, !isAnalysisStepEnabled(step))
}

function setAnalysisStepEnabled(step: AiAnalysisConfigurableStepId, enabled: boolean) {
  if (denyIfReadOnly()) return
  appConfig.setAnalysisMode('custom')
  const disabled = new Set(appConfig.aiPreferences.disabledAnalysisSteps ?? [])
  if (enabled) {
    disabled.delete(step)
  } else {
    disabled.add(step)
    const summaryOff = disabled.has('summary')
    const reportOff = disabled.has('report')
    if (summaryOff && reportOff) {
      layout.showToast(t('settings.dataAgent.analysisStepsKeepOne'))
      disabled.delete(step)
      return
    }
  }
  appConfig.setDisabledAnalysisSteps([...disabled])
}

function toggleSkipSqlConfirmation() {
  skipSqlConfirmation.value = !skipSqlConfirmation.value
}

const runtimeSpecs = computed(() => {
  const runtime = pythonRuntime.value
  if (!runtime) return []
  const yes = t('common.yes')
  const no = t('common.no')
  const f = (key: string) => t(`settings.dataAgent.pythonRuntimeFields.${key}`)
  const specs: {key: string; label: string; value: string; mono?: boolean; variant?: 'success' | 'neutral' | 'warn'}[] = [
    {
      key: 'enabled',
      label: f('enabled'),
      value: runtime.enabled ? yes : no,
      variant: runtime.enabled ? 'success' : 'neutral',
    },
    {key: 'executor', label: f('executor'), value: runtime.executor, mono: true},
    {
      key: 'sandbox',
      label: f('sandbox'),
      value: runtime.sandboxEnabled ? yes : no,
      variant: runtime.sandboxEnabled ? 'success' : 'neutral',
    },
    {
      key: 'dependencyInstall',
      label: f('dependencyInstall'),
      value: runtime.dependencyInstallEnabled ? yes : no,
      variant: runtime.dependencyInstallEnabled ? 'success' : 'neutral',
    },
    {
      key: 'timeout',
      label: f('timeout'),
      value: String(runtime.timeoutSeconds),
      mono: true,
    },
    {
      key: 'dependencyTimeout',
      label: f('dependencyTimeout'),
      value: String(runtime.dependencyInstallTimeoutSeconds),
      mono: true,
    },
    {
      key: 'maxRetries',
      label: f('maxRetries'),
      value: String(runtime.maxRetries),
      mono: true,
    },
  ]
  if (runtime.dockerImage) {
    specs.splice(4, 0, {
      key: 'dockerImage',
      label: f('dockerImage'),
      value: runtime.dockerImage,
      mono: true,
    })
  }
  if (runtime.k8sNamespace) {
    specs.splice(runtime.dockerImage ? 5 : 4, 0, {
      key: 'k8sNamespace',
      label: f('k8sNamespace'),
      value: runtime.k8sNamespace,
      mono: true,
    })
  }
  return specs
})

async function loadPythonRuntime() {
  pythonRuntimeLoading.value = true
  try {
    pythonRuntime.value = await fetchAiPythonRuntime()
  } catch {
    layout.showToast(t('settings.dataAgent.pythonRuntimeLoadFailed'))
  } finally {
    pythonRuntimeLoading.value = false
  }
}

onMounted(() => {
  void loadPythonRuntime()
})
</script>

<template>
  <div class="data-agent-settings" :class="{'is-embedded': props.embedded}">
    <header v-if="!props.embedded" class="panel-head">
      <div class="panel-head__copy">
        <h2>{{ t('settings.dataAgent.title') }}</h2>
        <p>{{ t('settings.dataAgent.subtitle') }}</p>
      </div>
    </header>

    <p v-if="readOnly" class="guest-notice">{{ hint }}</p>

    <div class="settings-stack" :class="{'is-readonly': readOnly}">
      <section class="setting-card">
        <div class="setting-card__head setting-card__head--compact">
          <div class="setting-card__icon setting-card__icon--left" aria-hidden="true">
            <DwIcon name="run" :size="18" :stroke-width="1.7"/>
          </div>
          <div>
            <h3>{{ t('settings.dataAgent.executionTitle') }}</h3>
            <p class="hint">{{ t('settings.dataAgent.executionHint') }}</p>
          </div>
        </div>
        <LayoutToggleChip
            :label="t('settings.dataAgent.skipSqlConfirmation')"
            :caption="t('settings.dataAgent.skipSqlConfirmationHint')"
            :active="skipSqlConfirmation"
            @toggle="toggleSkipSqlConfirmation"
        />
      </section>

      <section class="setting-card">
        <div class="setting-card__head">
          <div class="setting-card__icon setting-card__icon--right" aria-hidden="true">
            <DwIcon name="list-ordered" :size="18" :stroke-width="1.7"/>
          </div>
          <div>
            <h3>{{ t('settings.dataAgent.analysisStepsTitle') }}</h3>
            <p class="hint">{{ t('settings.dataAgent.analysisStepsHint') }}</p>
          </div>
          <StatusPill variant="info" chip>{{ t(`settings.dataAgent.analysisPreset${analysisMode === 'custom' ? 'CustomMode' : analysisMode === 'quick' ? 'Quick' : 'Smart'}`) }}</StatusPill>
        </div>

        <div class="mode-pick-grid" role="group" :aria-label="t('settings.dataAgent.analysisPresetGroup')">
          <button
              v-for="mode in ANALYSIS_MODES"
              :key="mode"
              type="button"
              class="mode-pick"
              :class="{ 'is-active': analysisMode === mode }"
              @click="applyAnalysisMode(mode)"
          >
            <span class="mode-pick__icon" aria-hidden="true">
              <DwIcon v-if="mode === 'quick'" name="zap" size="sm" :stroke-width="1.5"/>
              <DwIcon v-else-if="mode === 'smart'" name="star" size="sm" :stroke-width="1.5"/>
              <DwIcon v-else name="editor" size="sm" :stroke-width="1.5"/>
            </span>
            <span class="mode-pick__body">
              <span class="mode-pick__title">{{ t(`settings.dataAgent.analysisPreset${mode === 'custom' ? 'CustomMode' : mode === 'quick' ? 'Quick' : 'Smart'}`) }}</span>
              <span class="mode-pick__desc">{{ t(`settings.dataAgent.analysisPreset${mode === 'custom' ? 'CustomMode' : mode === 'quick' ? 'Quick' : 'Smart'}Hint`) }}</span>
            </span>
            <span v-if="analysisMode === mode" class="mode-pick__check" aria-hidden="true">✓</span>
          </button>
        </div>

        <p v-if="analysisMode === 'smart'" class="setting-callout">
          {{ t('settings.dataAgent.analysisSmartRuntimeHint') }}
        </p>

        <div v-if="showCustomSteps" class="step-toggle-group">
          <span class="step-toggle-group__label">{{ t('settings.dataAgent.analysisPresetCustomMode') }}</span>
          <div class="step-toggle-list">
            <LayoutToggleChip
                v-for="step in AI_ANALYSIS_CONFIGURABLE_STEPS"
                :key="step"
                :label="t(`ai.analysis.steps.${step}`)"
                :caption="t(`settings.dataAgent.analysisStepHints.${step}`)"
                :active="isAnalysisStepEnabled(step)"
                @toggle="toggleAnalysisStep(step)"
            />
          </div>
        </div>
      </section>

      <section class="setting-card">
        <div class="setting-card__head">
          <div class="setting-card__icon setting-card__icon--left" aria-hidden="true">
            <DwIcon name="optimize" :size="18" :stroke-width="1.7"/>
          </div>
          <div>
            <h3>{{ t('settings.dataAgent.llmRoutingTitle') }}</h3>
            <p class="hint">{{ t('settings.dataAgent.llmRoutingHint') }}</p>
          </div>
        </div>

        <div class="route-list">
          <div
              v-for="step in AI_LLM_ROUTE_STEPS"
              :key="step"
              class="route-row"
          >
            <div class="route-row__meta">
              <span class="route-row__badge">{{ t(`settings.dataAgent.llmRouteSteps.${step}`) }}</span>
              <span class="route-row__hint">{{ t(`settings.dataAgent.llmRouteHints.${step}`) }}</span>
            </div>
            <DwSelect
                class="route-row__select"
                :model-value="routeProfileId(step)"
                size="sm"
                :options="llmRouteOptions"
                @update:model-value="setRouteProfile(step, $event)"
            />
          </div>
        </div>

        <p class="setting-callout setting-callout--muted">
          {{ t('settings.dataAgent.llmRouteFallbackHint', {name: defaultRouteProfileName}) }}
        </p>
      </section>

      <section class="setting-card setting-card--runtime">
        <div class="setting-card__head setting-card__head--compact">
          <div class="setting-card__icon setting-card__icon--panel" aria-hidden="true">
            <DwIcon name="delete" :size="18" :stroke-width="1.7"/>
          </div>
          <div>
            <h3>{{ t('settings.dataAgent.pythonRuntimeTitle') }}</h3>
            <p class="hint">{{ t('settings.dataAgent.pythonRuntimeHint') }}</p>
          </div>
          <StatusPill
              v-if="pythonRuntime"
              :variant="pythonRuntime.enabled ? 'success' : 'neutral'"
              dot
          >
            {{ pythonRuntime.enabled ? t('common.yes') : t('common.no') }}
          </StatusPill>
        </div>

        <p v-if="pythonRuntimeLoading" class="runtime-loading">
          <span class="runtime-loading__dot" aria-hidden="true"/>
          {{ t('settings.dataAgent.pythonRuntimeLoading') }}
        </p>

        <div v-else-if="pythonRuntime" class="runtime-spec-grid">
          <div
              v-for="spec in runtimeSpecs"
              :key="spec.key"
              class="runtime-spec"
          >
            <span class="runtime-spec__label">{{ spec.label }}</span>
            <StatusPill
                v-if="spec.variant"
                :variant="spec.variant"
                chip
            >
              {{ spec.value }}
            </StatusPill>
            <span v-else class="runtime-spec__value" :class="{'is-mono': spec.mono}">{{ spec.value }}</span>
          </div>
        </div>
      </section>
    </div>
  </div>
</template>

<style scoped>
.data-agent-settings {
  max-width: clamp(560px, 62vw, 760px);
}

.settings-stack {
  display: flex;
  flex-direction: column;
  gap: var(--mp-gap-lg);
}

.mode-pick-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: clamp(8px, 1vmin, 10px);
}

.mode-pick {
  position: relative;
  display: flex;
  align-items: flex-start;
  gap: clamp(8px, 1vmin, 10px);
  padding: clamp(10px, 1.2vmin, 12px) clamp(10px, 1.2vmin, 12px) clamp(10px, 1.2vmin, 12px) clamp(9px, 1.1vmin, 11px);
  border: 1px solid var(--dw-border-light);
  border-radius: var(--dw-panel-radius);
  background: var(--dw-bg-panel);
  text-align: left;
  cursor: pointer;
  transition:
      border-color 0.15s ease,
      background 0.15s ease,
      box-shadow 0.15s ease,
      transform 0.12s ease;
}

.mode-pick:hover {
  border-color: color-mix(in srgb, var(--dw-primary) 28%, var(--dw-border));
  background: var(--dw-bg-hover);
}

.mode-pick.is-active {
  border-color: var(--dw-primary-border);
  background: var(--dw-primary-softer);
  box-shadow: inset 0 0 0 1px var(--dw-primary-ring);
}

.mode-pick__icon {
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  width: clamp(26px, 2.8vmin, 28px);
  height: clamp(26px, 2.8vmin, 28px);
  border-radius: 999px;
  color: var(--dw-primary);
  background: color-mix(in srgb, var(--dw-primary) 10%, var(--dw-bg-panel));
}

.mode-pick.is-active .mode-pick__icon {
  background: color-mix(in srgb, var(--dw-primary) 18%, var(--dw-bg-panel));
}

.mode-pick__body {
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
  padding-right: 14px;
}

.mode-pick__title {
  font-size: var(--mp-sub);
  font-weight: 600;
  color: var(--dw-text);
  line-height: 1.35;
}

.mode-pick__desc {
  font-size: clamp(10px, 1.05vmin, 11px);
  line-height: 1.45;
  color: var(--dw-text-muted);
}

.mode-pick__check {
  position: absolute;
  top: clamp(8px, 1vmin, 10px);
  right: clamp(8px, 1vmin, 10px);
  font-size: 11px;
  font-weight: 700;
  color: var(--dw-primary);
}

.setting-callout {
  margin: clamp(10px, 1.2vmin, 12px) 0 0;
  padding: clamp(8px, 1vmin, 10px) clamp(10px, 1.2vmin, 12px);
  border-radius: calc(var(--dw-panel-radius) - 2px);
  border: 1px solid color-mix(in srgb, var(--dw-primary) 14%, var(--dw-border-light));
  background: color-mix(in srgb, var(--dw-primary) 5%, var(--dw-bg-panel));
  font-size: clamp(10px, 1.05vmin, 11px);
  line-height: 1.5;
  color: var(--dw-text-secondary);
}

.setting-callout--muted {
  border-color: var(--dw-border-light);
  background: var(--dw-bg-muted);
  color: var(--dw-text-muted);
}

.step-toggle-group {
  margin-top: clamp(12px, 1.4vmin, 14px);
  padding-top: clamp(12px, 1.4vmin, 14px);
  border-top: 1px solid var(--dw-border-light);
}

.step-toggle-group__label {
  display: block;
  margin-bottom: clamp(6px, 0.8vmin, 8px);
  color: var(--dw-text-muted);
  font-size: clamp(10px, 1.05vmin, 11px);
  font-weight: 600;
  letter-spacing: 0.06em;
  text-transform: uppercase;
}

.step-toggle-list {
  display: flex;
  flex-direction: column;
  gap: clamp(6px, 0.8vmin, 8px);
}

.route-list {
  display: flex;
  flex-direction: column;
  gap: clamp(6px, 0.8vmin, 8px);
}

.route-row {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(140px, 200px);
  gap: clamp(8px, 1vmin, 10px);
  align-items: center;
  padding: clamp(8px, 1vmin, 10px) clamp(10px, 1.2vmin, 12px);
  border: 1px solid var(--dw-border-light);
  border-radius: var(--dw-panel-radius);
  background: var(--dw-bg-panel);
}

.route-row__meta {
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
}

.route-row__badge {
  display: inline-flex;
  align-self: flex-start;
  padding: 1px 7px;
  border-radius: 999px;
  background: color-mix(in srgb, var(--dw-primary) 10%, var(--dw-bg-panel));
  border: 1px solid color-mix(in srgb, var(--dw-primary) 16%, var(--dw-border-light));
  color: var(--dw-primary);
  font-size: clamp(10px, 1.05vmin, 11px);
  font-weight: 600;
  line-height: 1.5;
}

.route-row__hint {
  font-size: clamp(10px, 1.05vmin, 11px);
  line-height: 1.45;
  color: var(--dw-text-muted);
}

.route-row__select :deep(.dw-select) {
  width: 100%;
  min-width: 0;
}

.runtime-loading {
  display: flex;
  align-items: center;
  gap: 8px;
  margin: 0;
  font-size: var(--mp-caption);
  color: var(--dw-text-muted);
}

.runtime-loading__dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: var(--dw-primary);
  animation: runtime-pulse 1.2s ease-in-out infinite;
}

@keyframes runtime-pulse {
  0%, 100% { opacity: 0.35; transform: scale(0.85); }
  50% { opacity: 1; transform: scale(1); }
}

.runtime-spec-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: clamp(6px, 0.8vmin, 8px);
}

.runtime-spec {
  display: flex;
  flex-direction: column;
  gap: clamp(4px, 0.5vmin, 6px);
  padding: clamp(8px, 1vmin, 10px) clamp(10px, 1.2vmin, 12px);
  border: 1px solid var(--dw-border-light);
  border-radius: calc(var(--dw-panel-radius) - 1px);
  background: var(--dw-bg-panel);
}

.runtime-spec__label {
  font-size: clamp(10px, 1.05vmin, 11px);
  font-weight: 500;
  color: var(--dw-text-muted);
  line-height: 1.35;
}

.runtime-spec__value {
  font-size: var(--mp-sub);
  font-weight: 600;
  color: var(--dw-text);
  line-height: 1.35;
  word-break: break-all;
}

.runtime-spec__value.is-mono {
  font-family: var(--dw-mono, monospace);
  font-size: clamp(11px, 1.15vmin, 12px);
  font-weight: 500;
}

.setting-card--runtime .setting-card__head {
  margin-bottom: clamp(10px, 1.2vmin, 12px);
}

@media (max-width: 720px) {
  .mode-pick-grid {
    grid-template-columns: 1fr;
  }

  .route-row {
    grid-template-columns: 1fr;
  }

  .runtime-spec-grid {
    grid-template-columns: 1fr;
  }
}
</style>
