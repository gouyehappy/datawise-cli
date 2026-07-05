<!-- 连接树上方的工具栏：新建连接、刷新、定位、设置、搜索 -->
<script setup lang="ts">
import {computed, onMounted, onUnmounted, ref} from 'vue'
import {useI18n} from 'vue-i18n'
import {DwIcon} from '@/core/icons'
import IconButton from '@/core/components/IconButton.vue'
import {ContextMenuHost, useContextMenu} from '@/core/context-menu'
import type {ShortcutActionId} from '@/core/shortcuts/types'
import {
  clearExplorerSearchFocus,
  registerExplorerSearchFocus,
} from '@/core/shortcuts/action-registry'
import {shortcutTooltip, formatShortcutLabel} from '@/features/layout/composables/useAppShortcutListener'
import {getExplorerSettingsMenuItems} from '@/features/explorer/constants/explorer-settings-menu'
import {EXPLORER_ICONS} from '@/features/explorer/constants/icons'
import ExplorerAddMenu from './ExplorerAddMenu.vue'
import {PromptDialog} from '@/core/components'
import {
  runExplorerLocate,
  runExplorerRefresh,
  runToggleAllComments,
  runToggleColumnComment,
  runToggleTableComment,
} from '@/features/explorer/services/explorer-toolbar.actions'
import {useExplorerStore} from '@/features/explorer/stores/explorer'
import {useLayoutStore} from '@/features/layout/stores/layout'

const {t} = useI18n()
const explorer = useExplorerStore()
const layout = useLayoutStore()
const icons = EXPLORER_ICONS
/** 工具栏操作图标像素尺寸（原 sm≈12–14px，显式放大以贴近按钮可视区域） */
const TOOLBAR_ICON_SIZE = 28

const menuRef = ref<HTMLElement>()
const settingsRef = ref<HTMLElement>()
const searchInputRef = ref<HTMLInputElement>()
const showMenu = ref(false)
const showFolderDialog = ref(false)
const addMenuPos = ref({x: 0, y: 0})
const settingsMenu = useContextMenu()

const settingsMenuItems = computed(() =>
    getExplorerSettingsMenuItems(
        t,
        {
          showColumnComment: explorer.showColumnComment,
          showTableComment: explorer.showTableComment,
          allCommentsVisible: explorer.allCommentsVisible,
        },
        shortcutLabel,
    ),
)

function toggleMenu() {
  settingsMenu.close()
  if (!showMenu.value && menuRef.value) {
    const rect = menuRef.value.getBoundingClientRect()
    addMenuPos.value = {x: rect.left, y: rect.bottom + 4}
  }
  showMenu.value = !showMenu.value
}

function openFolderDialog() {
  showMenu.value = false
  showFolderDialog.value = true
}

async function confirmCreateFolder(name: string) {
  try {
    await explorer.addRootFolder(name)
    layout.showToast(t('explorer.folderCreated', {name}))
  } catch {
    layout.showToast(t('explorer.createFailed'))
  }
}

function toggleSettings() {
  showMenu.value = false
  if (settingsMenu.visible.value) {
    settingsMenu.close()
    return
  }
  if (settingsRef.value) {
    settingsMenu.openBelow(settingsRef.value, settingsMenuItems.value)
  }
}

function onSettingsMenuSelect(id: string) {
  if (id === 'toggle-column-comment') runToggleColumnComment()
  if (id === 'toggle-table-comment') runToggleTableComment()
  if (id === 'toggle-all-comments') runToggleAllComments()
  settingsMenu.close()
}

async function refreshTree() {
  await runExplorerRefresh()
}

function locateInTree() {
  void runExplorerLocate()
}

function focusSearchInput() {
  searchInputRef.value?.focus()
  searchInputRef.value?.select()
}

function shortcutLabel(actionId: ShortcutActionId): string {
  return formatShortcutLabel(actionId)
}

function onSearchKeydown(e: KeyboardEvent) {
  if (e.key === 'Escape') {
    explorer.searchQuery = ''
    searchInputRef.value?.blur()
  }
}

onMounted(() => {
  registerExplorerSearchFocus(focusSearchInput)
})

onUnmounted(() => {
  clearExplorerSearchFocus()
})
</script>

<template>
  <div class="toolbar">
    <div class="actions dw-btn-group">
      <div ref="menuRef" class="menu-wrap">
        <IconButton :title="t('explorer.newDataSource')" :active="showMenu" @click="toggleMenu">
          <span class="toolbar-glyph">
            <DwIcon :name="icons.add" :size="TOOLBAR_ICON_SIZE" :stroke-width="1.35"/>
          </span>
        </IconButton>

        <ExplorerAddMenu
            v-if="showMenu"
            :x="addMenuPos.x"
            :y="addMenuPos.y"
            @close="showMenu = false"
            @create-folder="openFolderDialog"
        />
      </div>

      <IconButton
          :title="shortcutTooltip(t('explorer.refresh'), 'explorer.refresh')"
          :disabled="explorer.isRefreshing"
          @click="refreshTree"
      >
        <span class="toolbar-glyph" :class="{ 'is-spinning': explorer.isRefreshing }">
          <DwIcon :name="icons.refresh" :size="TOOLBAR_ICON_SIZE" :stroke-width="1.35"/>
        </span>
      </IconButton>

      <IconButton
          :title="shortcutTooltip(t('explorer.locateActiveTab'), 'explorer.locate')"
          @click="locateInTree"
      >
        <span class="toolbar-glyph">
          <DwIcon :name="icons.locate" :size="TOOLBAR_ICON_SIZE" :stroke-width="1.35"/>
        </span>
      </IconButton>

      <div ref="settingsRef" class="menu-wrap">
        <IconButton
            :title="t('explorer.settings')"
            :active="settingsMenu.visible.value"
            @click="toggleSettings"
        >
          <span class="toolbar-glyph">
            <DwIcon :name="icons.settings" :size="TOOLBAR_ICON_SIZE" :stroke-width="1.35"/>
          </span>
        </IconButton>
      </div>
    </div>

    <ContextMenuHost
        :visible="settingsMenu.visible.value"
        :items="settingsMenu.items.value"
        :x="settingsMenu.pos.value.x"
        :y="settingsMenu.pos.value.y"
        @select="onSettingsMenuSelect"
        @close="settingsMenu.close"
    />

    <PromptDialog
        v-model:open="showFolderDialog"
        :title="t('explorer.newFolder')"
        :label="t('explorer.folderNamePrompt')"
        :default-value="t('explorer.folderNameDefault')"
        :placeholder="t('explorer.folderNameDefault')"
        :required-message="t('explorer.folderNameRequired')"
        :confirm-label="t('common.confirm')"
        @confirm="confirmCreateFolder"
    />

    <div class="search-wrap">
      <label class="search" :class="{ 'search--active': explorer.searchQuery.trim().length > 0 }">
        <DwIcon class="search-icon" :name="icons.search" size="sm"/>
        <input
            ref="searchInputRef"
            v-model="explorer.searchQuery"
            :placeholder="t('explorer.searchPlaceholder')"
            @keydown="onSearchKeydown"
        />
        <kbd v-if="shortcutLabel('explorer.search')" class="hint">{{ shortcutLabel('explorer.search') }}</kbd>
      </label>
    </div>
  </div>
</template>

<style scoped>
.toolbar {
  display: flex;
  align-items: center;
  gap: 8px;
  height: var(--dw-toolbar-height);
  padding: 0 10px 0 6px;
  border-bottom: 1px solid var(--dw-border-light);
  min-width: 0;
}

.actions {
  flex-shrink: 0;
}

.menu-wrap {
  position: relative;
  overflow: visible;
}

.toolbar-glyph {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  line-height: 0;
}

.toolbar-glyph .dw-icon-root {
  flex-shrink: 0;
}

.toolbar-glyph.is-spinning {
  animation: explorer-refresh-spin 0.8s linear infinite;
}

@keyframes explorer-refresh-spin {
  to {
    transform: rotate(360deg);
  }
}

.search-wrap {
  flex: 1 1 0;
  min-width: 0;
  display: flex;
}

.search {
  display: flex;
  align-items: center;
  gap: 6px;
  width: 100%;
  min-width: 0;
  height: var(--dw-btn-height-sm);
  padding: 0 10px;
  border: 1px solid transparent;
  border-radius: 999px;
  background: var(--dw-bg-muted);
  color: var(--dw-text-muted);
  transition: background 0.12s ease, border-color 0.12s ease;
}

.search--active {
  background: var(--dw-primary-softer);
  border-color: var(--dw-primary-ring);
}

.search-icon {
  flex-shrink: 0;
  opacity: 0.85;
}

.search input {
  flex: 1 1 0;
  width: 0;
  min-width: 0;
  border: none;
  outline: none;
  background: transparent;
  color: var(--dw-text);
  font-size: 12px;
}

.search input::placeholder {
  color: var(--dw-text-muted);
}

.search:focus-within {
  background: var(--dw-bg);
  border-color: var(--dw-border);
}

.search--active:focus-within {
  border-color: var(--dw-primary-border);
}

.hint {
  flex-shrink: 0;
  padding: 1px 5px;
  border: 1px solid var(--dw-border-light);
  border-radius: 3px;
  background: var(--dw-bg);
  font-family: var(--dw-mono);
  font-size: 10px;
  line-height: 1.35;
  color: var(--dw-text-muted);
}

@container explorer (max-width: 300px) {
  .hint {
    display: none;
  }
}
</style>
