<script setup lang="ts">
import {onMounted, watch} from 'vue'
import {QueryResultPane} from '@/features/workspace/components'
import type {WorkspaceTab} from '@/core/types'
import {useViewModelDataView} from '@/features/workspace/composables/useViewModelDataView'
import {useExplorerStore} from '@/features/explorer/stores/explorer'
import {isProductionEnvironment} from '@/features/connection/services/connection-environment.service'

const props = defineProps<{ tab: WorkspaceTab }>()
const explorer = useExplorerStore()

const {
  columns,
  rows,
  loading,
  cursorLoading,
  hasMore,
  errorMessage,
  refresh,
  loadMore,
  executeQuery,
} = useViewModelDataView(props.tab)

const exportSuggestMask = () => {
  const connId = props.tab.connectionId
  if (!connId) return false
  const node = explorer.findNode(connId)
  return isProductionEnvironment(node?.env, node?.envCustom)
}

onMounted(() => {
  void executeQuery(false)
})

watch(
    () => [props.tab.viewModelSql, props.tab.connectionId, props.tab.database] as const,
    () => {
      void executeQuery(false)
    },
)
</script>

<template>
  <div class="view-model-data">
    <p v-if="errorMessage" class="view-model-data__error">{{ errorMessage }}</p>
    <QueryResultPane
        :columns="columns"
        :rows="rows"
        :total="rows.length"
        :result-label="tab.viewModelName ?? tab.title"
        :export-name="`${tab.viewModelName ?? 'view-model'}.csv`"
        :export-suggest-mask="exportSuggestMask()"
        :result-has-more="hasMore"
        :cursor-loading="cursorLoading || loading"
        @refresh="refresh"
        @load-more="loadMore"
    />
  </div>
</template>

<style scoped>
.view-model-data {
  display: flex;
  flex-direction: column;
  min-height: 0;
  height: 100%;
}

.view-model-data__error {
  margin: 0;
  padding: 8px 12px;
  color: var(--dw-danger);
  font-size: 12px;
}
</style>
