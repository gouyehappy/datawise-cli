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
  <div class="yarn-apps-tab dw-workbench-page">
    <header class="dw-workbench-page__head">
      <div class="dw-workbench-page__title">
        <h2>{{ t('explorer.yarnApps.title') }}</h2>
        <p>{{ connectionLabel }}</p>
      </div>
      <div class="dw-workbench-page__actions">
        <button class="dw-text-btn" type="button" @click="refresh">
          {{ t('explorer.yarnApps.refresh') }}
        </button>
      </div>
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
  min-width: 0;
}

.yarn-apps-tab__panel {
  flex: 1;
  min-height: 0;
  padding: var(--dw-wb-content-pad-y) var(--dw-wb-content-pad-x);
}
</style>
