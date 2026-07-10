<script setup lang="ts">
import {computed} from 'vue'
import {useI18n} from 'vue-i18n'
import ShortcutPanelDrawer from './ShortcutPanelDrawer.vue'
import NotificationDrawer from './NotificationDrawer.vue'
import ResizeHandle from '@/core/components/ResizeHandle.vue'
import {DwIcon, shortcutRailDwIcon} from '@/core/icons'
import type {ExportTask} from '@/core/types'
import {SHORTCUT_RAIL_NAV_DEFS} from '@/features/layout/constants/shortcut-rail'
import {useAppConfigStore} from '@/features/layout/stores/app-config-store'
import {useLayoutStore} from '@/features/layout/stores/layout'
import {usePluginStore} from '@/features/plugin/stores/plugin-store'
import {isShortcutPanelEnabled} from '@/features/plugin/services/plugin-registry.service'
import {useShortcutPanelStore} from '@/features/layout/stores/shortcut-panel-store'
import {useMigrationTaskStore} from '@/features/explorer/stores/migration-task-store'
import {useSidePanelResizeBounds, SHORTCUT_PANEL_RESIZE_MIN} from '@/core/composables/useSidePanelResizeBounds'

const {t} = useI18n()
const layout = useLayoutStore()
const appConfig = useAppConfigStore()
const pluginStore = usePluginStore()
const shortcutPanel = useShortcutPanelStore()
const migrationTasks = useMigrationTaskStore()

const navDefs = SHORTCUT_RAIL_NAV_DEFS

const items = computed(() =>
    navDefs
        .filter((item) => appConfig.isShortcutVisible(item.id))
        .filter((item) => isShortcutPanelEnabled(item.id, (id) => pluginStore.isEnabled(id)))
        .map((item) => ({
          ...item,
          label: t(item.labelKey),
          pending:
              item.id === 'export'
                  ? shortcutPanel.exportTasks.some((task: ExportTask) => task.status === 'running')
                  : item.id === 'migration'
                      ? migrationTasks.isRunning
                      : false,
        })),
)

const toolWindowOpen = computed(
    () => layout.showNotificationDrawer || layout.activeShortcutPanel,
)

const panelWidth = computed({
    get: () => appConfig.shortcutPanelWidth,
    set: (width: number) => appConfig.setShortcutPanelWidth(width),
})

const {min: shortcutResizeMin, max: shortcutResizeMax} = useSidePanelResizeBounds({
    min: SHORTCUT_PANEL_RESIZE_MIN,
})
</script>

<template>
  <div class="workbench-edge">
    <div
        v-if="toolWindowOpen"
        class="workbench-edge__panel"
        :style="{ width: `${panelWidth}px` }"
    >
      <NotificationDrawer v-if="layout.showNotificationDrawer" embedded/>
      <ShortcutPanelDrawer v-else-if="layout.activeShortcutPanel"/>
    </div>
    <ResizeHandle
        v-if="toolWindowOpen"
        v-model="panelWidth"
        invert
        :min="shortcutResizeMin"
        :max="shortcutResizeMax"
        class="workbench-edge__resize panel-resize-handle--leading"
    />

    <aside class="tool-stripe tool-stripe--right">
      <nav class="tool-stripe__group" :aria-label="t('shortcut.railLabel')">
        <button
            v-for="item in items"
            :key="item.id"
            class="tool-btn tool-btn--stack"
            :class="{ active: layout.activeShortcutPanel === item.id }"
            type="button"
            :aria-label="item.label"
            :aria-pressed="layout.activeShortcutPanel === item.id"
            @click="layout.toggleShortcutPanel(item.id)"
        >
          <span class="tool-btn__graphic">
            <DwIcon :name="shortcutRailDwIcon(item.id)" size="rail" :stroke-width="1.7"/>
            <span v-if="item.pending" class="tool-btn__dot" aria-hidden="true"/>
          </span>
          <span class="tool-btn__caption">{{ item.caption }}</span>
        </button>
      </nav>
    </aside>
  </div>
</template>
