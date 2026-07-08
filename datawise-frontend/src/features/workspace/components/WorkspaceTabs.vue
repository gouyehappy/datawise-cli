<script setup lang="ts">
import {computed, ref, watch} from 'vue'
import {useI18n} from 'vue-i18n'
import {ContextMenuHost} from '@/core/context-menu'
import TabAddButton from '@/core/components/TabAddButton.vue'
import TabBar from '@/core/components/TabBar.vue'
import TabItem from '@/core/components/TabItem.vue'
import {UnsavedChangesDialog, PromptDialog} from '@/core/components'
import {QueryResultPane, WorkspaceTabIcon} from '@/features/workspace/components'
import {useClosableTabMenu} from '@/core/composables/useClosableTabMenu'
import {getWorkspaceTabMenu} from '@/features/workspace/constants/tab-context-menu'
import {useLayoutStore} from '@/features/layout/stores/layout'
import {useExplorerStore} from '@/features/explorer/stores/explorer'
import {useWorkspaceStore} from '@/features/workspace/stores/workspace'
import {useAuthStore} from '@/features/auth/stores/auth-store'
import {parseConsoleTabTitle, sqlFileNameFromTabLabel} from '@/features/workspace/services/console-tab-title'
import {isValidViewModelBaseName, stripViewModelDisplayName} from '@/features/explorer/services/view-model-naming'
import {
    buildDefaultMigrationFileName,
    normalizeMigrationFileName,
    sanitizeMigrationSlug,
} from '@/features/workspace/services/migration-file-name.service'
import {isCatalogSchemaDbType} from '@/features/explorer/services/explorer-lazy-load'
import {isWorkspaceTabProduction} from '@/features/workspace/services/workspace-production-banner.service'
import {openGeneratedTableCode} from '@/features/workspace/services/table-codegen.actions'
import type {TableCodeTemplate} from '@/features/workspace/services/table-codegen.types'
import FakeDataDialog from '@/features/workspace/components/FakeDataDialog.vue'
import {useFakeDataDialog} from '@/features/workspace/composables/useFakeDataDialog'
import {usePluginStore} from '@/features/plugin/stores/plugin-store'
import type {WorkspaceTab} from '@/core/types'

const {t} = useI18n()
const workspace = useWorkspaceStore()
const layout = useLayoutStore()
const explorer = useExplorerStore()
const auth = useAuthStore()
const pluginStore = usePluginStore()
const tabBarRef = ref<InstanceType<typeof TabBar>>()
const renameTabId = ref<string | null>(null)
const unsavedDialogOpen = ref(false)
const unsavedDialogTitle = ref('')
const unsavedDialogMessage = ref('')
const migrationDialogOpen = ref(false)
const migrationDialogDefault = ref('')
const migrationTabId = ref<string | null>(null)

const fakeData = useFakeDataDialog(async (target) => {
  workspace.bumpTableDataRefresh(target.id)
})
const {
  open: fakeDataDialogOpen,
  loading: fakeDataLoading,
  executing: fakeDataExecuting,
  tab: fakeDataTab,
  properties: fakeDataProperties,
  canExecute: fakeDataCanExecute,
  executeDisabledHint: fakeDataExecuteHint,
  openForTable,
  execute: onFakeDataExecute,
  exportSql: onFakeDataExport,
} = fakeData

watch(
    () => workspace.fakeDataDialogRequest?.nonce,
    () => {
      const request = workspace.fakeDataDialogRequest
      if (!request) return
      const tab = workspace.tabs.find((item) => item.id === request.tabId)
      if (tab) void openForTable(tab)
    },
)

let unsavedDialogResolver: ((action: 'save' | 'discard' | 'cancel') => void) | null = null

function promptUnsavedClose(dirtyTabIds: string[]): Promise<'save' | 'discard' | 'cancel'> {
  const dirtyTabs = dirtyTabIds
      .map((id) => workspace.tabs.find((tab) => tab.id === id))
      .filter((tab): tab is NonNullable<typeof tab> => !!tab)

  unsavedDialogTitle.value = t('workspace.unsavedTitle')
  unsavedDialogMessage.value =
      dirtyTabs.length === 1
          ? t('workspace.unsavedMessageSingle', {name: dirtyTabs[0].title})
          : t('workspace.unsavedMessageMultiple', {count: dirtyTabs.length})
  unsavedDialogOpen.value = true

  return new Promise((resolve) => {
    unsavedDialogResolver = resolve
  })
}

function resolveUnsavedDialog(action: 'save' | 'discard' | 'cancel') {
  unsavedDialogOpen.value = false
  unsavedDialogResolver?.(action)
  unsavedDialogResolver = null
}

async function requestCloseTabs(tabIds: string[]) {
  const closableIds = tabIds.filter((id) => workspace.tabs.find((tab) => tab.id === id)?.closable)
  if (!closableIds.length) return

  const dirtyIds = closableIds.filter((id) => workspace.isTabDirty(id))
  if (dirtyIds.length) {
    const action = await promptUnsavedClose(dirtyIds)
    if (action === 'cancel') return
    if (action === 'save') {
      for (const id of dirtyIds) {
        const ok = await workspace.saveConsoleTab(id)
        if (!ok) {
          layout.showToast(t('console.saveFailed'))
          return
        }
      }
    }
  }

  for (const id of closableIds) {
    workspace.closeTab(id)
  }
}

async function copyTabTitle(tabId: string) {
  const title = workspace.getTabTitle(tabId)
  if (!title) return
  try {
    await navigator.clipboard.writeText(title)
    layout.showToast(t('workspace.tabTitleCopied', {name: title}))
  } catch {
    layout.showToast(t('workspace.tabCopyFailed'))
  }
}

function isConsoleTabRenamable(tab: WorkspaceTab) {
  return tab.type === 'console' && tab.closable
}

function isViewModelEditorTabRenamable(tab: WorkspaceTab) {
  return tab.type === 'view_model_editor' && tab.closable
}

function isTabRenamable(tab: WorkspaceTab) {
  return isConsoleTabRenamable(tab) || isViewModelEditorTabRenamable(tab)
}

function migrationSlugFromTab(tab: WorkspaceTab): string {
  const parsed = parseConsoleTabTitle(tab.title)
  if (/^Script-\d+$/i.test(parsed.editableLabel.trim())) {
    return 'migration'
  }
  return sanitizeMigrationSlug(parsed.editableLabel) || 'migration'
}

function canSaveConsoleTab(tab: WorkspaceTab): boolean {
  if (tab.type !== 'console' || !tab.connectionId) return false
  const connectionNode = explorer.findNode(tab.connectionId)
  const instanceLabel = tab.database?.trim()
  if (!instanceLabel && !isCatalogSchemaDbType(connectionNode?.dbType)) return false
  return true
}

async function saveConsoleTabFromMenu(tabId: string) {
  if (auth.isGuest) {
    layout.showToast(t('auth.guestReadOnlyHint'))
    return
  }
  const tab = workspace.tabs.find((item) => item.id === tabId)
  if (!tab || !canSaveConsoleTab(tab)) {
    layout.showToast(t('console.saveFailed'))
    return
  }
  const ok = await workspace.saveConsoleTab(tabId)
  if (!ok) layout.showToast(t('console.saveFailed'))
}

function openMigrationDialog(tabId: string) {
  if (auth.isGuest) {
    layout.showToast(t('auth.guestReadOnlyHint'))
    return
  }
  const tab = workspace.tabs.find((item) => item.id === tabId)
  if (!tab || !canSaveConsoleTab(tab)) {
    layout.showToast(t('console.saveFailed'))
    return
  }
  migrationTabId.value = tabId
  migrationDialogDefault.value = buildDefaultMigrationFileName(migrationSlugFromTab(tab))
  migrationDialogOpen.value = true
}

async function confirmMigrationFileName(fileName: string) {
  const tabId = migrationTabId.value
  if (!tabId) return
  const normalized = normalizeMigrationFileName(fileName)
  if (!normalized) {
    layout.showToast(t('workspace.tabSaveMigrationInvalid'))
    return
  }
  const ok = await workspace.saveConsoleTabAsMigration(tabId, normalized)
  if (!ok) {
    layout.showToast(t('console.saveFailed'))
    return
  }
  migrationTabId.value = null
}

function runTableCodegen(tabId: string, template: TableCodeTemplate) {
  const tab = workspace.tabs.find((item) => item.id === tabId)
  if (!tab) return
  void openGeneratedTableCode({
    tab,
    template,
    tree: explorer.tree,
    openConsole: (options) => workspace.openConsole(options),
    showToast: (message) => layout.showToast(message),
    t,
  })
}

async function openFakeDataDialog(tabId: string) {
  const tab = workspace.tabs.find((item) => item.id === tabId)
  if (!tab) return
  await openForTable(tab)
}

const {
  menuVisible,
  menuPos,
  menuItems,
  closeMenu,
  onMenuSelect,
  onTabContextMenu,
} = useClosableTabMenu<string>(
    (tabId) => {
      const tab = workspace.tabs.find((item) => item.id === tabId)
      const index = workspace.tabs.findIndex((item) => item.id === tabId)
      return getWorkspaceTabMenu(t, {
        canCloseLeft: workspace.tabs.slice(0, index).some((item) => item.closable),
        canCloseRight: workspace.tabs.slice(index + 1).some((item) => item.closable),
        canRename: tab ? isTabRenamable(tab) : false,
        showConsoleSave: tab?.type === 'console',
        showTableCodegen: tab?.type === 'table'
            && !!tab.tableName?.trim()
            && pluginStore.isEnabled('p-table-codegen'),
        showTableFakeData: tab?.type === 'table'
            && !!tab.tableName?.trim()
            && pluginStore.isEnabled('p-fake-data'),
      })
    },
    () => ({
      close: (tabId) => void requestCloseTabs([tabId]),
      closeOthers: (tabId) => {
        const others = workspace.tabs
            .filter((tab) => tab.id !== tabId && tab.closable)
            .map((tab) => tab.id)
        void requestCloseTabs(others)
      },
      closeAll: () => {
        void requestCloseTabs(workspace.tabs.filter((tab) => tab.closable).map((tab) => tab.id))
      },
      closeLeft: (tabId) => {
        const idx = workspace.tabs.findIndex((tab) => tab.id === tabId)
        if (idx <= 0) return
        const left = workspace.tabs.slice(0, idx).filter((tab) => tab.closable).map((tab) => tab.id)
        void requestCloseTabs(left)
      },
      closeRight: (tabId) => {
        const idx = workspace.tabs.findIndex((tab) => tab.id === tabId)
        if (idx < 0 || idx >= workspace.tabs.length - 1) return
        const right = workspace.tabs.slice(idx + 1).filter((tab) => tab.closable).map((tab) => tab.id)
        void requestCloseTabs(right)
      },
      rename: (tabId) => {
        const tab = workspace.tabs.find((item) => item.id === tabId)
        if (!tab || !isTabRenamable(tab)) return
        workspace.activateTab(tabId)
        renameTabId.value = tabId
        tabBarRef.value?.ensureActiveTabVisible()
      },
      copyTitle: (tabId) => void copyTabTitle(tabId),
      save: (tabId) => void saveConsoleTabFromMenu(tabId),
      saveMigration: (tabId) => openMigrationDialog(tabId),
      'codegen-jpa': (tabId) => runTableCodegen(tabId, 'jpa'),
      'codegen-mybatis': (tabId) => runTableCodegen(tabId, 'mybatis'),
      'codegen-typescript': (tabId) => runTableCodegen(tabId, 'typescript'),
      'generate-fake-data': (tabId) => void openFakeDataDialog(tabId),
    }),
)

const tabsSignature = computed(() => workspace.tabs.map((tab) => tab.id).join(','))

const overflowItems = computed(() =>
    workspace.tabs.map((tab) => ({id: tab.id, label: tab.title})),
)

function handleTabSelect(tabId: string) {
  workspace.activateTab(tabId)
  tabBarRef.value?.ensureActiveTabVisible()
}

function consoleRenameSuffix(tab: WorkspaceTab) {
  if (tab.type !== 'console') return undefined
  return parseConsoleTabTitle(tab.title).editableLabel
}

function consoleRenameSuffixOnly(tab: WorkspaceTab) {
  if (tab.type !== 'console') return false
  return parseConsoleTabTitle(tab.title).hasHostPrefix
}

async function onTabRename(tabId: string, name: string) {
  const tab = workspace.tabs.find((item) => item.id === tabId)
  if (!tab) {
    renameTabId.value = null
    return
  }

  if (tab.type === 'view_model_editor') {
    const trimmed = stripViewModelDisplayName(name)
    if (!trimmed || !isValidViewModelBaseName(trimmed)) {
      layout.showToast(t('viewModel.invalidName'))
      renameTabId.value = null
      return
    }
    const ok = await workspace.renameViewModelTab(tabId, trimmed)
    if (!ok) {
      layout.showToast(t('viewModel.renameFailed'))
    }
    renameTabId.value = null
    return
  }

  if (tab.type !== 'console') {
    renameTabId.value = null
    return
  }

  const parsed = parseConsoleTabTitle(name)
  const label = (parsed.hasHostPrefix ? parsed.editableLabel : name).trim()
  if (!sqlFileNameFromTabLabel(label)) {
    layout.showToast(t('explorer.invalidSqlFileName'))
    renameTabId.value = null
    return
  }

  const connectionId = tab.connectionId
  const database = tab.database
  const ok = await workspace.renameConsoleTab(tabId, name)
  if (!ok) {
    layout.showToast(t('explorer.renameSqlFileFailed'))
  } else if (connectionId && database) {
    try {
      await explorer.reloadWorkspacesFolder(connectionId, database)
    } catch (error) {
      console.error('[reloadWorkspacesFolder]', error)
    }
  }
  renameTabId.value = null
}

function cancelRename() {
  renameTabId.value = null
}

function isTabProduction(tab: WorkspaceTab) {
  return isWorkspaceTabProduction(tab, explorer.tree, explorer.findNode)
}
</script>

<template>
  <TabBar
      ref="tabBarRef"
      :active-tab-id="workspace.activeTabId"
      :tabs-signature="tabsSignature"
      :overflow-items="overflowItems"
      :overflow-title="t('workspace.allTabs')"
      :overflow-search-placeholder="t('workspace.searchTabs')"
      @select="handleTabSelect"
  >
    <template #default="{ bindTabRef }">
      <TabItem
          v-for="tab in workspace.tabs"
          :key="tab.id"
          :tab-id="tab.id"
          :title="tab.title"
          :active="workspace.activeTabId === tab.id"
          :closable="tab.closable"
          :renamable="isTabRenamable(tab)"
          :renaming="renameTabId === tab.id"
          :dirty="(tab.type === 'console' || tab.type === 'view_model_editor') && workspace.isTabDirty(tab.id)"
          :rename-suffix="consoleRenameSuffix(tab)"
          :rename-suffix-only="consoleRenameSuffixOnly(tab)"
          :set-ref="bindTabRef(tab.id)"
          @select="handleTabSelect(tab.id)"
          @close="requestCloseTabs([tab.id])"
          @contextmenu="onTabContextMenu($event, tab.id, tab.closable)"
          @request-rename="isTabRenamable(tab) && (renameTabId = tab.id)"
          @rename="onTabRename(tab.id, $event)"
          @cancel-rename="cancelRename"
      >
        <template #leading>
          <WorkspaceTabIcon :type="tab.type"/>
          <span
              v-if="isTabProduction(tab)"
              class="tab-prod-dot"
              :title="t('connection.envOptions.prod')"
              aria-hidden="true"
          />
        </template>
      </TabItem>
    </template>

    <template #actions>
      <TabAddButton :title="t('workspace.newConsole')" @click="workspace.openConsole()"/>
    </template>
  </TabBar>

  <ContextMenuHost
      :visible="menuVisible"
      :items="menuItems"
      :x="menuPos.x"
      :y="menuPos.y"
      @select="onMenuSelect"
      @close="closeMenu"
  />

  <UnsavedChangesDialog
      v-model:open="unsavedDialogOpen"
      :title="unsavedDialogTitle"
      :message="unsavedDialogMessage"
      @save="resolveUnsavedDialog('save')"
      @discard="resolveUnsavedDialog('discard')"
      @cancel="resolveUnsavedDialog('cancel')"
  />

  <PromptDialog
      v-model:open="migrationDialogOpen"
      :title="t('workspace.tabSaveMigrationTitle')"
      :subtitle="t('workspace.tabSaveMigrationHint')"
      :label="t('workspace.tabSaveMigrationLabel')"
      :default-value="migrationDialogDefault"
      :placeholder="t('workspace.tabSaveMigrationPlaceholder')"
      :required-message="t('workspace.tabSaveMigrationRequired')"
      :confirm-label="t('common.save')"
      @confirm="confirmMigrationFileName"
  />

  <FakeDataDialog
      v-model:open="fakeDataDialogOpen"
      :loading="fakeDataLoading"
      :executing="fakeDataExecuting"
      :table-name="fakeDataTab?.tableName"
      :properties="fakeDataProperties"
      :can-execute="fakeDataCanExecute"
      :execute-disabled-hint="fakeDataExecuteHint"
      @execute="onFakeDataExecute"
      @export="onFakeDataExport"
  />
</template>
