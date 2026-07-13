<script setup lang="ts">
import {computed} from 'vue'
import {useI18n} from 'vue-i18n'
import {useAppConfigStore} from '@/features/layout/stores/app-config-store'

const {t} = useI18n()
const appConfig = useAppConfigStore()

const leftVisible = computed(() =>
    appConfig.sideRailItems.filter((item) => item.visible).length,
)
const rightVisible = computed(() =>
    appConfig.shortcutRailItems.filter((item) => item.visible).length,
)

const showLeftRail = computed(() => appConfig.showSideRailStrip && leftVisible.value > 0)
const showExplorer = computed(() => appConfig.showExplorerPanel)
const showRightRail = computed(() => appConfig.showShortcutRail)
</script>

<template>
  <div class="workbench-preview" aria-hidden="true">
    <div class="preview-chrome">
      <span class="preview-dot"/>
      <span class="preview-dot"/>
      <span class="preview-dot"/>
      <span class="preview-title">Workbench</span>
    </div>

    <div class="preview-body">
      <div class="preview-side preview-side--left" :class="{ dim: !showLeftRail }">
        <div v-for="i in 4" :key="`l-${i}`" class="preview-btn"/>
        <div class="preview-btn preview-btn--accent"/>
      </div>

      <div class="preview-center">
        <div
            class="preview-explorer"
            :class="{ dim: !showExplorer, hidden: !showExplorer }"
        >
          <div class="preview-tree-line"/>
          <div class="preview-tree-line short"/>
          <div class="preview-tree-line"/>
        </div>

        <div class="preview-workspace">
          <div class="preview-tabs">
            <span class="preview-tab active"/>
            <span class="preview-tab"/>
          </div>
          <div class="preview-editor">
            <div class="preview-code-line"/>
            <div class="preview-code-line short"/>
            <div class="preview-code-line"/>
          </div>
        </div>
      </div>

      <div class="preview-side preview-side--right" :class="{ dim: !showRightRail }">
        <div v-for="i in 4" :key="`r-${i}`" class="preview-btn"/>
      </div>
    </div>

    <div class="preview-legend">
      <span class="legend-item" :class="{ off: !showLeftRail }">
        <i class="legend-swatch legend-swatch--left"/>
        {{ leftVisible }}/{{ appConfig.sideRailItems.length }}
      </span>
      <span class="legend-item" :class="{ off: !showExplorer }">
        <i class="legend-swatch legend-swatch--explorer"/>
        {{ showExplorer ? t('settings.layout.visibleOn') : t('settings.layout.visibleOff') }}
      </span>
      <span class="legend-item" :class="{ off: !showRightRail }">
        <i class="legend-swatch legend-swatch--right"/>
        {{ rightVisible }}/{{ appConfig.shortcutRailItems.length }}
      </span>
    </div>
  </div>
</template>

<style scoped>
.workbench-preview {
  border: 1px solid var(--dw-border-light);
  border-radius: 16px;
  overflow: hidden;
  background: radial-gradient(120% 80% at 0% 0%, color-mix(in srgb, var(--dw-primary) 8%, transparent), transparent 55%),
  var(--dw-bg-panel);
  box-shadow: var(--dw-panel-shadow);
}

.preview-chrome {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 10px 14px;
  border-bottom: 1px solid var(--dw-border-light);
  background: color-mix(in srgb, var(--dw-bg) 70%, transparent);
}

.preview-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: var(--dw-border);
}

.preview-dot:nth-child(1) {
  background: #ff5f57;
}

.preview-dot:nth-child(2) {
  background: #febc2e;
}

.preview-dot:nth-child(3) {
  background: #28c840;
}

.preview-title {
  margin-left: 6px;
  color: var(--dw-text-muted);
  font-size: 11px;
  font-weight: 500;
  letter-spacing: 0.02em;
}

.preview-body {
  display: flex;
  gap: 6px;
  min-height: 148px;
  padding: 14px;
}

.preview-side {
  display: flex;
  flex-direction: column;
  gap: 5px;
  width: 28px;
  padding: 6px 4px;
  border-radius: 10px;
  background: var(--dw-bg-rail);
  border: 1px solid var(--dw-border-light);
  transition: opacity 0.2s ease, filter 0.2s ease;
}

.preview-side.dim {
  opacity: 0.35;
  filter: grayscale(0.6);
}

.preview-btn {
  width: 100%;
  height: 14px;
  border-radius: 5px;
  background: color-mix(in srgb, var(--dw-text) 8%, transparent);
}

.preview-btn--accent {
  margin-top: auto;
  background: color-mix(in srgb, var(--dw-primary) 35%, transparent);
}

.preview-center {
  display: flex;
  flex: 1;
  min-width: 0;
  gap: 6px;
}

.preview-explorer {
  width: 34%;
  flex-shrink: 0;
  padding: 8px;
  border-radius: 10px;
  border: 1px solid var(--dw-border-light);
  background: var(--dw-bg);
  display: flex;
  flex-direction: column;
  gap: 5px;
  transition: width 0.25s ease, opacity 0.2s ease, padding 0.25s ease;
}

.preview-explorer.hidden {
  width: 0;
  padding: 0;
  border-color: transparent;
  overflow: hidden;
  opacity: 0;
}

.preview-explorer.dim:not(.hidden) {
  opacity: 0.45;
}

.preview-tree-line {
  height: 5px;
  border-radius: 3px;
  background: color-mix(in srgb, var(--dw-text) 10%, transparent);
}

.preview-tree-line.short {
  width: 68%;
}

.preview-workspace {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding: 8px;
  border-radius: 10px;
  border: 1px solid var(--dw-border-light);
  background: var(--dw-bg-editor, var(--dw-bg));
}

.preview-tabs {
  display: flex;
  gap: 4px;
}

.preview-tab {
  width: 28%;
  height: 8px;
  border-radius: 999px;
  background: color-mix(in srgb, var(--dw-text) 8%, transparent);
}

.preview-tab.active {
  background: color-mix(in srgb, var(--dw-primary) 40%, transparent);
}

.preview-editor {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 5px;
  padding-top: 4px;
}

.preview-code-line {
  height: 5px;
  border-radius: 3px;
  background: color-mix(in srgb, var(--dw-text) 9%, transparent);
}

.preview-code-line.short {
  width: 55%;
}

.preview-legend {
  display: flex;
  flex-wrap: wrap;
  gap: 8px 14px;
  padding: 10px 14px 12px;
  border-top: 1px solid var(--dw-border-light);
}

.legend-item {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  color: var(--dw-text-secondary);
  font-size: 11px;
  font-weight: 500;
}

.legend-item.off {
  opacity: 0.45;
}

.legend-swatch {
  width: 10px;
  height: 10px;
  border-radius: 3px;
}

.legend-swatch--left {
  background: var(--dw-bg-rail);
  border: 1px solid var(--dw-border);
}

.legend-swatch--explorer {
  background: var(--dw-bg);
  border: 1px solid var(--dw-border);
}

.legend-swatch--right {
  background: color-mix(in srgb, var(--dw-primary) 25%, var(--dw-bg-rail));
  border: 1px solid var(--dw-border);
}
</style>
