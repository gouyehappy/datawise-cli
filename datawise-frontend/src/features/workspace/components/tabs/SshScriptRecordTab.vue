<script setup lang="ts">
defineOptions({name: 'SshScriptRecordTab'})

import {computed, nextTick, onBeforeUnmount, onMounted, ref, watch} from 'vue'
import {useDebounceFn} from '@vueuse/core'
import {useI18n} from 'vue-i18n'
import IconButton from '@/core/components/IconButton.vue'
import {DwIcon} from '@/core/icons'
import type {WorkspaceTab} from '@/core/types'
import SshCommandEditor from '@/features/ssh/components/SshCommandEditor.vue'
import {
    listSshScriptRecords,
    saveSshScriptRecord,
} from '@/features/ssh/services/ssh-script-records.service'
import {
    toPlainCommandText,
    toStoredCommandText,
} from '@/features/ssh/services/ssh-script-record-content.service'
import {resolveBuiltinCommandPlainText} from '@/features/ssh/services/ssh-builtin-defaults.service'
import {useLayoutStore} from '@/features/layout/stores/layout'
import {useExplorerStore} from '@/features/explorer/stores/explorer'
import {sshScriptRecordNodeId} from '@/features/explorer/services/ssh-feature-tree.service'
import {resolveApiErrorMessage} from '@/shared/api/http/api-error-message'
import {sendToSshTerminal, listSshTerminalHandles} from '@/features/terminal/services/ssh-terminal-session.service'
import {useWorkspaceStore} from '@/features/workspace/stores/workspace'

const props = defineProps<{ tab: WorkspaceTab }>()
const {t} = useI18n()
const layout = useLayoutStore()
const explorer = useExplorerStore()
const workspace = useWorkspaceStore()

const title = ref('')
const commandText = ref('')
const saving = ref(false)
const dirty = ref(false)
const ready = ref(false)
const applying = ref(false)
const lastSavedAt = ref<number | null>(null)
const loadError = ref('')

const subtitle = computed(() => {
  if (loadError.value) return loadError.value
  if (saving.value) return t('ssh.scriptRecord.saving')
  if (dirty.value) return t('ssh.scriptRecord.unsaved')
  if (lastSavedAt.value) return t('ssh.scriptRecord.savedAt', {time: formatTime(lastSavedAt.value)})
  return t('ssh.scriptRecord.hint')
})

const hasEditorContext = computed(() =>
    Boolean(props.tab.connectionId && props.tab.sshScriptRecordId),
)

function formatTime(value: number): string {
  return new Date(value).toLocaleString()
}

function markDirty() {
  if (applying.value || !ready.value || saving.value) return
  dirty.value = true
}

function resolveContentText(stored: string, recordId?: string): string {
  const fromStored = toPlainCommandText(stored)
  if (fromStored.trim()) return fromStored
  if (recordId) {
    const builtin = resolveBuiltinCommandPlainText(recordId)
    if (builtin) return builtin.trimEnd()
  }
  return ''
}

async function applyRecordState(next: {
  title: string
  contentHtml: string
  updatedAt?: number
  recordId?: string
}) {
  applying.value = true
  ready.value = false
  title.value = next.title
  commandText.value = resolveContentText(next.contentHtml, next.recordId ?? props.tab.sshScriptRecordId)
  props.tab.title = next.title
  props.tab.sshScriptRecordTitle = next.title
  props.tab.sshScriptRecordHtml = toStoredCommandText(commandText.value) || toPlainCommandText(next.contentHtml)
  props.tab.sshScriptRecordUpdatedAt = next.updatedAt
  lastSavedAt.value = next.updatedAt ?? null
  dirty.value = false
  loadError.value = ''
  ready.value = true
  await nextTick()
  applying.value = false
}

async function reloadFromServer() {
  const connectionId = props.tab.connectionId
  const recordId = props.tab.sshScriptRecordId
  if (!connectionId || !recordId) {
    loadError.value = t('ssh.scriptRecord.missingContext')
    return
  }
  try {
    const records = await listSshScriptRecords(connectionId)
    const record = records.find((item) => item.id === recordId)
    if (!record) {
      loadError.value = t('ssh.scriptRecord.loadFailed')
      return
    }
    await applyRecordState({
      title: record.title,
      contentHtml: record.contentHtml ?? '',
      updatedAt: record.updatedAt,
      recordId: record.id,
    })
  } catch (error) {
    loadError.value = resolveApiErrorMessage(error)
  }
}

async function copyRecordText() {
  if (!commandText.value.trim()) return
  try {
    await navigator.clipboard.writeText(commandText.value)
    layout.showToast(t('ssh.scriptRecord.copied'))
  } catch {
    layout.showToast(t('ssh.scriptRecord.copyFailed'))
  }
}

async function waitForTerminalHandle(connectionId: string, attempts = 25): Promise<boolean> {
  for (let index = 0; index < attempts; index += 1) {
    if (listSshTerminalHandles(connectionId).length > 0) return true
    await new Promise((resolve) => window.setTimeout(resolve, 200))
  }
  return false
}

async function sendToTerminal() {
  const connectionId = props.tab.connectionId
  if (!connectionId) return
  if (!commandText.value.trim()) {
    layout.showToast(t('ssh.scriptRecord.sendEmpty'))
    return
  }
  if (!listSshTerminalHandles(connectionId).length) {
    workspace.openSshTerminal({
      connectionId,
      connectionName: explorer.findNode(connectionId)?.label,
      explorerNodeId: connectionId,
    })
    const terminalReady = await waitForTerminalHandle(connectionId)
    if (!terminalReady) {
      layout.showToast(t('ssh.scriptRecord.sendFailed'))
      return
    }
  }
  const ok = await sendToSshTerminal(connectionId, commandText.value, {appendNewline: false})
  if (ok) {
    layout.showToast(t('ssh.scriptRecord.sentToTerminal'))
    return
  }
  layout.showToast(t('ssh.scriptRecord.sendFailed'))
}

async function saveRecord(options?: {silent?: boolean}) {
  const connectionId = props.tab.connectionId
  const recordId = props.tab.sshScriptRecordId
  if (!connectionId || !recordId || saving.value || applying.value) return false
  const stored = toStoredCommandText(commandText.value)
  if (options?.silent && !stored.trim() && props.tab.sshScriptRecordHtml?.trim()) {
    return false
  }
  const nextTitle = title.value.trim() || t('ssh.scriptRecord.untitled')
  saving.value = true
  try {
    const saved = await saveSshScriptRecord(connectionId, {
      id: recordId,
      title: nextTitle,
      contentHtml: stored,
      updatedAt: Date.now(),
    })
    await applyRecordState({
      title: saved.title,
      contentHtml: saved.contentHtml ?? '',
      updatedAt: saved.updatedAt,
      recordId: saved.id,
    })
    const treeNode = explorer.findNode(sshScriptRecordNodeId(connectionId, recordId))
    if (treeNode) {
      treeNode.label = saved.title
      explorer.touchTree()
    }
    return true
  } catch (error) {
    loadError.value = resolveApiErrorMessage(error)
    if (!options?.silent) {
      layout.showToast(t('ssh.scriptRecord.saveFailed'))
    }
    return false
  } finally {
    saving.value = false
  }
}

const debouncedAutoSave = useDebounceFn(() => {
  if (dirty.value && !applying.value) {
    void saveRecord({silent: true})
  }
}, 1500)

watch(title, () => {
  if (applying.value) return
  props.tab.title = title.value.trim() || t('ssh.scriptRecord.untitled')
  props.tab.sshScriptRecordTitle = title.value
  markDirty()
  debouncedAutoSave()
})

watch(commandText, () => {
  if (applying.value) return
  props.tab.sshScriptRecordHtml = toStoredCommandText(commandText.value)
  markDirty()
  debouncedAutoSave()
})

function onKeydown(event: KeyboardEvent) {
  if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 's') {
    event.preventDefault()
    void saveRecord({silent: true})
  }
}

onMounted(() => {
  window.addEventListener('keydown', onKeydown)
  const initialStored = props.tab.sshScriptRecordHtml ?? ''
  const initialTitle = props.tab.sshScriptRecordTitle || props.tab.title || ''
  if (initialTitle || initialStored || props.tab.sshScriptRecordId) {
    void applyRecordState({
      title: initialTitle || t('ssh.scriptRecord.untitled'),
      contentHtml: initialStored,
      updatedAt: props.tab.sshScriptRecordUpdatedAt,
      recordId: props.tab.sshScriptRecordId,
    })
  }
  void reloadFromServer()
})

onBeforeUnmount(() => {
  window.removeEventListener('keydown', onKeydown)
  if (dirty.value && !applying.value) {
    void saveRecord({silent: true})
  }
})
</script>

<template>
  <div class="ssh-script-record-tab">
    <header class="ssh-script-record-tab__head">
      <div class="ssh-script-record-tab__title">
        <span class="ssh-script-record-tab__icon" aria-hidden="true">
          <DwIcon name="editor" :size="18" :stroke-width="1.7"/>
        </span>
        <div class="ssh-script-record-tab__meta">
          <input
              v-model="title"
              class="ssh-script-record-tab__name"
              :placeholder="t('ssh.scriptRecord.titlePlaceholder')"
          >
          <p>{{ subtitle }}</p>
        </div>
      </div>
      <div class="ssh-script-record-tab__actions">
        <IconButton size="sm" :title="t('ssh.scriptRecord.sendToTerminal')" @click="sendToTerminal">
          <DwIcon name="console" size="sm" :stroke-width="1.5"/>
        </IconButton>
        <IconButton size="sm" :title="t('ssh.scriptRecord.copyText')" @click="copyRecordText">
          <DwIcon name="copy" size="sm" :stroke-width="1.5"/>
        </IconButton>
      </div>
    </header>

    <div class="ssh-script-record-tab__body">
      <SshCommandEditor
          v-if="hasEditorContext"
          v-model="commandText"
          :placeholder="t('ssh.scriptRecord.editorPlaceholder')"
      />
      <p v-else class="ssh-script-record-tab__empty">
        {{ t('ssh.scriptRecord.missingContext') }}
      </p>
    </div>
  </div>
</template>

<style scoped>
.ssh-script-record-tab {
  display: flex;
  flex-direction: column;
  height: 100%;
  min-height: 0;
  background: var(--dw-bg-editor);
}

.ssh-script-record-tab__head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  flex-shrink: 0;
  padding: 14px 18px;
  border-bottom: 1px solid var(--dw-border);
  background: var(--dw-bg-panel);
}

.ssh-script-record-tab__title {
  display: flex;
  align-items: flex-start;
  gap: 10px;
  min-width: 0;
}

.ssh-script-record-tab__icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 34px;
  height: 34px;
  border-radius: 8px;
  color: var(--dw-primary);
  background: color-mix(in srgb, var(--dw-primary) 12%, transparent);
}

.ssh-script-record-tab__meta {
  min-width: 0;
}

.ssh-script-record-tab__name {
  width: min(420px, 100%);
  border: none;
  background: transparent;
  color: var(--dw-text);
  font-size: 16px;
  font-weight: 600;
  outline: none;
}

.ssh-script-record-tab__meta p {
  margin: 4px 0 0;
  color: var(--dw-text-muted);
  font-size: 12px;
}

.ssh-script-record-tab__actions {
  display: flex;
  gap: 6px;
  flex-shrink: 0;
}

.ssh-script-record-tab__body {
  flex: 1;
  min-height: 0;
  padding: 16px 18px 18px;
  overflow: hidden;
  display: flex;
  flex-direction: column;
}

.ssh-script-record-tab__empty {
  margin: 0;
  color: var(--dw-text-muted);
  font-size: 12px;
}
</style>
