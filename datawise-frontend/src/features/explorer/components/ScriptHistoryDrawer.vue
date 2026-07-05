<script setup lang="ts">
import {computed, ref, watch} from 'vue'
import {useI18n} from 'vue-i18n'
import {AppDrawer, EmptyState, ModalActions} from '@/core/components'
import ToolWindowShell from '@/features/layout/components/ToolWindowShell.vue'
import {instanceSqlApi} from '@/api'
import type {InstanceSqlHistoryEntry} from '@/shared/api/types'
import {useScriptHistoryDrawerStore} from '@/features/explorer/stores/script-history-drawer-store'
import {restoreScriptHistoryVersion} from '@/features/explorer/services/script-history.service'
import {useLayoutStore} from '@/features/layout/stores/layout'

const {t} = useI18n()
const drawer = useScriptHistoryDrawerStore()
const layout = useLayoutStore()

const loading = ref(false)
const restoring = ref(false)
const currentSql = ref('')
const entries = ref<InstanceSqlHistoryEntry[]>([])
const selectedVersionId = ref<string | null>(null)
const selectedSql = ref('')

const target = computed(() => drawer.target)

const selectedEntry = computed(() =>
    entries.value.find((item) => item.versionId === selectedVersionId.value) ?? null,
)

const subtitle = computed(() => {
    if (!target.value) return ''
    const label = target.value.connectionLabel?.trim()
    if (label) return `${label} · ${target.value.instanceName} · ${target.value.fileName}`
    return `${target.value.instanceName} · ${target.value.fileName}`
})

async function loadDrawerData() {
    const ctx = target.value
    if (!ctx) return
    loading.value = true
    selectedVersionId.value = null
    selectedSql.value = ''
    try {
        const [current, history] = await Promise.all([
            instanceSqlApi.read({
                connectionId: ctx.connectionId,
                instanceName: ctx.instanceName,
                fileName: ctx.fileName,
            }),
            instanceSqlApi.listHistory({
                connectionId: ctx.connectionId,
                instanceName: ctx.instanceName,
                fileName: ctx.fileName,
            }),
        ])
        currentSql.value = current.sql
        entries.value = history
        if (history.length) {
            selectedVersionId.value = history[0].versionId
            await loadSelectedVersion()
        }
    } catch {
        currentSql.value = ''
        entries.value = []
        layout.showToast(t('explorer.scriptHistory.loadFailed'))
    } finally {
        loading.value = false
    }
}

async function loadSelectedVersion() {
    const ctx = target.value
    const versionId = selectedVersionId.value
    if (!ctx || !versionId) {
        selectedSql.value = ''
        return
    }
    try {
        const result = await instanceSqlApi.readHistoryVersion({
            connectionId: ctx.connectionId,
            instanceName: ctx.instanceName,
            fileName: ctx.fileName,
            versionId,
        })
        selectedSql.value = result.sql
    } catch {
        selectedSql.value = ''
        layout.showToast(t('explorer.scriptHistory.versionLoadFailed'))
    }
}

async function selectVersion(versionId: string) {
    if (selectedVersionId.value === versionId) return
    selectedVersionId.value = versionId
    await loadSelectedVersion()
}

async function restoreSelected() {
    const ctx = target.value
    const versionId = selectedVersionId.value
    if (!ctx || !versionId || restoring.value) return
    restoring.value = true
    try {
        await restoreScriptHistoryVersion(ctx, versionId)
        layout.showToast(t('explorer.scriptHistory.restoreSuccess'))
        drawer.closeDrawer()
    } catch (error) {
        const message = error instanceof Error ? error.message : t('explorer.scriptHistory.restoreFailed')
        layout.showToast(message)
    } finally {
        restoring.value = false
    }
}

function formatSavedAt(savedAt: number) {
    if (!savedAt) return '—'
    return new Date(savedAt).toLocaleString()
}

function closeDrawer() {
    drawer.closeDrawer()
}

watch(
    () => drawer.open,
    (isOpen) => {
        if (isOpen) void loadDrawerData()
    },
)
</script>

<template>
  <AppDrawer
      :open="drawer.open && !!target"
      :ariaLabel="t('explorer.scriptHistory.title')"
      width="min(720px, 92vw)"
      @close="closeDrawer"
  >
    <ToolWindowShell
        :title="t('explorer.scriptHistory.title')"
        :subtitle="subtitle"
        @collapse="closeDrawer"
    >
      <EmptyState
          v-if="loading"
          embedded
          bordered
          :title="t('explorer.scriptHistory.loading')"
      />
      <EmptyState
          v-else-if="!entries.length"
          embedded
          bordered
          :title="t('explorer.scriptHistory.empty')"
          :hint="t('explorer.scriptHistory.emptyHint')"
      />
      <div v-else class="modal-drawer-layout">
        <aside class="modal-version-list" :aria-label="t('explorer.scriptHistory.versions')">
          <button
              v-for="entry in entries"
              :key="entry.versionId"
              class="modal-version-item"
              :class="{ 'is-active': entry.versionId === selectedVersionId }"
              type="button"
              @click="selectVersion(entry.versionId)"
          >
            <span class="modal-version-item__time">{{ formatSavedAt(entry.savedAt) }}</span>
            <span class="modal-version-item__preview">{{ entry.preview }}</span>
          </button>
        </aside>

        <div class="modal-code-split">
          <section class="modal-code-pane">
            <h3 class="modal-code-label">{{ t('explorer.scriptHistory.current') }}</h3>
            <pre class="modal-code-block">{{ currentSql }}</pre>
          </section>
          <section class="modal-code-pane">
            <h3 class="modal-code-label">
              {{ t('explorer.scriptHistory.selected') }}
              <span v-if="selectedEntry" class="modal-inline-meta">{{ formatSavedAt(selectedEntry.savedAt) }}</span>
            </h3>
            <pre class="modal-code-block modal-code-block--accent">{{ selectedSql }}</pre>
          </section>
        </div>

        <footer class="modal-drawer-footer">
          <ModalActions
              :confirm-label="t('explorer.scriptHistory.restore')"
              :cancel-label="t('common.cancel')"
              :confirm-disabled="!selectedVersionId || restoring"
              @cancel="closeDrawer"
              @confirm="restoreSelected"
          />
        </footer>
      </div>
    </ToolWindowShell>
  </AppDrawer>
</template>
