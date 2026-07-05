<script setup lang="ts">
/**
 * 主内容区：根据 layout.activeModule 切换数据库三栏 / AI 工作台 / 其它模块页
 */
import {computed} from 'vue'
import {useAppConfigStore} from '@/features/layout/stores/app-config-store'
import {useLayoutStore} from '@/features/layout/stores/layout'
import DatabaseExplorer from '@/features/explorer/components/DatabaseExplorer.vue'
import AiWorkbench from '@/features/ai/AiWorkbench.vue'
import ModuleWorkbench from '@/features/layout/components/ModuleWorkbench.vue'
import WorkspaceArea from '@/features/workspace/components/WorkspaceArea.vue'
import ShortcutRail from '@/features/layout/components/ShortcutRail.vue'
import ResizeHandle from '@/core/components/ResizeHandle.vue'
import TerminalPane from '@/features/layout/components/TerminalPane.vue'
import {useExplorerStore} from '@/features/explorer/stores/explorer'
import {resolveWorkbenchModule} from '@/features/layout/module-registry'
import {useSidePanelResizeBounds, EXPLORER_PANEL_RESIZE_MIN} from '@/core/composables/useSidePanelResizeBounds'

const layout = useLayoutStore()
const appConfig = useAppConfigStore()
const explorer = useExplorerStore()
const {min: explorerResizeMin, max: explorerResizeMax} = useSidePanelResizeBounds({
    min: EXPLORER_PANEL_RESIZE_MIN,
})

const workbenchPage = computed(() => resolveWorkbenchModule(layout.activeModule))
</script>

<template>
  <div class="main-content">
    <template v-if="layout.isDatabaseModule">
      <div class="module-workbench">
        <div v-if="appConfig.showExplorerPanel" class="explorer-pane" :style="{ width: `${explorer.width}px` }" data-onboarding="explorer-panel">
          <DatabaseExplorer class="explorer-pane__panel"/>
          <ResizeHandle
              v-model="explorer.width"
              :min="explorerResizeMin"
              :max="explorerResizeMax"
              class="explorer-pane__resize panel-resize-handle--trailing"
          />
        </div>
        <div class="module-workbench__center">
          <WorkspaceArea/>
          <TerminalPane/>
        </div>
        <ShortcutRail v-if="appConfig.showShortcutRail"/>
      </div>
    </template>

    <template v-else-if="layout.activeModule === 'ai'">
      <AiWorkbench/>
    </template>

    <ModuleWorkbench v-else-if="workbenchPage">
      <component :is="workbenchPage"/>
    </ModuleWorkbench>
  </div>
</template>

<style scoped>
.main-content {
  display: flex;
  flex: 1;
  min-width: 0;
  min-height: 0;
  overflow: hidden;
}

.explorer-pane {
  position: relative;
  flex-shrink: 0;
  align-self: stretch;
  display: flex;
  flex-direction: column;
  min-width: 0;
  min-height: 0;
}

.explorer-pane :deep(.explorer-pane__panel) {
  flex: 1;
  width: 100%;
  min-width: 0;
  min-height: 0;
  max-width: none;
}
</style>
