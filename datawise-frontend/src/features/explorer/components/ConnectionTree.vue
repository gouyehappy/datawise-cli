<!--
  连接树：Explorer 单选模式（无复选框）
-->
<script setup lang="ts">
import {nextTick, onMounted, onUnmounted, ref} from 'vue'
import {useI18n} from 'vue-i18n'
import {ContextMenuHost} from '@/core/context-menu'
import {PromptDialog, AppModal, DwButton} from '@/core/components'
import {
  clearExplorerNodeScroll,
  registerExplorerNodeScroll,
} from '@/core/shortcuts/action-registry'
import DataSourceTree from '@/features/explorer/components/DataSourceTree.vue'
import RecentSqlPickerDialog from '@/features/explorer/components/RecentSqlPickerDialog.vue'
import SqlExportWizardDialog from '@/features/explorer/components/SqlExportWizardDialog.vue'
import {useConnectionTree} from '@/features/explorer/composables/useConnectionTree'
import {canMoveConnectionToGroup} from '@/features/explorer/services/explorer-move-connection.service'
import {useTeamExplorerHighlight} from '@/features/team/composables/useTeamExplorerHighlight'
import {
  EXPLORER_TREE_ROW_HEIGHT,
  resolveLastFlatNodeIndex,
} from '@/features/explorer/composables/useTreeVirtualWindow'

const {t} = useI18n()
const {highlightNodeIds} = useTeamExplorerHighlight()
const {
  explorer,
  flatNodes,
  menuVisible,
  menuPos,
  menuItems,
  showRenameDialog,
  showRenameSqlDialog,
  showDeleteSqlDialog,
  showSubgroupDialog,
  showRecentSqlDialog,
  recentSqlContext,
  renameDefaultName,
  renameSqlDefaultName,
  deleteSqlMessage,
  subgroupDefaultName,
  onSelect,
  onOpen,
  onContextMenu,
  closeMenu,
  onMenuSelect,
  confirmRenameGroup,
  confirmRenameSqlFile,
  confirmDeleteSqlFile,
  confirmCreateSubgroup,
  performMoveConnection,
  confirmTableAction,
  showTableActionDialog,
  pendingTableAction,
  showSqlExportWizard,
  sqlExportWizardContext,
  sqlExportWizardExporting,
  sqlExportWizardMaxRowsDefault,
  confirmSqlExportWizardExport,
  showRenameViewModelDialog,
  renameViewModelDefaultName,
  showDeleteViewModelDialog,
  deleteViewModelMessage,
  showMigrateViewModelDialog,
  migrateViewModelTargetTable,
  confirmRenameViewModel,
  confirmDeleteViewModel,
  confirmMigrateViewModel,
} = useConnectionTree()

const dataSourceTreeRef = ref<InstanceType<typeof DataSourceTree> | null>(null)

function scrollNodeIntoView(nodeId: string) {
  void nextTick().then(() => {
    requestAnimationFrame(() => {
      const container = document.querySelector('.explorer-body') as HTMLElement | null
      const el = container?.querySelector(`[data-tree-node-id="${CSS.escape(nodeId)}"]`)
      if (el) {
        el.scrollIntoView({block: 'nearest', behavior: 'smooth'})
        return
      }
      const index = resolveLastFlatNodeIndex(flatNodes.value, nodeId)
      if (index < 0) return
      dataSourceTreeRef.value?.scrollToFlatIndex(index, 'smooth')
      requestAnimationFrame(() => {
        const retry = container?.querySelector(`[data-tree-node-id="${CSS.escape(nodeId)}"]`)
        if (retry) {
          retry.scrollIntoView({block: 'nearest', behavior: 'smooth'})
          return
        }
        container?.scrollTo({
          top: Math.max(0, index * EXPLORER_TREE_ROW_HEIGHT - container.clientHeight / 3),
          behavior: 'smooth',
        })
      })
    })
  })
}

onMounted(() => {
  registerExplorerNodeScroll(scrollNodeIntoView)
})

onUnmounted(() => {
  clearExplorerNodeScroll()
})
</script>

<template>
  <DataSourceTree
      ref="dataSourceTreeRef"
      :flat-nodes="flatNodes"
      :empty-text="t('explorer.treeEmpty')"
      :selected-node-id="explorer.selectedNodeId"
      :flash-node-id="explorer.flashNodeId"
      :highlight-node-ids="highlightNodeIds"
      :loading-node-ids="explorer.loadingNodeIds"
      :pinned-node-ids="explorer.pinnedNodeIds"
      :connection-health="explorer.connectionDisplayHealthById"
      :show-column-comment="explorer.showColumnComment"
      :show-table-comment="explorer.showTableComment"
      connection-drag-enabled
      :can-move-connection-to-group="(connectionId, groupId) => canMoveConnectionToGroup(explorer.tree, connectionId, groupId)"
      @select="onSelect"
      @open="onOpen"
      @contextmenu="onContextMenu"
      @toggle-expand="explorer.toggleExpand"
      @move-connection="performMoveConnection"
  />

  <ContextMenuHost
      :visible="menuVisible"
      :items="menuItems"
      :x="menuPos.x"
      :y="menuPos.y"
      @select="onMenuSelect"
      @close="closeMenu"
  />

  <PromptDialog
      v-model:open="showRenameDialog"
      :title="t('explorer.context.renameGroup')"
      :label="t('explorer.folderNamePrompt')"
      :default-value="renameDefaultName"
      :placeholder="t('explorer.folderNameDefault')"
      :required-message="t('explorer.folderNameRequired')"
      :confirm-label="t('common.confirm')"
      @confirm="confirmRenameGroup"
  />

  <RecentSqlPickerDialog
      v-model:open="showRecentSqlDialog"
      :context="recentSqlContext"
  />

  <SqlExportWizardDialog
      v-model:open="showSqlExportWizard"
      :context="sqlExportWizardContext"
      :max-rows-default="sqlExportWizardMaxRowsDefault"
      :exporting="sqlExportWizardExporting"
      @export="confirmSqlExportWizardExport"
  />

  <PromptDialog
      v-model:open="showRenameSqlDialog"
      :title="t('explorer.context.renameSqlFile')"
      :label="t('explorer.sqlFileNamePrompt')"
      :default-value="renameSqlDefaultName"
      :placeholder="t('explorer.sqlFileNameDefault')"
      :required-message="t('explorer.sqlFileNameRequired')"
      :confirm-label="t('common.confirm')"
      @confirm="confirmRenameSqlFile"
  />

  <PromptDialog
      v-model:open="showSubgroupDialog"
      :title="t('explorer.context.newSubgroup')"
      :label="t('explorer.folderNamePrompt')"
      :default-value="subgroupDefaultName"
      :placeholder="t('explorer.folderNameDefault')"
      :required-message="t('explorer.folderNameRequired')"
      :confirm-label="t('common.confirm')"
      @confirm="confirmCreateSubgroup"
  />

  <AppModal
      :open="showDeleteSqlDialog"
      :title="t('explorer.deleteSqlFileTitle')"
      width="420px"
      @close="showDeleteSqlDialog = false"
  >
    <p class="modal-message">{{ deleteSqlMessage }}</p>
    <template #footer>
      <DwButton variant="ghost" @click="showDeleteSqlDialog = false">
        {{ t('common.cancel') }}
      </DwButton>
      <DwButton
          variant="danger"
          @click="showDeleteSqlDialog = false; confirmDeleteSqlFile()"
      >
        {{ t('explorer.context.deleteSqlFile') }}
      </DwButton>
    </template>
  </AppModal>

  <AppModal
      :open="showTableActionDialog"
      :title="pendingTableAction?.type === 'delete' ? t('explorer.deleteTableTitle') : t('explorer.truncateTableTitle')"
      width="420px"
      @close="showTableActionDialog = false"
  >
    <p class="modal-message">{{ pendingTableAction?.message }}</p>
    <template #footer>
      <DwButton variant="ghost" @click="showTableActionDialog = false">
        {{ t('common.cancel') }}
      </DwButton>
      <DwButton variant="danger" @click="confirmTableAction()">
        {{
          pendingTableAction?.type === 'delete'
              ? t('explorer.context.deleteTable')
              : t('explorer.context.truncate')
        }}
      </DwButton>
    </template>
  </AppModal>

  <PromptDialog
      v-model:open="showRenameViewModelDialog"
      :title="t('explorer.context.renameViewModel')"
      :label="t('viewModel.nameLabel')"
      :default-value="renameViewModelDefaultName"
      :placeholder="t('viewModel.namePlaceholder')"
      :required-message="t('viewModel.nameRequired')"
      :confirm-label="t('common.confirm')"
      @confirm="confirmRenameViewModel"
  />

  <AppModal
      :open="showDeleteViewModelDialog"
      :title="t('explorer.context.deleteViewModel')"
      width="420px"
      @close="showDeleteViewModelDialog = false"
  >
    <p class="modal-message">{{ deleteViewModelMessage }}</p>
    <template #footer>
      <DwButton variant="ghost" @click="showDeleteViewModelDialog = false">
        {{ t('common.cancel') }}
      </DwButton>
      <DwButton
          variant="danger"
          @click="showDeleteViewModelDialog = false; confirmDeleteViewModel()"
      >
        {{ t('explorer.context.deleteViewModel') }}
      </DwButton>
    </template>
  </AppModal>

  <PromptDialog
      v-model:open="showMigrateViewModelDialog"
      :title="t('viewModel.migrateTitle')"
      :label="t('viewModel.migrateTargetTableLabel')"
      :default-value="migrateViewModelTargetTable"
      :placeholder="t('viewModel.migrateTargetTablePlaceholder')"
      :required-message="t('viewModel.migrateTargetTableRequired')"
      :confirm-label="t('explorer.context.migrateData')"
      @confirm="confirmMigrateViewModel"
  />
</template>
