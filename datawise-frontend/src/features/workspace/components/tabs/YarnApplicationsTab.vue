<script setup lang="ts">
import {computed, ref} from 'vue'
import {useI18n} from 'vue-i18n'
import {useExplorerStore} from '@/features/explorer/stores/explorer'
import YarnApplicationsPanel from '@/features/workspace/components/yarn/YarnApplicationsPanel.vue'
import type {WorkspaceTab} from '@/core/types'

const props = defineProps<{ tab: WorkspaceTab }>()

const {t} = useI18n()
const explorer = useExplorerStore()
const panelRef = ref<InstanceType<typeof YarnApplicationsPanel> | null>(null)

const connectionId = computed(() => props.tab.connectionId ?? '')
const connectionLabel = computed(() => {
  if (!connectionId.value) return t('explorer.yarnApps.noConnection')
  return explorer.findNode(connectionId.value)?.label ?? connectionId.value
})

function refresh() {
  panelRef.value?.refresh()
}
</script>

<template>
  <div class="yarn-apps-tab">
    <header class="yarn-apps-tab__head">
      <div class="yarn-apps-tab__title">
        <h2>{{ t('explorer.yarnApps.title') }}</h2>
        <p>{{ connectionLabel }}</p>
      </div>
      <button class="yarn-apps-tab__refresh" type="button" @click="refresh">
        {{ t('explorer.yarnApps.refresh') }}
      </button>
    </header>
    <YarnApplicationsPanel
        ref="panelRef"
        class="yarn-apps-tab__panel"
        :connection-id="connectionId"
        :initial-app-id="tab.yarnAppFilterId"
    />
  </div>
</template>

<style scoped>
.yarn-apps-tab {
  display: flex;
  flex-direction: column;
  height: 100%;
  min-height: 0;
  background: var(--dw-bg-editor);
}

.yarn-apps-tab__head {
  display: flex;
  align-items: center;
  gap: 12px;
  min-height: 56px;
  padding: 11px 16px;
  border-bottom: 1px solid var(--dw-border);
  background: var(--dw-bg-panel);
}

.yarn-apps-tab__title {
  flex: 1;
  min-width: 0;
}

.yarn-apps-tab__title h2 {
  margin: 0;
  font-size: 15px;
  font-weight: 600;
}

.yarn-apps-tab__title p {
  margin: 4px 0 0;
  font-size: 12px;
  color: var(--dw-text-muted);
}

.yarn-apps-tab__refresh {
  padding: 6px 12px;
  border: 1px solid var(--dw-border);
  border-radius: 6px;
  background: var(--dw-bg-input);
  cursor: pointer;
}

.yarn-apps-tab__panel {
  flex: 1;
  min-height: 0;
  padding: 12px 16px;
}
</style>
