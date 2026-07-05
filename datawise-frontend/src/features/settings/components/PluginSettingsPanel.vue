<script setup lang="ts">
import {computed, nextTick, onMounted, watch} from 'vue'
import {storeToRefs} from 'pinia'
import {useI18n} from 'vue-i18n'
import {StatusPill} from '@/core/components'
import {usePluginStore} from '@/features/plugin/stores/plugin-store'
import {useAppConfigStore} from '@/features/layout/stores/app-config-store'
import {useLayoutStore} from '@/features/layout/stores/layout'
import {UserResource} from '@/features/auth/types/user-resource.types'
import {useResourceWriteGuard} from '@/features/auth/composables/useResourceWriteGuard'
import {usePluginPresetSummary} from '@/features/plugin/composables/usePluginPresetSummary'
import {
    PLUGIN_PRESET_IDS,
    type PluginPresetId,
} from '@/features/plugin/services/plugin-preset.service'
import {CONNECTOR_CAPABILITY_DOC} from '@/features/plugin/services/plugin-connector-crossref.service'
import {SETTINGS_PLUGIN_REFERENCE_PRESET_ANCHOR} from '@/features/plugin/services/plugin-navigation.service'

const {t, te} = useI18n()
const pluginStore = usePluginStore()
const appConfig = useAppConfigStore()
const layout = useLayoutStore()
const {settingsScrollAnchor} = storeToRefs(layout)
const {readOnly, hint, denyIfReadOnly} = useResourceWriteGuard(UserResource.AppConfig)

const {referencePresetId: summaryReferencePresetId, referencePresetConflictCount} = usePluginPresetSummary()

const referencePresetId = computed<PluginPresetId>({
    get: () => summaryReferencePresetId.value,
    set: (id) => {
        if (denyIfReadOnly()) return
        pluginStore.setReferencePresetId(id)
    },
})

function presetLabel(id: PluginPresetId): string {
    const key = `plugin.presets.${id}.label`
    return te(key) ? t(key) : id
}

function selectPreset(id: PluginPresetId) {
    if (denyIfReadOnly()) return
    referencePresetId.value = id
}

function alignToReferencePreset() {
    if (denyIfReadOnly()) return
    pluginStore.alignToReferencePreset()
}

function openPresetDiff() {
    pluginStore.openPluginPresetDiff()
}

function openPluginCenter() {
    pluginStore.openPluginCenter()
}

function openPluginDevTools() {
    pluginStore.openPluginDevTools()
}

function scrollToSettingsAnchor() {
    if (settingsScrollAnchor.value !== SETTINGS_PLUGIN_REFERENCE_PRESET_ANCHOR) return
    void nextTick(() => {
        document.getElementById(SETTINGS_PLUGIN_REFERENCE_PRESET_ANCHOR)?.scrollIntoView({
            behavior: 'smooth',
            block: 'start',
        })
        layout.clearSettingsScrollAnchor()
    })
}

onMounted(scrollToSettingsAnchor)
watch(settingsScrollAnchor, scrollToSettingsAnchor)
</script>

<template>
  <div class="plugin-settings">
    <header class="panel-head">
      <h2>{{ t('settings.plugins.title') }}</h2>
      <p>{{ t('settings.plugins.subtitle') }}</p>
    </header>

    <p v-if="readOnly" class="guest-notice">{{ hint }}</p>

    <section
        :id="SETTINGS_PLUGIN_REFERENCE_PRESET_ANCHOR"
        class="setting-block"
        :class="{'is-readonly': readOnly}"
    >
      <div class="setting-block__head">
        <h3>{{ t('settings.plugins.referencePresetTitle') }}</h3>
        <p class="hint">{{ t('settings.plugins.referencePresetHint') }}</p>
      </div>
      <div class="preset-picker">
        <button
            v-for="presetId in PLUGIN_PRESET_IDS"
            :key="presetId"
            class="preset-picker__btn"
            :class="{ 'is-active': referencePresetId === presetId }"
            type="button"
            :disabled="readOnly"
            @click="selectPreset(presetId)"
        >
          {{ presetLabel(presetId) }}
        </button>
      </div>
      <div class="reference-status">
        <StatusPill
            v-if="referencePresetConflictCount > 0"
            variant="warn"
        >
          {{ t('settings.plugins.presetConflicts', { count: referencePresetConflictCount }) }}
        </StatusPill>
        <StatusPill v-else variant="neutral">
          {{ t('settings.plugins.presetSynced') }}
        </StatusPill>
        <button
            v-if="referencePresetConflictCount > 0"
            class="config-btn config-btn--inline"
            type="button"
            :disabled="readOnly"
            @click="alignToReferencePreset"
        >
          {{ t('settings.plugins.alignReferencePreset') }}
        </button>
        <button
            class="config-btn config-btn--inline"
            type="button"
            @click="openPresetDiff"
        >
          {{ t('settings.plugins.viewPresetDiff') }}
        </button>
      </div>
      <p class="field-note">{{ t('settings.plugins.referencePresetPersist') }}</p>
    </section>

    <section class="setting-block">
      <div class="setting-block__head">
        <h3>{{ t('settings.plugins.centerTitle') }}</h3>
        <p class="hint">{{ t('settings.plugins.centerHint') }}</p>
      </div>
      <button class="config-btn" type="button" @click="openPluginCenter">
        {{ t('settings.plugins.openPluginCenter') }}
      </button>
      <button
          v-if="appConfig.isPluginDevToolsVisible()"
          class="config-btn config-btn--inline"
          type="button"
          @click="openPluginDevTools"
      >
        {{ t('settings.plugins.openPluginDevTools') }}
      </button>
      <p class="field-note">
        {{ t('settings.plugins.statsNote', {
          enabled: pluginStore.enabledCount,
          total: pluginStore.items.length,
        }) }}
      </p>
    </section>

    <section class="setting-block">
      <p class="hint">{{ t('settings.plugins.crossrefHint', {doc: CONNECTOR_CAPABILITY_DOC}) }}</p>
    </section>
  </div>
</template>

<style scoped>
.plugin-settings {
  max-width: clamp(480px, 58vw, 760px);
}

.setting-block {
  margin-bottom: 24px;
}

.setting-block__head h3 {
  margin: 0 0 4px;
  font-size: 1rem;
}

.preset-picker {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-top: 12px;
}

.preset-picker__btn {
  padding: 6px 12px;
  border: 1px solid var(--dw-border);
  border-radius: 8px;
  background: var(--dw-surface);
  font-size: 0.875rem;
  cursor: pointer;
}

.preset-picker__btn.is-active {
  border-color: var(--dw-primary);
  background: color-mix(in srgb, var(--dw-primary) 12%, transparent);
}

.preset-picker__btn:disabled {
  opacity: 0.55;
  cursor: not-allowed;
}

.reference-status {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
  margin-top: 12px;
}

.config-btn {
  margin-top: 8px;
  padding: 8px 14px;
  border: 1px solid var(--dw-border);
  border-radius: 8px;
  background: var(--dw-surface);
  cursor: pointer;
}

.config-btn--inline {
  margin-top: 0;
  padding: 6px 12px;
  font-size: 0.8125rem;
}

.field-note {
  margin: 10px 0 0;
  font-size: 0.8125rem;
  color: var(--dw-text-muted);
}
</style>
