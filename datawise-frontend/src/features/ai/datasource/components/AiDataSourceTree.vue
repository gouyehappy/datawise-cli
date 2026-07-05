<script setup lang="ts">
import {useI18n} from 'vue-i18n'
import DataSourceTree from '@/features/explorer/components/DataSourceTree.vue'
import {useAiDataSourceTree} from '@/features/ai/datasource/composables/useAiDataSourceTree'

const selectedIds = defineModel<string[]>('selectedIds', {required: true})
const search = defineModel<string>('search', {required: true})

const {t} = useI18n()

const {
  explorer,
  flatNodes,
  isChecked,
  isCheckable,
  toggleCheck,
  toggleExpand,
} = useAiDataSourceTree({selectedIds, search})
</script>

<template>
  <DataSourceTree
      selectable
      :flat-nodes="flatNodes"
      :empty-text="search.trim() ? t('ai.databasePanel.noMatch') : t('ai.databasePanel.empty')"
      :show-column-comment="explorer.showColumnComment"
      :show-table-comment="explorer.showTableComment"
      :is-checkable="isCheckable"
      :is-checked="isChecked"
      @toggle-check="toggleCheck"
      @toggle-expand="toggleExpand"
  />
</template>
