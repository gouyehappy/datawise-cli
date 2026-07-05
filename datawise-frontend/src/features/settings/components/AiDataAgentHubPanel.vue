<script setup lang="ts">
import {computed, ref, watch} from 'vue'
import {useI18n} from 'vue-i18n'
import {useLayoutStore} from '@/features/layout/stores/layout'
import DataAgentSettingsPanel from '@/features/settings/components/DataAgentSettingsPanel.vue'
import AiKnowledgeSettingsPanel from '@/features/settings/components/AiKnowledgeSettingsPanel.vue'

type HubTab = 'pipeline' | 'glossary' | 'rag'

const {t} = useI18n()
const layout = useLayoutStore()
const activeTab = ref<HubTab>('pipeline')

const tabs = computed(() => [
    {id: 'pipeline' as const, label: t('settings.dataAgent.tabs.pipeline')},
    {id: 'glossary' as const, label: t('settings.dataAgent.tabs.glossary')},
    {id: 'rag' as const, label: t('settings.dataAgent.tabs.rag')},
])

function syncTabFromSection(section: string) {
    if (section === 'knowledge') {
        activeTab.value = 'glossary'
    }
}

watch(() => layout.settingsSection, syncTabFromSection, {immediate: true})

function selectTab(tab: HubTab) {
    activeTab.value = tab
    if (layout.settingsSection === 'knowledge') {
        layout.setSettingsSection('dataAgent')
    }
}
</script>

<template>
  <div class="data-agent-hub">
    <header class="panel-head data-agent-hub__head">
      <div class="panel-head__copy">
        <h2>{{ t('settings.dataAgent.hubTitle') }}</h2>
        <p>{{ t('settings.dataAgent.hubSubtitle') }}</p>
      </div>
    </header>

    <nav class="ai-filter-tabs data-agent-hub__tabs" :aria-label="t('settings.dataAgent.hubTitle')">
      <button
          v-for="tab in tabs"
          :key="tab.id"
          class="ai-filter-tabs__btn"
          :class="{'is-active': activeTab === tab.id}"
          type="button"
          @click="selectTab(tab.id)"
      >
        {{ tab.label }}
      </button>
    </nav>

    <div class="data-agent-hub__body">
      <DataAgentSettingsPanel v-if="activeTab === 'pipeline'" embedded/>
      <AiKnowledgeSettingsPanel v-else-if="activeTab === 'glossary'" view="glossary" embedded/>
      <AiKnowledgeSettingsPanel v-else view="rag" embedded/>
    </div>
  </div>
</template>
