<!--
  工作区：首页无 Tab 栏；打开控制台/表等后才显示 Tab
-->
<script setup lang="ts">
import {computed, KeepAlive, nextTick, onMounted, watch} from 'vue'
import {useWorkspaceStore} from '@/features/workspace/stores/workspace'
import {useExplorerStore} from '@/features/explorer/stores/explorer'
import {resolveWorkspaceTab} from '../tab-registry'
import WorkspaceTabs from './WorkspaceTabs.vue'
import WelcomeTab from './tabs/WelcomeTab.vue'
import ConnectionReconnectOverlay from './ConnectionReconnectOverlay.vue'

const workspace = useWorkspaceStore()
const explorer = useExplorerStore()

const activeTab = computed(() => workspace.activeTab)
const tabComponent = computed(() => (activeTab.value ? resolveWorkspaceTab(activeTab.value.type) : null))
const showWelcome = computed(() => !activeTab.value || !tabComponent.value)
const showActiveTab = computed(() => Boolean(activeTab.value && tabComponent.value))

const reconnectConnectionId = computed(() => {
  const tab = activeTab.value
  if (!tab?.connectionId) return null
  if (!explorer.connectionNeedsReconnect(tab.connectionId)) return null
  return tab.connectionId
})

const reconnectConnectionName = computed(() => {
  const id = reconnectConnectionId.value
  if (!id) return ''
  return explorer.findNode(id)?.label || id
})

/** SQL 控制台 / 快捷命令编辑：避免 KeepAlive 复用同类型异步组件导致空白页。SSH 终端保留缓存，切 Tab 不断开。 */
const KEEPALIVE_EXCLUDE = ['SqlConsoleTab', 'SshScriptRecordTab']

function reconcileBrokenActiveTab() {
  const tab = workspace.activeTab
  if (!tab) return
  if (resolveWorkspaceTab(tab.type)) return
  workspace.closeTab(tab.id)
}

onMounted(() => nextTick(reconcileBrokenActiveTab))
watch(activeTab, () => nextTick(reconcileBrokenActiveTab))
</script>

<template>
  <main class="workspace" :class="{ 'workspace--home': showWelcome }" data-onboarding="workspace-main">
    <WorkspaceTabs v-if="workspace.hasOpenTabs"/>
    <div class="workspace-body">
      <WelcomeTab v-if="showWelcome"/>
      <KeepAlive v-if="showActiveTab && activeTab && tabComponent" :max="5" :exclude="KEEPALIVE_EXCLUDE">
        <component
            :is="tabComponent"
            :key="activeTab.id"
            :tab="activeTab"
        />
      </KeepAlive>
      <ConnectionReconnectOverlay
          v-if="reconnectConnectionId"
          :connection-id="reconnectConnectionId"
          :connection-name="reconnectConnectionName"
      />
    </div>
  </main>
</template>

<style scoped>
.workspace {
  display: flex;
  flex-direction: column;
  flex: 1;
  min-width: 0;
  min-height: 0;
  border: 1px solid var(--dw-panel-border);
  border-radius: var(--dw-panel-radius);
  background: var(--dw-bg-editor);
  box-shadow: var(--dw-panel-shadow);
  overflow: hidden;
}

.workspace-body {
  position: relative;
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  background: var(--dw-bg-editor);
}

.workspace-body > :deep(*:not(.connection-reconnect-overlay)) {
  flex: 1;
  min-height: 0;
}

.workspace-body > :deep(.connection-reconnect-overlay) {
  position: absolute;
  inset: 0;
  flex: none;
  width: auto;
  height: auto;
  min-height: 0;
}
</style>
