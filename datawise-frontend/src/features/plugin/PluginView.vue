<script setup lang="ts">
import {computed, nextTick, onMounted, ref, watch} from 'vue'
import {storeToRefs} from 'pinia'
import {useI18n} from 'vue-i18n'
import type {PluginItem} from '@/core/types'
import {CollapsibleSection, EmptyState, StatusPill} from '@/core/components'
import {DwIcon} from '@/core/icons'
import PluginDetailDialog from '@/features/plugin/components/PluginDetailDialog.vue'
import {usePluginStore} from '@/features/plugin/stores/plugin-store'
import {
    PLUGIN_REGISTRY,
    listPluginRequires,
    listPluginSurfaceIds,
    pluginHasUnmetRequires,
    pluginHasSurface,
    type PluginId,
} from '@/features/plugin/services/plugin-registry.service'
import type {PluginPresetId} from '@/features/plugin/services/plugin-preset.service'
import {
    findPluginPreset,
    listPresetChanges,
    pluginConflictsWithPreset,
    countPluginsConflictingWithPreset,
    recommendClosestPreset,
    suggestPresetForTeamRole,
    summarizePresetImpact,
} from '@/features/plugin/services/plugin-preset.service'
import {
    getPluginUsage,
    pluginUsageLastAtMs,
    pluginUsageTotal,
} from '@/features/plugin/services/plugin-usage.service'
import {
    markPresetAutoApplied,
    resolveFirstVisitAutoPreset,
} from '@/features/plugin/services/plugin-preset-auto.service'
import {useReferenceConflictBannerDismiss} from '@/features/plugin/composables/useReferenceConflictBannerDismiss'
import {useAppToast} from '@/features/layout/composables/useAppToast'
import {useTeamStore} from '@/features/team/stores/team-store'
import {useAppConfigStore} from '@/features/layout/stores/app-config-store'
import {useLayoutStore} from '@/features/layout/stores/layout'
import {
    PLUGIN_PRESET_DIFF_ANCHOR,
    SETTINGS_PLUGIN_REFERENCE_PRESET_ANCHOR,
} from '@/features/plugin/services/plugin-navigation.service'
import '@/features/plugin/styles/plugin-view.css'

const CATEGORY_ORDER = ['ai', 'export', 'tool', 'datasource'] as const

const {t, te} = useI18n()
const pluginStore = usePluginStore()
const toast = useAppToast()
const teamStore = useTeamStore()
const appConfigStore = useAppConfigStore()
const layoutStore = useLayoutStore()
const filter = ref<'all' | 'enabled' | 'disabled'>('all')
const sortMode = ref<'default' | 'usage' | 'recent'>('default')
const usageRevision = ref(0)
const category = ref<'all' | PluginItem['category']>('all')
const surface = ref<'all' | string>('all')
const searchQuery = ref('')
const unmetRequiresOnly = ref(false)
const presetMismatchOnly = ref(false)
const detailPlugin = ref<PluginItem | null>(null)
const detailOpen = ref(false)
const configImportInputRef = ref<HTMLInputElement>()

const {highlightPluginId, pageNavigateIntent} = storeToRefs(pluginStore)

const showConnectorMarketCta = computed(
    () => category.value === 'all' || category.value === 'datasource',
)

const surfaceOptions = listPluginSurfaceIds()
const presetIds: PluginPresetId[] = ['dba', 'readOnlyAnalysis', 'teamViewer', 'developer', 'minimal']
const referencePresetId = computed<PluginPresetId>({
  get: () => pluginStore.referencePresetId(),
  set: (id) => pluginStore.setReferencePresetId(id),
})
const viewerHintDismissed = ref(false)

const activeTeam = computed(
    () => teamStore.teams.find((team) => team.id === teamStore.activeTeamId) ?? null,
)
const suggestedTeamPreset = computed(() => suggestPresetForTeamRole(activeTeam.value?.role))
const showTeamViewerHint = computed(
    () => !viewerHintDismissed.value && suggestedTeamPreset.value === 'teamViewer',
)

const presetMismatchCount = computed(() => {
  const preset = findPluginPreset(referencePresetId.value)
  if (!preset) return 0
  return countPluginsConflictingWithPreset(preset, (id) => pluginStore.isEnabled(id))
})

const closestPresetMatch = computed(() =>
    recommendClosestPreset((id) => pluginStore.isEnabled(id)),
)

const showClosestPresetHint = computed(() => (closestPresetMatch.value?.conflicts ?? 0) > 0)

const presetDiffRows = computed(() => {
  const preset = findPluginPreset(referencePresetId.value)
  if (!preset) return []
  return listPresetChanges(preset, (id) => pluginStore.isEnabled(id))
})

const {
    visible: showReferenceConflictBanner,
    dismiss: dismissReferenceConflictBanner,
} = useReferenceConflictBannerDismiss(referencePresetId, presetMismatchCount)

const presetDiffPinned = ref(false)

const presetDiffSectionOpen = computed(
    () => presetDiffPinned.value || presetDiffRows.value.length > 0 || presetMismatchCount.value > 0,
)

function presetImpactSummary(presetId: PluginPresetId) {
  const preset = findPluginPreset(presetId)
  if (!preset) return null
  return summarizePresetImpact(preset, (id) => pluginStore.isEnabled(id))
}

function presetImpactCount(presetId: PluginPresetId): number {
  return presetImpactSummary(presetId)?.totalChanges ?? 0
}

function presetButtonTitle(presetId: PluginPresetId): string {
  const hint = t(`plugin.presets.${presetId}.hint`)
  const impact = presetImpactSummary(presetId)
  if (!impact || impact.totalChanges === 0) {
    return `${hint} · ${t('plugin.presets.impactNone')}`
  }
  return `${hint} · ${t('plugin.presets.impactSummary', {
    enable: impact.toEnable.length,
    disable: impact.toDisable.length,
  })}`
}

onMounted(() => {
  tryAutoApplyRolePreset()
  handlePageNavigateIntent(pageNavigateIntent.value)
})

watch(pageNavigateIntent, handlePageNavigateIntent)

function handlePageNavigateIntent(intent: 'none' | 'presetDiff') {
  if (intent !== 'presetDiff') return
  presetDiffPinned.value = true
  void nextTick(() => {
    document.getElementById(PLUGIN_PRESET_DIFF_ANCHOR)?.scrollIntoView({behavior: 'smooth', block: 'start'})
    pluginStore.clearPageNavigateIntent()
  })
}

function tryAutoApplyRolePreset() {
  const autoPreset = resolveFirstVisitAutoPreset(
      activeTeam.value?.role,
      appConfigStore.config.plugins?.enabled ?? {},
  )
  if (!autoPreset) return
  pluginStore.applyPreset(autoPreset)
  markPresetAutoApplied(autoPreset)
  viewerHintDismissed.value = true
  toast.success(t(`plugin.presets.${autoPreset}.autoApplied`))
}

function bumpUsageRevision() {
  usageRevision.value += 1
}

function pluginToggleCount(plugin: PluginItem): number {
  void usageRevision.value
  return pluginUsageTotal(getPluginUsage(plugin.id))
}

function pluginLastToggleAt(plugin: PluginItem): number {
  void usageRevision.value
  return pluginUsageLastAtMs(plugin.id)
}

const filtered = computed(() => {
  let list = pluginStore.items
  if (filter.value === 'enabled') list = list.filter((p) => p.enabled)
  if (filter.value === 'disabled') list = list.filter((p) => !p.enabled)
  if (category.value !== 'all') list = list.filter((p) => p.category === category.value)
  if (surface.value !== 'all') {
    list = list.filter((p) => pluginHasSurface(p.id as PluginId, surface.value))
  }
  if (unmetRequiresOnly.value) {
    list = list.filter((p) => hasUnmetRequires(p))
  }
  if (presetMismatchOnly.value) {
    list = list.filter((p) => conflictsWithReferencePreset(p))
  }
  const query = searchQuery.value.trim().toLowerCase()
  if (query) {
    list = list.filter((plugin) => matchesSearch(plugin, query))
  }
  if (sortMode.value === 'usage') {
    list = [...list].sort(
        (a, b) => pluginToggleCount(b) - pluginToggleCount(a) || pluginName(a).localeCompare(pluginName(b)),
    )
  } else if (sortMode.value === 'recent') {
    list = [...list].sort(
        (a, b) => pluginLastToggleAt(b) - pluginLastToggleAt(a) || pluginName(a).localeCompare(pluginName(b)),
    )
  }
  return list
})

const unmetRequiresCount = computed(
    () => pluginStore.items.filter((plugin) => hasUnmetRequires(plugin)).length,
)

function isEnabled(id: PluginId): boolean {
  return pluginStore.isEnabled(id)
}

function hasUnmetRequires(plugin: PluginItem): boolean {
  return pluginHasUnmetRequires(plugin, isEnabled)
}

function conflictsWithReferencePreset(plugin: PluginItem): boolean {
  const preset = findPluginPreset(referencePresetId.value)
  if (!preset) return false
  return pluginConflictsWithPreset(plugin.id as PluginId, preset, isEnabled)
}

function presetMismatchBadgeLabel(): string {
  return t('plugin.presets.mismatchBadge', {
    preset: t(`plugin.presets.${referencePresetId.value}.label`),
  })
}

function applyClosestPreset() {
  const match = closestPresetMatch.value
  if (!match) return
  referencePresetId.value = match.id
  applyPreset(match.id)
}

function matchesSearch(plugin: PluginItem, query: string): boolean {
  const fields = [
    plugin.id,
    plugin.name,
    plugin.description,
    pluginName(plugin),
    pluginDesc(plugin),
    ...pluginRequires(plugin).flatMap((reqId) => [reqId, requiredPluginLabel(reqId)]),
  ]
  return fields.some((value) => value.toLowerCase().includes(query))
}

function scrollToHighlightedPlugin(id: string | null) {
  if (!id) return
  void nextTick(() => {
    document.getElementById(`plugin-card-${id}`)?.scrollIntoView({behavior: 'smooth', block: 'center'})
    window.setTimeout(() => pluginStore.clearHighlight(), 3200)
  })
}

watch(highlightPluginId, scrollToHighlightedPlugin, {immediate: true})

const stats = computed(() => ({
  total: pluginStore.items.length,
  enabled: pluginStore.enabledCount,
}))

const hasAlerts = computed(
    () =>
        showTeamViewerHint.value
        || (showClosestPresetHint.value && Boolean(closestPresetMatch.value))
        || showReferenceConflictBanner.value,
)

function pluginName(plugin: PluginItem): string {
  const key = `plugin.items.${plugin.id}.name`
  return te(key) ? t(key) : plugin.name
}

function pluginDesc(plugin: PluginItem): string {
  const key = `plugin.items.${plugin.id}.description`
  return te(key) ? t(key) : plugin.description
}

function surfaces(plugin: PluginItem): string[] {
  const meta = PLUGIN_REGISTRY[plugin.id as PluginId]
  return meta?.surfaces ?? []
}

function pluginRequires(plugin: PluginItem): PluginId[] {
  return listPluginRequires(plugin.id as PluginId)
}

function requiredPluginLabel(id: PluginId): string {
  const key = `plugin.items.${id}.name`
  return te(key) ? t(key) : id
}

function tone(plugin: PluginItem): string {
  return PLUGIN_REGISTRY[plugin.id as PluginId]?.tone ?? 'violet'
}

function openPlugin(plugin: PluginItem) {
  pluginStore.openPluginTarget(plugin.id as PluginId)
}

function openDetail(plugin: PluginItem) {
  detailPlugin.value = plugin
  detailOpen.value = true
}

function closeDetail() {
  detailOpen.value = false
  detailPlugin.value = null
}

function onDetailToggle() {
  if (!detailPlugin.value) return
  const id = detailPlugin.value.id
  pluginStore.toggle(id)
  bumpUsageRevision()
  detailPlugin.value = pluginStore.items.find((item) => item.id === id) ?? null
}

function onDetailPluginUpdated(plugin: PluginItem | null) {
  detailPlugin.value = plugin
  bumpUsageRevision()
}

function dismissTeamViewerHint() {
  viewerHintDismissed.value = true
}

function applySuggestedTeamPreset() {
  const presetId = suggestedTeamPreset.value
  if (!presetId) return
  applyPreset(presetId)
  viewerHintDismissed.value = true
}

function onDetailOpenFeature() {
  if (!detailPlugin.value) return
  openPlugin(detailPlugin.value)
  closeDetail()
}

function onDetailOpenSettings() {
  if (!detailPlugin.value) return
  pluginStore.openPluginTarget(detailPlugin.value.id as PluginId)
  closeDetail()
}

function applyPreset(presetId: PluginPresetId) {
  pluginStore.applyPreset(presetId)
}

function applyReferencePreset() {
  pluginStore.alignToReferencePreset()
}

function scrollToPresetDiff() {
  presetDiffPinned.value = true
  void nextTick(() => {
    document.getElementById(PLUGIN_PRESET_DIFF_ANCHOR)?.scrollIntoView({behavior: 'smooth', block: 'start'})
  })
}

function openPluginSettings() {
  layoutStore.openSettingsModule('plugins', SETTINGS_PLUGIN_REFERENCE_PRESET_ANCHOR)
}

function openReferencePresetInSettings() {
  openPluginSettings()
}

function focusRequiredPlugin(reqId: PluginId) {
  pluginStore.focusPlugin(reqId)
}

function enablePluginRequires(plugin: PluginItem) {
  const touched = pluginStore.satisfyPluginRequires(plugin.id as PluginId)
  if (touched.length) {
    bumpUsageRevision()
    toast.success(t('plugin.enableRequiresSuccess', {count: touched.length}))
  }
}

function exportPluginConfig() {
  pluginStore.exportPluginConfig()
  toast.success(t('plugin.config.exportSuccess'))
}

function triggerImportPluginConfig() {
  configImportInputRef.value?.click()
}

async function onImportPluginConfig(event: Event) {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  input.value = ''
  if (!file) return
  try {
    const text = await file.text()
    const ok = pluginStore.importPluginConfig(text)
    if (ok) {
      bumpUsageRevision()
      toast.success(t('plugin.config.importSuccess'))
    } else {
      toast.error(t('plugin.config.importFailed'))
    }
  } catch {
    toast.error(t('plugin.config.importFailed'))
  }
}

function resetPluginConfig() {
  pluginStore.resetPluginOverrides()
}

function openPluginDevTools() {
  pluginStore.openPluginDevTools()
}

function openConnectorMarket() {
  pluginStore.openConnectorMarket()
}

async function onPluginToggle(plugin: PluginItem) {
  pluginStore.toggle(plugin.id)
  bumpUsageRevision()
}
</script>

<template>
  <div class="module-page module-page--ambient-alt module-page--scroll plugin-page">
    <div class="mp-page-wrap plugin-page__wrap">
      <header class="mp-hero mp-hero--glow plugin-hero">
        <div class="mp-hero__glow" aria-hidden="true"/>
        <div class="mp-hero__inner">
          <div class="mp-hero__copy">
            <p class="mp-hero__eyebrow">{{ t('plugin.layout.eyebrow') }}</p>
            <h1 class="mp-hero__title">{{ t('plugin.title') }}</h1>
            <p class="mp-hero__sub">{{ t('plugin.subtitle') }}</p>
            <p class="mp-hero__hint">{{ t('plugin.persistHint') }}</p>
          </div>
          <div class="plugin-hero__stats">
            <div class="mp-stat mp-stat--icon mp-tone-emerald">
              <span class="mp-stat__icon" aria-hidden="true">
                <DwIcon name="submit" :stroke-width="1.6"/>
              </span>
              <span class="mp-stat__body">
                <span class="mp-stat__value">{{ stats.enabled }}</span>
                <span class="mp-stat__label">{{ t('plugin.enabledCount', {count: stats.enabled}) }}</span>
              </span>
            </div>
            <div class="mp-stat mp-stat--icon mp-tone-sky">
              <span class="mp-stat__icon" aria-hidden="true">
                <DwIcon name="plugins" :stroke-width="1.6"/>
              </span>
              <span class="mp-stat__body">
                <span class="mp-stat__value">{{ stats.total }}</span>
                <span class="mp-stat__label">{{ t('plugin.totalCount', {count: stats.total}) }}</span>
              </span>
            </div>
            <div
                v-if="presetMismatchCount > 0"
                class="mp-stat mp-stat--icon mp-stat--warn mp-tone-amber"
            >
              <span class="mp-stat__icon" aria-hidden="true">
                <DwIcon name="alert-triangle" :stroke-width="1.6"/>
              </span>
              <span class="mp-stat__body">
                <span class="mp-stat__value">{{ presetMismatchCount }}</span>
                <span class="mp-stat__label">{{ t('plugin.layout.presetMismatch') }}</span>
              </span>
            </div>
          </div>
          <div class="mp-hero__actions">
            <button class="mp-segment__btn is-active" type="button" @click="openPluginSettings">
              {{ t('plugin.openSettings') }}
            </button>
            <button
                v-if="showConnectorMarketCta"
                class="mp-segment__btn"
                type="button"
                @click="openConnectorMarket"
            >
              {{ t('plugin.connectorMarket.open') }}
            </button>
            <button
                v-if="pluginStore.isDevToolsVisible"
                class="mp-segment__btn plugin-hero__dev-btn"
                type="button"
                @click="openPluginDevTools"
            >
              {{ t('plugin.devTools.open') }}
              <StatusPill
                  v-if="pluginStore.catalogAllIssueCount > 0"
                  variant="warn"
                  class="plugin-hero__dev-badge"
              >
                {{ pluginStore.catalogAllIssueCount }}
              </StatusPill>
            </button>
            <button class="mp-segment__btn" type="button" @click="exportPluginConfig">
              {{ t('plugin.config.export') }}
            </button>
            <button class="mp-segment__btn" type="button" @click="triggerImportPluginConfig">
              {{ t('plugin.config.import') }}
            </button>
            <input
                ref="configImportInputRef"
                type="file"
                accept="application/json,.json"
                hidden
                @change="onImportPluginConfig"
            />
          </div>
        </div>
      </header>

      <div v-if="hasAlerts" class="plugin-alerts">
        <div v-if="showTeamViewerHint" class="plugin-alert plugin-alert--info">
          <span class="plugin-alert__icon" aria-hidden="true">
            <DwIcon name="user" :size="18" :stroke-width="1.6"/>
          </span>
          <div class="plugin-alert__body">
            <p class="plugin-alert__text">{{ t('plugin.teamViewerHint') }}</p>
          </div>
          <div class="plugin-alert__actions">
            <button class="mp-segment__btn is-active" type="button" @click="applySuggestedTeamPreset">
              {{ t('plugin.presets.teamViewer.label') }}
            </button>
            <button class="mp-segment__btn" type="button" @click="dismissTeamViewerHint">
              {{ t('plugin.teamViewerDismiss') }}
            </button>
          </div>
        </div>

        <div v-if="showClosestPresetHint && closestPresetMatch" class="plugin-alert plugin-alert--info">
          <span class="plugin-alert__icon" aria-hidden="true">
            <DwIcon name="star" :size="18" :stroke-width="1.6"/>
          </span>
          <div class="plugin-alert__body">
            <p class="plugin-alert__text">
              {{ t('plugin.presets.closestMatch', {
                preset: t(`plugin.presets.${closestPresetMatch.id}.label`),
                conflicts: closestPresetMatch.conflicts,
              }) }}
            </p>
          </div>
          <div class="plugin-alert__actions">
            <button class="mp-segment__btn is-active" type="button" @click="applyClosestPreset">
              {{ t('plugin.presets.closestApply', {
                preset: t(`plugin.presets.${closestPresetMatch.id}.label`),
              }) }}
            </button>
            <button
                class="mp-segment__btn"
                type="button"
                @click="referencePresetId = closestPresetMatch.id"
            >
              {{ t('plugin.presets.closestUseAsReference') }}
            </button>
          </div>
        </div>

        <div v-if="showReferenceConflictBanner" class="plugin-alert plugin-alert--warn">
          <span class="plugin-alert__icon" aria-hidden="true">
            <DwIcon name="alert-triangle" :size="18" :stroke-width="1.6"/>
          </span>
          <div class="plugin-alert__body">
            <p class="plugin-alert__text">
              {{ t('plugin.presets.referenceConflictBanner', {
                preset: t(`plugin.presets.${referencePresetId}.label`),
                count: presetMismatchCount,
              }) }}
            </p>
          </div>
          <div class="plugin-alert__actions">
            <button class="mp-segment__btn is-active" type="button" @click="applyReferencePreset">
              {{ t('plugin.presets.referenceConflictAlignAll', { count: presetMismatchCount }) }}
            </button>
            <button class="mp-segment__btn" type="button" @click="scrollToPresetDiff">
              {{ t('plugin.presets.referenceConflictViewDiff') }}
            </button>
            <button class="mp-segment__btn" type="button" @click="openReferencePresetInSettings">
              {{ t('plugin.editReferencePresetInSettings') }}
            </button>
            <button class="mp-segment__btn" type="button" @click="dismissReferenceConflictBanner">
              {{ t('plugin.presets.referenceConflictDismiss') }}
            </button>
          </div>
        </div>
      </div>

      <section v-if="showConnectorMarketCta" class="plugin-market-cta">
        <div class="plugin-market-cta__visual" aria-hidden="true">
          <span class="plugin-market-cta__orb plugin-market-cta__orb--a"/>
          <span class="plugin-market-cta__orb plugin-market-cta__orb--b"/>
          <span class="plugin-market-cta__orb plugin-market-cta__orb--c"/>
        </div>
        <div class="plugin-market-cta__copy">
          <h2 class="plugin-market-cta__title">{{ t('plugin.connectorMarket.title') }}</h2>
          <p class="plugin-market-cta__sub">{{ t('plugin.connectorMarket.ctaHint') }}</p>
        </div>
        <button class="mp-segment__btn is-active plugin-market-cta__btn" type="button" @click="openConnectorMarket">
          {{ t('plugin.connectorMarket.open') }}
        </button>
      </section>

      <div class="plugin-layout">
        <aside class="plugin-sidebar">
          <div class="plugin-panel plugin-panel--accent">
            <div class="plugin-panel__head">
              <div>
                <h2 class="plugin-panel__title">{{ t('plugin.layout.referencePreset') }}</h2>
                <p class="plugin-panel__sub">{{ t('plugin.presets.diffDescription') }}</p>
              </div>
              <StatusPill v-if="presetMismatchCount" variant="warn">{{ presetMismatchCount }}</StatusPill>
            </div>
            <div class="plugin-reference-pills">
              <button
                  v-for="presetId in presetIds"
                  :key="`ref-${presetId}`"
                  class="mp-segment__btn"
                  :class="{ 'is-active': referencePresetId === presetId }"
                  type="button"
                  @click="referencePresetId = presetId"
              >
                {{ t(`plugin.presets.${presetId}.label`) }}
              </button>
            </div>
            <div class="plugin-reference-meta">
              <StatusPill variant="neutral">
                {{ t(`plugin.presets.${referencePresetId}.label`) }}
              </StatusPill>
              <button
                  v-if="presetMismatchCount"
                  class="mp-segment__btn is-active"
                  type="button"
                  @click="applyReferencePreset"
              >
                {{ t('plugin.presets.referenceConflictAlignAll', { count: presetMismatchCount }) }}
              </button>
            </div>
            <div class="plugin-panel__actions">
              <button class="mp-segment__btn" type="button" @click="scrollToPresetDiff">
                {{ t('plugin.presets.referenceConflictViewDiff') }}
              </button>
              <button class="mp-segment__btn" type="button" @click="openReferencePresetInSettings">
                {{ t('plugin.editReferencePresetInSettings') }}
              </button>
            </div>
          </div>

          <div class="plugin-panel">
            <div class="plugin-panel__head">
              <div>
                <h2 class="plugin-panel__title">{{ t('plugin.presets.title') }}</h2>
                <p class="plugin-panel__sub">{{ t('plugin.layout.presetHint') }}</p>
              </div>
            </div>
            <div class="plugin-preset-grid">
              <button
                  v-for="presetId in presetIds"
                  :key="presetId"
                  class="plugin-preset-card"
                  type="button"
                  :title="presetButtonTitle(presetId)"
                  @click="applyPreset(presetId)"
              >
                <div class="plugin-preset-card__row">
                  <span class="plugin-preset-card__label">{{ t(`plugin.presets.${presetId}.label`) }}</span>
                  <StatusPill v-if="presetImpactCount(presetId)" variant="neutral">
                    {{ presetImpactCount(presetId) }}
                  </StatusPill>
                </div>
                <span class="plugin-preset-card__hint">{{ t(`plugin.presets.${presetId}.hint`) }}</span>
              </button>
            </div>
          </div>

          <div class="plugin-panel">
            <div class="plugin-panel__head">
              <h2 class="plugin-panel__title">{{ t('plugin.layout.config') }}</h2>
            </div>
            <div class="plugin-config-actions">
              <button class="mp-segment__btn" type="button" @click="resetPluginConfig">
                {{ t('plugin.config.reset') }}
              </button>
              <button class="mp-segment__btn" type="button" @click="openPluginSettings">
                {{ t('plugin.openSettings') }}
              </button>
            </div>
          </div>

          <section :id="PLUGIN_PRESET_DIFF_ANCHOR" class="plugin-connectors plugin-presets-diff">
            <CollapsibleSection
                :title="t('plugin.presets.diffTitle')"
                :description="t('plugin.presets.diffDescription')"
                :default-open="presetDiffSectionOpen"
            >
              <template #badge>
                <StatusPill v-if="presetDiffRows.length" variant="neutral">{{ presetDiffRows.length }}</StatusPill>
              </template>

              <div class="plugin-presets-diff__body">
                <EmptyState
                    v-if="!presetDiffRows.length"
                    embedded
                    :title="t('plugin.presets.diffEmpty')"
                    :hint="t('plugin.presets.diffEmptyHint')"
                />
                <ul v-else class="plugin-presets-diff__list">
                  <li
                      v-for="change in presetDiffRows"
                      :key="`${change.action}:${change.id}`"
                      class="plugin-presets-diff__item"
                  >
                    <span class="plugin-presets-diff__name">{{ requiredPluginLabel(change.id) }}</span>
                    <StatusPill :variant="change.action === 'enable' ? 'success' : 'warn'">
                      {{ change.action === 'enable' ? t('plugin.presets.diffEnable') : t('plugin.presets.diffDisable') }}
                    </StatusPill>
                    <span class="plugin-presets-diff__id">{{ change.id }}</span>
                  </li>
                </ul>
                <div v-if="presetDiffRows.length" class="plugin-presets-diff__actions">
                  <button
                      class="mp-segment__btn is-active"
                      type="button"
                      @click="applyReferencePreset"
                  >
                    {{ t('plugin.presets.diffApply', { preset: t(`plugin.presets.${referencePresetId}.label`) }) }}
                  </button>
                </div>
              </div>
            </CollapsibleSection>
          </section>
        </aside>

        <main class="plugin-main">
          <div class="plugin-filter-dock">
            <div class="plugin-filter-dock__search-row">
              <div class="plugin-filter-dock__search-wrap">
                <DwIcon class="plugin-filter-dock__search-icon" name="search" :stroke-width="1.8"/>
                <input
                    v-model="searchQuery"
                    class="plugin-filter-dock__input"
                    type="search"
                    :placeholder="t('plugin.searchPlaceholder')"
                />
              </div>
              <span class="plugin-filter-dock__count">
                {{ t('plugin.layout.showing', { count: filtered.length, total: stats.total }) }}
              </span>
            </div>

            <div class="plugin-filter-dock__group">
              <span class="plugin-filter-dock__label">{{ t('plugin.layout.status') }}</span>
              <div class="mp-segment mp-segment--wrap">
                <button
                    v-for="item in ['all', 'enabled', 'disabled'] as const"
                    :key="item"
                    class="mp-segment__btn"
                    :class="{ 'is-active': filter === item }"
                    type="button"
                    @click="filter = item"
                >
                  {{
                    item === 'all' ? t('plugin.filterAll') : item === 'enabled' ? t('plugin.filterEnabled') : t('plugin.filterDisabled')
                  }}
                </button>
                <button
                    class="mp-segment__btn"
                    :class="{ 'is-active': unmetRequiresOnly }"
                    type="button"
                    @click="unmetRequiresOnly = !unmetRequiresOnly"
                >
                  {{ t('plugin.filterUnmetRequires') }}
                  <StatusPill v-if="unmetRequiresCount" variant="warn">{{ unmetRequiresCount }}</StatusPill>
                </button>
                <button
                    class="mp-segment__btn"
                    :class="{ 'is-active': presetMismatchOnly }"
                    type="button"
                    @click="presetMismatchOnly = !presetMismatchOnly"
                >
                  {{ t('plugin.filterPresetMismatch', { preset: t(`plugin.presets.${referencePresetId}.label`) }) }}
                  <StatusPill v-if="presetMismatchCount" variant="warn">{{ presetMismatchCount }}</StatusPill>
                </button>
              </div>
            </div>

            <div class="plugin-filter-dock__group">
              <span class="plugin-filter-dock__label">{{ t('plugin.layout.category') }}</span>
              <div class="mp-segment mp-segment--wrap">
                <button
                    class="mp-segment__btn"
                    :class="{ 'is-active': category === 'all' }"
                    type="button"
                    @click="category = 'all'"
                >
                  {{ t('plugin.filterAll') }}
                </button>
                <button
                    v-for="cat in CATEGORY_ORDER"
                    :key="cat"
                    class="mp-segment__btn"
                    :class="{ 'is-active': category === cat }"
                    type="button"
                    @click="category = cat"
                >
                  {{ t(`plugin.category.${cat}`) }}
                </button>
              </div>
            </div>

            <div class="plugin-filter-dock__group">
              <span class="plugin-filter-dock__label">{{ t('plugin.layout.more') }}</span>
              <div class="mp-segment mp-segment--wrap">
                <button
                    class="mp-segment__btn"
                    :class="{ 'is-active': surface === 'all' }"
                    type="button"
                    @click="surface = 'all'"
                >
                  {{ t('plugin.filterAll') }}
                </button>
                <button
                    v-for="item in surfaceOptions"
                    :key="item"
                    class="mp-segment__btn"
                    :class="{ 'is-active': surface === item }"
                    type="button"
                    @click="surface = item"
                >
                  {{ t(`plugin.surfaces.${item}`) }}
                </button>
                <span class="plugin-filter-dock__label">{{ t('plugin.sortBy') }}</span>
                <button
                    class="mp-segment__btn"
                    :class="{ 'is-active': sortMode === 'default' }"
                    type="button"
                    @click="sortMode = 'default'"
                >
                  {{ t('plugin.sortDefault') }}
                </button>
                <button
                    class="mp-segment__btn"
                    :class="{ 'is-active': sortMode === 'usage' }"
                    type="button"
                    @click="sortMode = 'usage'"
                >
                  {{ t('plugin.sortByUsage') }}
                </button>
                <button
                    class="mp-segment__btn"
                    :class="{ 'is-active': sortMode === 'recent' }"
                    type="button"
                    @click="sortMode = 'recent'"
                >
                  {{ t('plugin.sortByRecent') }}
                </button>
              </div>
            </div>
          </div>

          <div class="mp-card-grid plugin-card-grid">
        <article
            v-for="plugin in filtered"
            :id="`plugin-card-${plugin.id}`"
            :key="plugin.id"
            class="mp-feature-card plugin-card"
            :class="[
              `mp-tone-${tone(plugin)}`,
              {
                'is-enabled': plugin.enabled,
                'is-highlighted': highlightPluginId === plugin.id,
                'has-unmet-requires': hasUnmetRequires(plugin),
                'preset-mismatch': conflictsWithReferencePreset(plugin),
              },
            ]"
        >
          <header class="plugin-card__head">
            <div class="plugin-card__head-main">
              <div class="mp-feature-card__title-row">
                <h2 class="mp-feature-card__title">{{ pluginName(plugin) }}</h2>
                <span class="mp-feature-card__ver">v{{ plugin.version }}</span>
              </div>
              <div class="plugin-card__meta">
                <span class="mp-feature-card__cat">{{ t(`plugin.category.${plugin.category}`) }}</span>
                <StatusPill v-if="conflictsWithReferencePreset(plugin)" variant="warn">
                  {{ presetMismatchBadgeLabel() }}
                </StatusPill>
                <StatusPill v-if="hasUnmetRequires(plugin)" variant="warn">
                  {{ t('plugin.unmetRequiresBadge') }}
                </StatusPill>
                <StatusPill v-if="pluginToggleCount(plugin)" variant="neutral">
                  {{ t('plugin.usage.toggleBadge', {count: pluginToggleCount(plugin)}) }}
                </StatusPill>
              </div>
            </div>
            <div class="plugin-card__toggle-wrap">
              <label class="mp-switch">
                <input
                    type="checkbox"
                    :checked="plugin.enabled"
                    @change="onPluginToggle(plugin)"
                />
                <span>{{ plugin.enabled ? t('plugin.enabled') : t('plugin.disabled') }}</span>
              </label>
            </div>
          </header>

          <p class="mp-feature-card__desc">{{ pluginDesc(plugin) }}</p>

          <div v-if="surfaces(plugin).length" class="mp-feature-card__surfaces">
            <span class="mp-feature-card__surfaces-label">{{ t('plugin.surfacesTitle') }}</span>
            <div class="mp-feature-card__chips">
              <span
                  v-for="surface in surfaces(plugin)"
                  :key="surface"
                  class="mp-chip"
              >
                {{ t(`plugin.surfaces.${surface}`) }}
              </span>
            </div>
          </div>

          <div v-if="pluginRequires(plugin).length" class="mp-feature-card__requires">
            <span class="mp-feature-card__surfaces-label">{{ t('plugin.detail.requires') }}</span>
            <div class="mp-feature-card__chips">
              <button
                  v-for="reqId in pluginRequires(plugin)"
                  :key="reqId"
                  type="button"
                  class="mp-chip mp-chip--hint mp-chip--link"
                  :class="{ 'is-disabled-req': !isEnabled(reqId) }"
                  @click="focusRequiredPlugin(reqId)"
              >
                {{ requiredPluginLabel(reqId) }}
              </button>
            </div>
          </div>

          <footer class="plugin-card__foot">
            <span class="mp-feature-card__author">{{ plugin.author }}</span>
            <div class="plugin-card__foot-actions">
              <button
                  v-if="hasUnmetRequires(plugin)"
                  class="mp-feature-card__detail"
                  type="button"
                  @click="enablePluginRequires(plugin)"
              >
                {{ t('plugin.enableRequires') }}
              </button>
              <button
                  class="mp-feature-card__detail"
                  type="button"
                  @click="openDetail(plugin)"
              >
                {{ t('plugin.detail.action') }}
              </button>
              <button
                  class="mp-feature-card__open"
                  type="button"
                  :disabled="!plugin.enabled"
                  @click="openPlugin(plugin)"
              >
                {{ t('plugin.openFeature') }}
              </button>
            </div>
          </footer>
        </article>

            <p v-if="!filtered.length" class="mp-empty plugin-empty">{{ t('plugin.empty') }}</p>
          </div>
        </main>
      </div>
    </div>

    <PluginDetailDialog
        :open="detailOpen"
        :plugin="detailPlugin"
        :reference-preset-id="referencePresetId"
        @close="closeDetail"
        @toggle="onDetailToggle"
        @open-feature="onDetailOpenFeature"
        @open-settings="onDetailOpenSettings"
        @plugin-updated="onDetailPluginUpdated"
    />
  </div>
</template>
