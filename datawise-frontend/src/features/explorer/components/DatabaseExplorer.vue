<!--
  左侧「数据库」面板 = 工具栏 + 连接树

  宽度由 explorer.width 控制，MainContent 里的 ResizeHandle 可拖动改变。
-->
<script setup lang="ts">
import {useI18n} from 'vue-i18n'
import {CollapseButton} from '@/core/components'
import {DwIcon} from '@/core/icons'
import ExplorerToolbar from './ExplorerToolbar.vue'
import ConnectionTree from './ConnectionTree.vue'
import ScriptHistoryDrawer from '@/features/explorer/components/ScriptHistoryDrawer.vue'
import TeamSharedConnectionsBar from '@/features/team/components/TeamSharedConnectionsBar.vue'
import IconButton from '@/core/components/IconButton.vue'
import {EXPLORER_ICONS} from '@/features/explorer/constants/icons'
import {runExplorerLocate} from '@/features/explorer/services/explorer-toolbar.actions'
import {useAppConfigStore} from '@/features/layout/stores/app-config-store'
import {useExplorerStore} from '@/features/explorer/stores/explorer'

const {t} = useI18n()
const explorer = useExplorerStore()
const appConfig = useAppConfigStore()
const icons = EXPLORER_ICONS

function locateActiveTab() {
  void runExplorerLocate()
}

function collapseExplorer() {
  appConfig.setShowExplorerPanel(false)
}
</script>

<template>
  <section class="explorer dw-panel-hover-chrome">
    <div class="explorer-top">
      <header class="header">
        <div class="header-title">
          <span class="title-dot" aria-hidden="true"/>
          <span class="title">{{ t('explorer.title') }}</span>
          <span v-if="explorer.connectionCount" class="title-badge">{{ explorer.connectionCount }}</span>
        </div>
        <div class="header-actions dw-btn-group dw-panel-hover-actions">
          <IconButton size="sm" :title="t('explorer.locateActiveTab')" @click="locateActiveTab">
            <DwIcon :name="icons.locate" size="sm"/>
          </IconButton>
          <IconButton size="sm" :title="t('explorer.more')">⋯</IconButton>
          <CollapseButton @click="collapseExplorer"/>
        </div>
      </header>
      <ExplorerToolbar/>
      <TeamSharedConnectionsBar/>
    </div>
    <div class="explorer-body">
      <ConnectionTree/>
    </div>
    <ScriptHistoryDrawer/>
  </section>
</template>

<style scoped>
.explorer {
  container-type: inline-size;
  container-name: explorer;
  display: flex;
  flex-direction: column;
  width: 100%;
  min-width: 0;
  min-height: 0;
  border: 1px solid var(--dw-panel-border);
  border-radius: var(--dw-panel-radius);
  background: var(--dw-bg-panel);
  box-shadow: var(--dw-panel-shadow);
  overflow: hidden;
}

.explorer-top {
  flex-shrink: 0;
  position: relative;
  z-index: 10;
  overflow: visible;
}

.explorer-body {
  flex: 1;
  min-height: 0;
  overflow: auto;
  scrollbar-gutter: stable;
}

.header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  height: 36px;
  padding: 0 10px 0 12px;
  border-bottom: 1px solid var(--dw-border-light);
  background: linear-gradient(180deg, var(--dw-bg) 0%, var(--dw-bg-panel) 100%);
}

.header-title {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
}

.title-dot {
  width: 7px;
  height: 7px;
  border-radius: 999px;
  background: var(--dw-primary);
  box-shadow: 0 0 0 3px var(--dw-primary-soft);
  flex-shrink: 0;
}

.title {
  font-weight: 600;
  font-size: 13px;
  letter-spacing: 0.01em;
}

.title-badge {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 18px;
  height: 18px;
  padding: 0 6px;
  border-radius: 999px;
  background: var(--dw-bg-muted);
  border: 1px solid var(--dw-border-light);
  color: var(--dw-text-muted);
  font-size: 10px;
  font-weight: 600;
  line-height: 1;
}

.header-actions {
  display: flex;
}
</style>
