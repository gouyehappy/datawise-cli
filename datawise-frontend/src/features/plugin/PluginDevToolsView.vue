<script setup lang="ts">
import {onMounted} from 'vue'
import {useI18n} from 'vue-i18n'
import PluginDeveloperToolsSection from '@/features/plugin/components/PluginDeveloperToolsSection.vue'
import {usePluginDeveloperTools} from '@/features/plugin/composables/usePluginDeveloperTools'
import {usePluginPresetSummary} from '@/features/plugin/composables/usePluginPresetSummary'
import {usePluginStore} from '@/features/plugin/stores/plugin-store'
import {useToastStore} from '@/features/layout/stores/toast-store'
import '@/features/plugin/styles/plugin-dev-tools.css'

const {t, te} = useI18n()
const pluginStore = usePluginStore()
const toast = useToastStore()
const initialTab = pluginStore.consumeDevToolsTab() ?? undefined
const {referencePresetId, referencePresetConflictCount} = usePluginPresetSummary()

const {
    matrixRows,
    explorerCrossRefs,
    usageLeaderboard,
    hookRows,
    hookTemplateIds,
    catalogLoading,
    catalogError,
    loadedPluginJars,
    pluginLoadFailures,
    catalogAuditIssues,
    catalogMetadataIssues,
    catalogAllIssueCount,
    connectorJarCount,
    requiredPluginLabel,
    hookLabel,
    hookTemplateLabel,
    catalogAuditKindLabel,
    catalogMetadataKindLabel,
    refreshRegisteredHooks,
    copyCrossRefDoc,
    copyHookTemplate,
    exportPluginMatrixCsv,
    exportCatalogRegistryDiffCsv,
    clearUsageStats,
} = usePluginDeveloperTools()

function referencePresetLabel(): string {
    const key = `plugin.presets.${referencePresetId.value}.label`
    return te(key) ? t(key) : referencePresetId.value
}

function alignReferencePreset() {
    pluginStore.alignToReferencePreset()
}

function openPresetDiff() {
    pluginStore.openPluginPresetDiff()
}

onMounted(() => {
    if (!pluginStore.isDevToolsVisible) {
        pluginStore.openPluginCenter()
        toast.show(t('plugin.devTools.hiddenHint'))
    }
})
</script>

<template>
  <div class="module-page module-page--ambient-alt module-page--scroll plugin-dev-page">
    <div class="mp-page-wrap plugin-dev-page__wrap">
      <PluginDeveloperToolsSection
          class="plugin-dev--standalone"
          :initial-tab="initialTab"
          :matrix-rows="matrixRows"
          :explorer-cross-refs="explorerCrossRefs"
          :usage-leaderboard="usageLeaderboard"
          :hook-rows="hookRows"
          :hook-template-ids="hookTemplateIds"
          :catalog-loading="catalogLoading"
          :catalog-error="catalogError"
          :loaded-plugin-jars="loadedPluginJars"
          :plugin-load-failures="pluginLoadFailures"
          :catalog-audit-issues="catalogAuditIssues"
          :catalog-metadata-issues="catalogMetadataIssues"
          :catalog-all-issue-count="catalogAllIssueCount"
          :connector-jar-count="connectorJarCount"
          :reference-preset-mismatch-count="referencePresetConflictCount"
          :reference-preset-label="referencePresetLabel()"
          :required-plugin-label="requiredPluginLabel"
          :hook-label="hookLabel"
          :hook-template-label="hookTemplateLabel"
          :catalog-audit-kind-label="catalogAuditKindLabel"
          :catalog-metadata-kind-label="catalogMetadataKindLabel"
          @export-matrix-csv="exportPluginMatrixCsv"
          @export-catalog-diff-csv="exportCatalogRegistryDiffCsv"
          @clear-usage="clearUsageStats"
          @copy-cross-ref-doc="copyCrossRefDoc"
          @copy-hook-template="copyHookTemplate"
          @refresh-hooks="refreshRegisteredHooks"
          @align-reference-preset="alignReferencePreset"
          @open-preset-diff="openPresetDiff"
      />
      <p class="plugin-dev-page__back">
        <button class="plugin-dev-page__back-btn" type="button" @click="pluginStore.openPluginCenter()">
          {{ t('plugin.devTools.backToCenter') }}
        </button>
      </p>
    </div>
  </div>
</template>

<style scoped>
.plugin-dev-page__wrap {
    max-width: 1280px;
}

.plugin-dev-page :deep(.plugin-dev--standalone) {
    margin-top: 0;
}

.plugin-dev-page__back {
    margin: clamp(16px, 2vmin, 24px) 0 0;
    text-align: center;
}

.plugin-dev-page__back-btn {
    padding: 8px 14px;
    border: 1px solid var(--dw-border);
    border-radius: var(--dw-radius-md, 8px);
    background: transparent;
    color: var(--dw-text-secondary);
    font-size: 0.875rem;
    cursor: pointer;
}

.plugin-dev-page__back-btn:hover {
    color: var(--dw-primary);
    border-color: color-mix(in srgb, var(--dw-primary) 35%, var(--dw-border));
}
</style>
