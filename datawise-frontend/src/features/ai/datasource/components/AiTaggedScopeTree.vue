<script setup lang="ts">
import {computed} from 'vue'
import {useI18n} from 'vue-i18n'
import DataSourceTree from '@/features/explorer/components/DataSourceTree.vue'
import {useAiTaggedScopeTree} from '@/features/ai/datasource/composables/useAiTaggedScopeTree'
import {useAiTaggedScopeContext} from '@/features/ai/datasource/composables/ai-tagged-scope.context'

const selectedIds = defineModel<string[]>('selectedIds', {required: true})
const search = defineModel<string>('search', {required: true})

const {t} = useI18n()
const {groups, loading, error, reload, filterGroups} = useAiTaggedScopeContext()

const visibleGroups = computed(() => filterGroups(search.value))

const {
    flatNodes,
    allVisibleSelected,
    toggleExpand,
    isCheckable,
    isChecked,
    toggleCheck,
    selectAllVisible,
    clearVisible,
} = useAiTaggedScopeTree(visibleGroups, search, selectedIds)

const emptyText = computed(() => {
    if (!groups.value.length) return t('ai.databasePanel.empty')
    if (search.value.trim()) return t('ai.databasePanel.noMatch')
    return t('ai.databasePanel.empty')
})

defineExpose({
    allVisibleSelected,
    selectAllVisible,
    clearVisible,
    reload,
})
</script>

<template>
  <div class="ai-tagged-scope-tree">
    <div v-if="loading" class="ai-tagged-scope-tree__state">
      <span class="ai-tagged-scope-tree__spinner" aria-hidden="true"/>
      {{ t('ai.databasePanel.loading') }}
    </div>
    <p v-else-if="error" class="ai-tagged-scope-tree__state is-error">{{ error }}</p>
    <DataSourceTree
        v-else
        compact
        selectable
        :show-table-comment="false"
        :show-column-comment="false"
        :flat-nodes="flatNodes"
        :empty-text="emptyText"
        :is-checkable="isCheckable"
        :is-checked="isChecked"
        @toggle-expand="toggleExpand"
        @toggle-check="toggleCheck"
    />
  </div>
</template>

<style scoped>
.ai-tagged-scope-tree {
  display: flex;
  flex-direction: column;
  flex: 1;
  min-height: 0;
}

.ai-tagged-scope-tree :deep(.datasource-tree) {
  flex: 1;
  min-height: 0;
  padding: 2px 0 6px;
}

.ai-tagged-scope-tree__state {
  margin: 0;
  padding: 20px 14px;
  text-align: center;
  font-size: 12px;
  line-height: 1.55;
  color: var(--dw-text-muted);
}

.ai-tagged-scope-tree__state.is-error {
  color: var(--dw-danger);
}

.ai-tagged-scope-tree__spinner {
  display: inline-block;
  width: 14px;
  height: 14px;
  margin-right: 6px;
  border: 2px solid color-mix(in srgb, var(--dw-primary) 24%, transparent);
  border-top-color: var(--dw-primary);
  border-radius: 50%;
  animation: ai-tagged-scope-tree-spin 0.8s linear infinite;
  vertical-align: -2px;
}

@keyframes ai-tagged-scope-tree-spin {
  to { transform: rotate(360deg); }
}
</style>
