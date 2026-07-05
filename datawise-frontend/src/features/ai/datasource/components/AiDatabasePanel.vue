<script setup lang="ts">
import {ref} from 'vue'
import {useI18n} from 'vue-i18n'
import {SearchInput, SidePanel} from '@/core/components'
import AiDataSourceTree from '@/features/ai/datasource/components/AiDataSourceTree.vue'
import AiTargetSchemaPreview from '@/features/ai/datasource/components/AiTargetSchemaPreview.vue'
import type {AiDatabaseTarget} from '@/features/ai/shared/utils/database-targets'
import {useAiDataSourceTree} from '@/features/ai/datasource/composables/useAiDataSourceTree'

const props = withDefaults(
    defineProps<{
      border?: 'left' | 'right' | 'none'
      embedded?: boolean
      selectedTargets?: AiDatabaseTarget[]
    }>(),
    {border: 'left', embedded: false, selectedTargets: () => []},
)

const selectedIds = defineModel<string[]>('selectedIds', {required: true})

const {t} = useI18n()
const search = ref('')

const {allVisibleSelected, selectAllVisible, clearVisible} = useAiDataSourceTree({
  selectedIds,
  search,
})

function toggleAllVisible() {
  if (allVisibleSelected.value) clearVisible()
  else selectAllVisible()
}
</script>

<template>
  <SidePanel
      class="ai-datasource-panel"
      :title="embedded ? '' : t('ai.databasePanel.title')"
      :subtitle="embedded ? undefined : t('ai.databasePanel.subtitle')"
      :border="props.border"
  >
    <template v-if="!embedded" #badge>
      <span v-if="selectedIds.length" class="dw-badge">{{ selectedIds.length }}</span>
    </template>

    <template #toolbar>
      <SearchInput
          v-model="search"
          class="ai-datasource-panel__search"
          :placeholder="t('ai.databasePanel.search')"
      />
      <div class="dw-side-panel__toolbar-actions ai-datasource-panel__actions">
        <button class="dw-link-btn ai-datasource-panel__link" type="button" @click="toggleAllVisible">
          {{ allVisibleSelected ? t('ai.databasePanel.clearVisible') : t('ai.databasePanel.selectVisible') }}
        </button>
        <button
            v-if="selectedIds.length"
            class="dw-link-btn ai-datasource-panel__link"
            type="button"
            @click="selectedIds = []"
        >
          {{ t('ai.databasePanel.clearAll') }}
        </button>
      </div>
    </template>

    <AiDataSourceTree v-model:selected-ids="selectedIds" v-model:search="search"/>
    <AiTargetSchemaPreview v-if="props.selectedTargets.length" :targets="props.selectedTargets"/>
  </SidePanel>
</template>

<style scoped>
.ai-datasource-panel :deep(.dw-side-panel__body) {
  display: flex;
  flex-direction: column;
  min-height: 0;
  overflow: auto;
}

.ai-datasource-panel :deep(.dw-side-panel__toolbar) {
  padding: 8px 10px;
}

.ai-datasource-panel__search :deep(input) {
  min-height: 28px;
  padding-top: 4px;
  padding-bottom: 4px;
  font-size: 12px;
}

.ai-datasource-panel__actions {
  margin-top: 6px;
  gap: 6px;
}

.ai-datasource-panel__link {
  font-size: 11px;
}
</style>
