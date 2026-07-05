<script setup lang="ts">
import {computed} from 'vue'
import {useI18n} from 'vue-i18n'
import {IconButton} from '@/core/components'
import {DwIcon} from '@/core/icons'
import {useLayoutStore} from '@/features/layout/stores/layout'
import {useWorkspaceStore} from '@/features/workspace/stores/workspace'
import {useEditorSettingsStore} from '@/features/settings/stores/editor-settings'
import {isSlowDurationMs} from '@/features/workspace/services/slow-query.utils'
import {canOpenRuntimeLog, openRuntimeLog} from '@/features/layout/services/open-runtime-log.service'

const {t} = useI18n()
const layout = useLayoutStore()
const workspace = useWorkspaceStore()
const editorSettings = useEditorSettingsStore()

const isIdle = computed(() => {
  const {duration, rowCount} = workspace.status
  return duration === '-' && rowCount === '-'
})

const isSlowExecution = computed(() => {
  const durationMs = workspace.status.durationMs
  if (durationMs == null || !Number.isFinite(durationMs)) return false
  return isSlowDurationMs(durationMs, editorSettings.settings.slowQueryThresholdMs)
})

const showRuntimeLogAction = computed(() => canOpenRuntimeLog())
const exportPanelOpen = computed(() => layout.activeShortcutPanel === 'export')

function toggleExportPanel() {
  layout.toggleShortcutPanel('export')
}

async function onOpenRuntimeLog() {
  const result = await openRuntimeLog()
  if (result.ok) return
  if (result.error === 'missing') {
    layout.showToast(t('shortcut.runtimeLog.missing', {path: result.path ?? ''}))
    return
  }
  if (result.error === 'open_failed') {
    layout.showToast(t('shortcut.runtimeLog.openFailed'))
    return
  }
  layout.showToast(t('shortcut.runtimeLog.unsupported'))
}
</script>

<template>
  <footer class="status-bar">
    <div class="status-bar__main">
      <template v-if="isIdle">
        <span class="status-bar__ready">
          <span class="status-bar__dot" aria-hidden="true"/>
          {{ t('status.ready') }}
        </span>
      </template>
      <template v-else>
        <span class="status-bar__message">{{ workspace.status.message }}</span>
        <span class="status-bar__meta">
          {{ t('status.timeLabel') }}
          <span :class="{ 'status-bar__duration--slow': isSlowExecution }">{{ workspace.status.duration }}</span>
          <span class="status-bar__sep" aria-hidden="true">·</span>
          {{ t('status.rowsLabel') }} {{ workspace.status.rowCount }}
        </span>
      </template>
    </div>

    <div class="status-bar__actions">
      <IconButton
          v-if="showRuntimeLogAction"
          size="sm"
          :title="t('shortcut.runtimeLog.title')"
          @click="onOpenRuntimeLog"
      >
        <DwIcon class="status-bar__icon" name="file" fit :stroke-width="1.5"/>
      </IconButton>
      <IconButton
          size="sm"
          :title="t('status.showAll')"
          :active="exportPanelOpen"
          :aria-pressed="exportPanelOpen"
          @click="toggleExportPanel"
      >
        <DwIcon class="status-bar__icon" name="export" fit :stroke-width="1.5"/>
      </IconButton>
    </div>
  </footer>
</template>

<style scoped>
.status-bar {
  display: flex;
  align-items: center;
  gap: 8px;
  height: var(--dw-status-height);
  padding: 0 10px 0 14px;
  border-top: 1px solid var(--dw-panel-border);
  background: var(--dw-bg-chrome);
  color: var(--dw-text-secondary);
  font-size: 11px;
  user-select: none;
}

.status-bar__main {
  display: flex;
  align-items: center;
  gap: 12px;
  flex: 1;
  min-width: 0;
}

.status-bar__ready {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  color: var(--dw-text-muted);
}

.status-bar__dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: #22c55e;
  flex-shrink: 0;
}

.status-bar__message {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  color: var(--dw-text);
  font-weight: 500;
}

.status-bar__meta {
  flex-shrink: 0;
  color: var(--dw-text-muted);
  font-family: var(--dw-mono);
  font-size: 10px;
}

.status-bar__sep {
  margin: 0 4px;
  opacity: 0.5;
}

.status-bar__duration--slow {
  color: rgb(239, 68, 68);
  font-weight: 600;
}

.status-bar__actions {
  display: inline-flex;
  align-items: center;
  gap: 2px;
  flex-shrink: 0;
}

.status-bar__icon {
  display: block;
  width: 14px;
  height: 14px;
}
</style>
