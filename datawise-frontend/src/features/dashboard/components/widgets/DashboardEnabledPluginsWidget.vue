<script setup lang="ts">
import {toRefs} from 'vue'
import {useI18n} from 'vue-i18n'
import DashboardWidgetFrame from '@/features/dashboard/components/DashboardWidgetFrame.vue'
import {StatusPill, EmptyState} from '@/core/components'
import type {PluginPresetId} from '@/features/plugin/services/plugin-preset.service'
import {useReferenceConflictBannerDismiss} from '@/features/plugin/composables/useReferenceConflictBannerDismiss'
import '@/features/dashboard/styles/dashboard-widgets.css'

interface PluginItem {
  id: string
  name: string
  version: string
}

const props = defineProps<{
  editMode: boolean
  isDragging: boolean
  isDropTarget: boolean
  plugins: PluginItem[]
  referencePresetId: PluginPresetId
  referencePresetConflictCount: number
}>()

const emit = defineEmits<{
  openPlugins: []
  openPresetDiff: []
  alignReferencePreset: []
  focusPlugin: [id: string]
  'drag-start': [event: DragEvent]
  'drag-over': []
  drop: []
  'drag-end': []
}>()

const {referencePresetId, referencePresetConflictCount} = toRefs(props)

const {
  visible: showReferenceConflictActions,
  dismiss: dismissReferenceConflict,
} = useReferenceConflictBannerDismiss(referencePresetId, referencePresetConflictCount)

const {t} = useI18n()
</script>

<template>
  <DashboardWidgetFrame
      :edit-mode="editMode"
      :is-dragging="isDragging"
      :is-drop-target="isDropTarget"
      @drag-start="emit('drag-start', $event)"
      @drag-over="emit('drag-over')"
      @drop="emit('drop')"
      @drag-end="emit('drag-end')"
  >
    <header class="dash-card__head dash-card__head--split">
      <div class="dash-card__head-main">
        <h2 class="dash-card__title">{{ t('dashboard.enabledPluginsList') }}</h2>
        <span class="dash-card__badge">{{ plugins.length }}</span>
      </div>
      <div class="dash-card__head-actions">
        <StatusPill variant="neutral" class="dash-card__preset-pill">
          {{ t('dashboard.referencePreset', { preset: t(`plugin.presets.${referencePresetId}.label`) }) }}
        </StatusPill>
        <StatusPill
            v-if="showReferenceConflictActions"
            variant="warn"
            class="dash-card__conflict-pill"
        >
          {{ t('dashboard.presetConflicts', { count: referencePresetConflictCount }) }}
        </StatusPill>
        <button
            v-if="showReferenceConflictActions"
            class="dash-card__link-btn dash-card__link-btn--primary"
            type="button"
            @click="emit('alignReferencePreset')"
        >
          {{ t('dashboard.alignReferencePreset') }}
        </button>
        <button
            class="dash-card__link-btn"
            type="button"
            @click="emit('openPresetDiff')"
        >
          {{ t('dashboard.openPresetDiff') }}
        </button>
      </div>
    </header>
    <div class="dash-card__body">
      <div v-if="showReferenceConflictActions" class="dash-card__conflict-banner">
        <p class="dash-card__conflict-banner-text">
          {{ t('plugin.presets.referenceConflictBanner', {
            preset: t(`plugin.presets.${referencePresetId}.label`),
            count: referencePresetConflictCount,
          }) }}
        </p>
        <div class="dash-card__conflict-banner-actions">
          <button
              class="dash-card__link-btn dash-card__link-btn--primary"
              type="button"
              @click="emit('alignReferencePreset')"
          >
            {{ t('plugin.presets.referenceConflictAlignAll', { count: referencePresetConflictCount }) }}
          </button>
          <button
              class="dash-card__link-btn"
              type="button"
              @click="dismissReferenceConflict"
          >
            {{ t('plugin.presets.referenceConflictDismiss') }}
          </button>
        </div>
      </div>
      <EmptyState v-if="!plugins.length" embedded :title="t('dashboard.noEnabledPlugins')"/>
      <button
          v-for="plugin in plugins"
          :key="plugin.id"
          class="dash-item dash-item--row"
          type="button"
          @click="emit('focusPlugin', plugin.id)"
      >
        <span class="dash-item__title">{{ plugin.name }}</span>
        <StatusPill variant="neutral">v{{ plugin.version }}</StatusPill>
      </button>
    </div>
  </DashboardWidgetFrame>
</template>

<style scoped>
.dash-card__head--split {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 10px;
}

.dash-card__head-main {
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
}

.dash-card__head-actions {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-shrink: 0;
}

.dash-card__preset-pill {
  max-width: 160px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.dash-card__conflict-pill {
  flex-shrink: 0;
}

.dash-card__conflict-banner {
  margin-bottom: 10px;
  padding: 10px 12px;
  border: 1px solid var(--dw-border-warn, var(--dw-border));
  border-radius: 8px;
  background: var(--dw-bg-warn-subtle, var(--dw-bg-hover));
}

.dash-card__conflict-banner-text {
  margin: 0 0 8px;
  font-size: 0.8125rem;
  line-height: 1.4;
}

.dash-card__conflict-banner-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.dash-card__link-btn {
  flex-shrink: 0;
  padding: 4px 8px;
  border: 1px solid var(--dw-border);
  border-radius: 6px;
  background: transparent;
  font-size: 0.75rem;
  color: var(--dw-primary);
  cursor: pointer;
}

.dash-card__link-btn:hover {
  background: var(--dw-bg-hover);
}

.dash-card__link-btn--primary {
  border-color: var(--dw-primary);
  color: var(--dw-primary);
  font-weight: 500;
}
</style>
