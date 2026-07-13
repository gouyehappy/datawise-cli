<script setup lang="ts">
import {computed, onMounted} from 'vue'
import {useI18n} from 'vue-i18n'
import {IconButton, ProgressBar} from '@/core/components'
import {DwIcon} from '@/core/icons'
import {useLayoutStore} from '@/features/layout/stores/layout'
import {useWorkspaceStore} from '@/features/workspace/stores/workspace'
import {useEditorSettingsStore} from '@/features/settings/stores/editor-settings'
import {isSlowDurationMs} from '@/features/workspace/services/slow-query.utils'
import {canOpenRuntimeLog, openRuntimeLog} from '@/features/layout/services/open-runtime-log.service'
import {isDesktopApp} from '@/features/layout/services/desktop-chrome'
import {
    desktopStartupProgress,
    initDesktopBackendStartupListener,
    type BackendStartupPhase,
} from '@/features/layout/services/desktop-backend-startup.service'
import {backendHealth} from '@/features/layout/services/backend-health.service'
import ExplorerStatusBreadcrumb from '@/features/layout/components/ExplorerStatusBreadcrumb.vue'
import {useExplorerStatusPath} from '@/features/explorer/composables/useExplorerStatusPath'

const {t} = useI18n()
const layout = useLayoutStore()
const workspace = useWorkspaceStore()
const editorSettings = useEditorSettingsStore()
const {hasPath: hasExplorerPath} = useExplorerStatusPath()
const desktopApp = isDesktopApp()

onMounted(() => {
    if (desktopApp) {
        initDesktopBackendStartupListener()
    }
})

const showStartupProgress = computed(
    () => desktopApp && !desktopStartupProgress.complete,
)

const startupProgressValue = computed(() => {
    if (!showStartupProgress.value) return 100
    return Math.round(desktopStartupProgress.displayProgress)
})

const startupStatusText = computed(() => {
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
})

const desktopBackendStarting = computed(() => {
  if (!desktopApp) return false
  const phase = desktopStartupProgress.phase
  return phase === 'config' || phase === 'spawning' || phase === 'warming'
})

const backendOnline = computed(() => backendHealth.status === 'online')

const backendConnecting = computed(() => {
  if (backendOnline.value) return false
  if (backendHealth.status === 'offline') return false
  if (desktopBackendStarting.value) return true
  return backendHealth.status === 'idle' || backendHealth.status === 'connecting'
})

const backendOffline = computed(() => backendHealth.status === 'offline')

const idleStatusText = computed(() => {
  if (backendOnline.value) return t('status.ready')
  if (backendConnecting.value) return t('status.backendConnecting')
  return t('status.backendOffline')
})

const idleStatusClass = computed(() => ({
  'status-bar__ready--connecting': backendConnecting.value,
  'status-bar__ready--offline': backendOffline.value,
}))

const isIdle = computed(() => {
  const {duration, rowCount} = workspace.status
  return duration === '-' && rowCount === '-'
})

const idleDotClass = computed(() => ({
  'status-bar__dot--connecting': backendConnecting.value,
  'status-bar__dot--offline': backendOffline.value,
}))

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
    <div v-if="hasExplorerPath" class="status-bar__path">
      <ExplorerStatusBreadcrumb/>
    </div>
    <div class="status-bar__main">
      <div v-if="showStartupProgress" class="status-bar__startup">
        <span class="status-bar__startup-label">{{ startupStatusText }}</span>
        <ProgressBar
            class="status-bar__startup-bar"
            size="sm"
            :value="startupProgressValue"
            :aria-label="t('app.startupProgress', { progress: startupProgressValue })"
        />
        <span class="status-bar__startup-percent">{{ startupProgressValue }}%</span>
      </div>
      <template v-else-if="isIdle">
        <span class="status-bar__ready" :class="idleStatusClass">
          <span class="status-bar__dot" :class="idleDotClass" aria-hidden="true"/>
          {{ idleStatusText }}
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

.status-bar__path {
  flex: 0 1 min(480px, 42%);
  min-width: 0;
  padding-right: 10px;
  margin-right: 2px;
  border-right: 1px solid var(--dw-border-light);
  overflow: hidden;
}

.status-bar__main {
  display: flex;
  align-items: center;
  gap: 12px;
  flex: 1;
  min-width: 0;
}

.status-bar__startup {
  display: flex;
  align-items: center;
  gap: 10px;
  min-width: 0;
  flex: 1;
  max-width: 360px;
}

.status-bar__startup-label {
  flex-shrink: 0;
  color: var(--dw-text-secondary);
  white-space: nowrap;
}

.status-bar__startup-bar {
  flex: 1;
  min-width: 72px;
}

.status-bar__startup-percent {
  flex-shrink: 0;
  min-width: 2.5em;
  text-align: right;
  font-family: var(--dw-mono);
  font-size: 10px;
  color: var(--dw-text-muted);
}

.status-bar__ready {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  color: var(--dw-text-muted);
}

.status-bar__ready--connecting {
  color: var(--dw-text-secondary);
}

.status-bar__ready--offline {
  color: #b45309;
}

.status-bar__dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: #22c55e;
  flex-shrink: 0;
}

.status-bar__dot--connecting {
  background: #f59e0b;
}

.status-bar__dot--offline {
  background: #f97316;
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
