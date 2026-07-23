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
    layout.showSuccessToast(t('explorer.redisConsole.keyDeleted'))
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
  <div class="redis-workbench dw-workbench-page" :class="{'redis-workbench--command': isCommandView}">
    <header class="dw-workbench-page__head">
      <div class="dw-workbench-page__title">
        <h2>{{ isCommandView ? t('explorer.redisFeatures.command') : t('explorer.redisConsole.title') }}</h2>
        <p>{{ connectionLabel }}</p>
      </div>

      <div class="dw-workbench-page__actions">
        <RedisDbSelector v-model="redisDb"/>
      </div>
    </header>

    <div class="redis-workbench__body dw-workbench-page__body dw-workbench-split">
      <div v-if="!isCommandView" class="redis-workbench__left dw-workbench-col dw-workbench-col--left">
        <section class="redis-workbench__keys-card dw-workbench-card">
          <header class="redis-workbench__keys-head">
            <h3>{{ t('explorer.redisFeatures.keys') }}</h3>
          </header>
          <RedisKeysBrowser
              ref="keysBrowserRef"
              class="redis-workbench__keys"
              :connection-id="connectionId"
              :database="redisDb"
              :selected-key="selectedKey"
              embedded
              @select="onSelectKey"
              @open="onOpenKey"
          />
        </section>
      </div>

      <div
          class="redis-workbench__right dw-workbench-col dw-workbench-col--right dw-seam-stack dw-seam-stack--flush"
          :class="{'redis-workbench__right--command': isCommandView}"
      >
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
            class="redis-workbench__command-wrap dw-workbench-card"
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
  min-width: 0;
}

.redis-workbench__body {
  min-width: 0;
}

.redis-workbench__left {
  min-width: 0;
}

.redis-workbench__keys-card {
  display: flex;
  flex-direction: column;
  flex: 1;
  min-height: 0;
  overflow: hidden;
}

.redis-workbench__keys-head {
  flex-shrink: 0;
  padding: var(--dw-space-6) var(--dw-space-6) 0;
}

.redis-workbench__keys-head h3 {
  margin: 0;
  font-size: var(--dw-text-md);
  font-weight: 600;
}

.redis-workbench__keys {
  flex: 1;
  min-height: 0;
}

.redis-workbench__right {
  min-width: 0;
  gap: var(--dw-gap-md);
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
  padding: var(--dw-space-10);
  border: 1px var(--dw-wb-placeholder-style) var(--dw-wb-placeholder-border);
  border-radius: var(--dw-wb-card-radius);
  box-shadow: var(--dw-wb-placeholder-shadow);
  text-align: center;
  color: var(--dw-text-muted);
}

.redis-workbench__placeholder h3 {
  margin: 0 0 var(--dw-space-4);
  color: var(--dw-text);
  font-size: var(--dw-text-xl);
}

.redis-workbench__placeholder p {
  margin: 0;
  font-size: var(--dw-text-sm);
}

.redis-workbench__tips {
  margin: var(--dw-space-5) 0 0;
  padding-left: 18px;
  text-align: left;
  font-size: var(--dw-text-sm);
  line-height: var(--dw-leading-loose);
}

.redis-workbench__command-wrap {
  display: flex;
  flex-direction: column;
  min-height: 180px;
  max-height: 42%;
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
  gap: var(--dw-gap);
  padding: var(--dw-space-3) var(--dw-space-5);
  border-bottom: 1px solid var(--dw-border);
  background: color-mix(in srgb, var(--dw-bg-editor) 70%, transparent);
}

.redis-workbench__command-head h3 {
  margin: 0;
  font-size: var(--dw-text-sm);
  font-weight: 600;
}

.redis-workbench__command-toggle {
  border: none;
  background: transparent;
  color: var(--dw-primary);
  font-size: var(--dw-text-xs);
  cursor: pointer;
}

.redis-workbench__command {
  flex: 1;
  min-height: 0;
  padding: var(--dw-space-4) var(--dw-space-5) var(--dw-space-5);
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
  padding: var(--dw-space-5);
}

.redis-workbench__right--command .redis-workbench__command-wrap {
  height: 100%;
}

</style>
