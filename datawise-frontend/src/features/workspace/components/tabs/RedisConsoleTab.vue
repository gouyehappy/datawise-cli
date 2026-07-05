<script setup lang="ts">
import {computed, onMounted, ref, watch} from 'vue'
import {useI18n} from 'vue-i18n'
import {explorerApi} from '@/api'
import {useExplorerStore} from '@/features/explorer/stores/explorer'
import {useLayoutStore} from '@/features/layout/stores/layout'
import {useWorkspaceStore} from '@/features/workspace/stores/workspace'
import {
    parseRedisDbIndex,
} from '@/features/explorer/services/redis-db.service'
import type {RedisKeyDetail} from '@/features/explorer/services/redis-key.service'
import RedisKeysBrowser from '@/features/workspace/components/redis/RedisKeysBrowser.vue'
import RedisKeyDetailPanel from '@/features/workspace/components/redis/RedisKeyDetailPanel.vue'
import RedisCommandPanel from '@/features/workspace/components/redis/RedisCommandPanel.vue'
import RedisDbSelector from '@/features/workspace/components/redis/RedisDbSelector.vue'
import type {WorkspaceTab} from '@/core/types'

const props = defineProps<{ tab: WorkspaceTab }>()

const {t} = useI18n()
const explorer = useExplorerStore()
const workspace = useWorkspaceStore()
const layout = useLayoutStore()

const selectedKey = ref<string | null>(null)
const keyDetail = ref<RedisKeyDetail | null>(null)
const keyDetailLoading = ref(false)
const keyDetailError = ref<string | null>(null)
const dbSize = ref<number | null>(null)
const loadedCount = ref(0)
const keysBrowserRef = ref<InstanceType<typeof RedisKeysBrowser> | null>(null)
const commandPanelRef = ref<InstanceType<typeof RedisCommandPanel> | null>(null)
const seedCommand = ref<string | null>(null)
const commandCollapsed = ref(false)

const redisView = computed(() => props.tab.redisView ?? 'keys')
const isCommandView = computed(() => redisView.value === 'command')

const connectionId = computed(() => props.tab.connectionId ?? '')
const redisDb = computed({
    get: () => parseRedisDbIndex(props.tab.database),
    set: (value: number) => {
        workspace.updateTabContext(props.tab.id, {database: String(value)})
    },
})

const connectionLabel = computed(() => {
    if (!connectionId.value) return t('explorer.redisConsole.noConnection')
    return explorer.findNode(connectionId.value)?.label ?? connectionId.value
})

const statsLabel = computed(() => {
    if (dbSize.value != null) {
        return t('explorer.redisConsole.stats', {loaded: loadedCount.value, total: dbSize.value})
    }
    return t('explorer.redisConsole.statsLoaded', {loaded: loadedCount.value})
})

function onSelectKey(key: string) {
    selectedKey.value = key
}

function onOpenKey(key: string) {
    if (!connectionId.value) return
    workspace.openRedisKey({
        connectionId: connectionId.value,
        key,
        explorerNodeId: `${connectionId.value}:redis:${key}`,
    })
}

function onStats(payload: { dbSize: number | null; loaded: number }) {
    dbSize.value = payload.dbSize
    loadedCount.value = payload.loaded
}

function refreshKeys() {
    keysBrowserRef.value?.refresh()
}

function onDetailRunCommand(command: string) {
    seedCommand.value = command
    commandCollapsed.value = false
}

function onKeyDeleted(key: string) {
    if (selectedKey.value === key) {
        selectedKey.value = null
        keyDetail.value = null
    }
    refreshKeys()
    layout.showToast(t('explorer.redisConsole.keyDeleted'))
}

async function ensureDefaultDb() {
    if (props.tab.database != null && props.tab.database !== '' || !connectionId.value) return
    try {
        const config = await explorerApi.fetchConnection(connectionId.value)
        workspace.updateTabContext(props.tab.id, {
            database: String(parseRedisDbIndex(config.database)),
        })
    } catch {
        workspace.updateTabContext(props.tab.id, {database: '0'})
    }
}

watch(connectionId, () => {
    selectedKey.value = null
    keyDetail.value = null
    dbSize.value = null
    loadedCount.value = 0
    seedCommand.value = null
})

watch(
    () => props.tab.database,
    () => {
        selectedKey.value = null
        keyDetail.value = null
        seedCommand.value = null
    },
)

onMounted(() => {
    void ensureDefaultDb()
    if (isCommandView.value) commandCollapsed.value = false
})

watch(
    () => props.tab.redisView,
    (view) => {
        if (view === 'command') commandCollapsed.value = false
    },
)
</script>

<template>
  <div class="redis-workbench" :class="{'redis-workbench--command': isCommandView}">
    <header class="redis-workbench__head">
      <div class="redis-workbench__title">
        <h2>{{ isCommandView ? t('explorer.redisFeatures.command') : t('explorer.redisConsole.title') }}</h2>
        <p>{{ connectionLabel }}</p>
        <span v-if="!isCommandView" class="redis-workbench__stats">{{ statsLabel }}</span>
      </div>

      <RedisDbSelector v-model="redisDb"/>

      <button
          v-if="!isCommandView"
          class="redis-workbench__refresh"
          type="button"
          @click="refreshKeys"
      >
        {{ t('explorer.redisBrowser.refresh') }}
      </button>
    </header>

    <div class="redis-workbench__body">
      <RedisKeysBrowser
          v-if="!isCommandView"
          ref="keysBrowserRef"
          class="redis-workbench__keys"
          :connection-id="connectionId"
          :database="redisDb"
          :selected-key="selectedKey"
          @select="onSelectKey"
          @open="onOpenKey"
          @stats="onStats"
      />

      <div class="redis-workbench__right" :class="{'redis-workbench__right--command': isCommandView}">
        <RedisKeyDetailPanel
            v-if="!isCommandView && selectedKey"
            class="redis-workbench__detail"
            :connection-id="connectionId"
            :database="redisDb"
            :redis-key="selectedKey"
            v-model:detail="keyDetail"
            v-model:loading="keyDetailLoading"
            v-model:error="keyDetailError"
            @run-command="onDetailRunCommand"
            @open-tab="onOpenKey"
            @deleted="onKeyDeleted"
        />

        <div v-else-if="!isCommandView" class="redis-workbench__placeholder">
          <h3>{{ t('explorer.redisConsole.emptyTitle') }}</h3>
          <p>{{ t('explorer.redisConsole.emptyHint') }}</p>
          <ul class="redis-workbench__tips">
            <li>{{ t('explorer.redisConsole.emptyTipScan') }}</li>
            <li>{{ t('explorer.redisConsole.emptyTipGroup') }}</li>
            <li>{{ t('explorer.redisConsole.emptyTipCommand') }}</li>
          </ul>
        </div>

        <section
            class="redis-workbench__command-wrap"
            :class="{ 'is-collapsed': commandCollapsed && !isCommandView }"
        >
          <header class="redis-workbench__command-head">
            <h3>{{ t('explorer.redisConsole.commandTitle') }}</h3>
            <button
                v-if="!isCommandView"
                class="redis-workbench__command-toggle"
                type="button"
                @click="commandCollapsed = !commandCollapsed"
            >
              {{ commandCollapsed ? t('explorer.redisConsole.showCommand') : t('explorer.redisConsole.hideCommand') }}
            </button>
          </header>

          <RedisCommandPanel
              v-show="isCommandView || !commandCollapsed"
              ref="commandPanelRef"
              class="redis-workbench__command"
              :connection-id="connectionId"
              :database="redisDb"
              :selected-key="selectedKey"
              :selected-key-type="keyDetail?.type ?? null"
              :seed-command="seedCommand"
              @key-deleted="onKeyDeleted"
          />
        </section>
      </div>
    </div>
  </div>
</template>

<style scoped>
.redis-workbench {
  display: flex;
  flex-direction: column;
  height: 100%;
  min-height: 0;
  background: var(--dw-bg-editor);
}

.redis-workbench__head {
  display: flex;
  align-items: center;
  gap: 12px;
  min-height: 56px;
  padding: 11px 16px;
  border-bottom: 1px solid var(--dw-border);
  background: var(--dw-bg-panel);
  overflow: visible;
}

.redis-workbench__title {
  flex: 1;
  min-width: 0;
}

.redis-workbench__title h2 {
  margin: 0;
  font-size: 15px;
  font-weight: 600;
}

.redis-workbench__title p {
  margin: 2px 0 0;
  color: var(--dw-text-muted);
  font-size: 12px;
}

.redis-workbench__stats {
  display: inline-block;
  margin-top: 4px;
  padding: 1px 8px;
  border-radius: 999px;
  background: color-mix(in srgb, var(--dw-primary) 12%, transparent);
  color: var(--dw-primary);
  font-size: 11px;
}

.redis-workbench__refresh {
  flex-shrink: 0;
  height: 34px;
  border: 1px solid var(--dw-border);
  border-radius: var(--dw-panel-radius, 8px);
  padding: 0 12px;
  background: var(--dw-bg, var(--dw-bg-panel));
  color: var(--dw-text);
  font-size: 12px;
  line-height: 1;
  cursor: pointer;
  box-shadow: 0 1px 2px rgba(15, 23, 42, 0.03);
  transition: border-color 0.15s ease, background 0.15s ease;
}

.redis-workbench__refresh:hover {
  border-color: color-mix(in srgb, var(--dw-primary) 18%, var(--dw-border));
  background: var(--dw-bg-muted);
}

.redis-workbench__body {
  display: grid;
  grid-template-columns: minmax(280px, 34%) minmax(0, 1fr);
  flex: 1;
  min-height: 0;
}

.redis-workbench__keys {
  border-right: 1px solid var(--dw-border);
}

.redis-workbench__right {
  display: flex;
  flex-direction: column;
  min-width: 0;
  min-height: 0;
  padding: 10px;
  gap: 10px;
}

.redis-workbench__detail {
  flex: 1;
  min-height: 120px;
}

.redis-workbench__placeholder {
  flex: 1;
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  min-height: 120px;
  padding: 24px;
  border: 1px dashed var(--dw-border);
  border-radius: 8px;
  text-align: center;
  color: var(--dw-text-muted);
}

.redis-workbench__placeholder h3 {
  margin: 0 0 8px;
  color: var(--dw-text);
  font-size: 14px;
}

.redis-workbench__placeholder p {
  margin: 0;
  font-size: 12px;
}

.redis-workbench__tips {
  margin: 10px 0 0;
  padding-left: 18px;
  text-align: left;
  font-size: 12px;
  line-height: 1.6;
}

.redis-workbench__command-wrap {
  display: flex;
  flex-direction: column;
  min-height: 180px;
  max-height: 42%;
  border: 1px solid var(--dw-border);
  border-radius: 8px;
  background: var(--dw-bg-panel);
  overflow: hidden;
}

.redis-workbench__command-wrap.is-collapsed {
  min-height: auto;
  max-height: none;
  flex: 0 0 auto;
}

.redis-workbench__command-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  padding: 6px 10px;
  border-bottom: 1px solid var(--dw-border);
  background: color-mix(in srgb, var(--dw-bg-editor) 70%, transparent);
}

.redis-workbench__command-head h3 {
  margin: 0;
  font-size: 12px;
  font-weight: 600;
}

.redis-workbench__command-toggle {
  border: none;
  background: transparent;
  color: var(--dw-primary);
  font-size: 11px;
  cursor: pointer;
}

.redis-workbench__command {
  flex: 1;
  min-height: 0;
  padding: 8px 10px 10px;
}

.redis-workbench--command .redis-workbench__body {
  grid-template-columns: minmax(0, 1fr);
}

.redis-workbench--command .redis-workbench__command-wrap {
  flex: 1;
  min-height: 0;
  max-height: none;
}

.redis-workbench__right--command {
  padding: 0;
}

.redis-workbench__right--command .redis-workbench__command-wrap {
  border: none;
  border-radius: 0;
  height: 100%;
}
</style>
