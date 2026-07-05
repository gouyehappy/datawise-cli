<!--
  工作区：首页无 Tab 栏；打开控制台/表等后才显示 Tab
-->
<script setup lang="ts">
import {computed} from 'vue'
import {useWorkspaceStore} from '@/features/workspace/stores/workspace'
import {resolveWorkspaceTab} from '../tab-registry'
import WorkspaceTabs from './WorkspaceTabs.vue'
import WelcomeTab from './tabs/WelcomeTab.vue'

const workspace = useWorkspaceStore()

const activeTab = computed(() => workspace.activeTab)
const tabComponent = computed(() => (activeTab.value ? resolveWorkspaceTab(activeTab.value.type) : null))
const isHome = computed(() => !activeTab.value)
</script>

<template>
  <main class="workspace" :class="{ 'workspace--home': isHome }" data-onboarding="workspace-main">
    <WorkspaceTabs v-if="workspace.hasOpenTabs"/>
    <div class="workspace-body">
      <WelcomeTab v-if="isHome"/>
      <component
          :is="tabComponent"
          v-else-if="activeTab && tabComponent"
          :key="activeTab.id"
          :tab="activeTab"
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
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  background: var(--dw-bg-editor);
}

.workspace-body > :deep(*) {
  flex: 1;
  min-height: 0;
}
</style>
