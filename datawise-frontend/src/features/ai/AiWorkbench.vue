<script setup lang="ts">
import {computed, onMounted, ref, watch} from 'vue'
import {storeToRefs} from 'pinia'
import {useI18n} from 'vue-i18n'
import AiChatMain from '@/features/ai/chat/components/AiChatMain.vue'
import AiSideExplorer from '@/features/ai/datasource/components/AiSideExplorer.vue'
import AiPythonSimulatedBanner from '@/features/ai/analysis/components/AiPythonSimulatedBanner.vue'
import ShortcutRail from '@/features/layout/components/ShortcutRail.vue'
import TerminalPane from '@/features/layout/components/TerminalPane.vue'
import ResizeHandle from '@/core/components/ResizeHandle.vue'
import {useAiChatScroll} from '@/features/ai/chat/composables/useAiChatScroll'
import {useAiChatSend} from '@/features/ai/chat/composables/useAiChatSend'
import {useAiConsoleBridge} from '@/features/ai/shared/composables/useAiConsoleBridge'
import {useTenantAiQuota} from '@/features/ai/shared/composables/useTenantAiQuota'
import {useAiDatabaseScope} from '@/features/ai/datasource/composables/useAiDatabaseScope'
import {provideAiTaggedScope} from '@/features/ai/datasource/composables/ai-tagged-scope.context'
import {extractSqlFromContent} from '@/features/ai/chat/services/ai-chat.service'
import {useAiChatStore} from '@/features/ai/stores/ai-chat'
import type {AiAnalysisMode} from '@/features/ai/types/analysis'
import type {AiAnalysisTemplate} from '@/features/ai/analysis/types/analysis-template.types'
import {
    buildTeamAiSessionSharePayload,
    serializeTeamAiSessionSharePayload,
} from '@/features/ai/chat/services/ai-session-share.service'
import {useExplorerStore} from '@/features/explorer/stores/explorer'
import {useAppConfigStore} from '@/features/layout/stores/app-config-store'
import {useLayoutStore} from '@/features/layout/stores/layout'
import {useTeamStore} from '@/features/team/stores/team-store'
import {settingsApi} from '@/api'
import {
    EXPLORER_PANEL_RESIZE_MIN,
    useSidePanelResizeBounds,
} from '@/core/composables/useSidePanelResizeBounds'

const {tm, t} = useI18n()
const layout = useLayoutStore()
const appConfig = useAppConfigStore()
const teamStore = useTeamStore()
const explorer = useExplorerStore()
const aiChat = useAiChatStore()
const {activeSession, sortedSessions, activeSessionId} = storeToRefs(aiChat)
const {min: explorerResizeMin, max: explorerResizeMax} = useSidePanelResizeBounds({
    min: EXPLORER_PANEL_RESIZE_MIN,
})

const input = ref('')
const chatMainRef = ref<InstanceType<typeof AiChatMain>>()
const pythonSimulated = ref(false)

const taggedScope = provideAiTaggedScope()

const {
  allTargets,
  selectedTargetIds,
  selectedTargets,
  removeTarget,
  formatTargetLabel,
} = useAiDatabaseScope(taggedScope)

const {scrollToBottom} = useAiChatScroll(
    computed(() => chatMainRef.value?.getScrollEl?.()),
    activeSessionId,
)
const {openInConsole} = useAiConsoleBridge(selectedTargets)
const {
  usage: tenantAiUsage,
  nearLimit: tenantAiNearLimit,
  exhausted: tenantAiExhausted,
  refresh: refreshTenantAiUsage,
  refreshIfLimited: refreshTenantAiUsageIfLimited,
} = useTenantAiQuota()

const {
  send,
  analysisSteps,
  analysisStreaming,
  sqlConfirmPending,
  resumingSql,
  confirmSqlExecution,
  cancelSqlExecution,
} = useAiChatSend({
  allTargets,
  scrollToBottom,
  clearInput: () => {
    input.value = ''
    chatMainRef.value?.clearAttachments()
  },
  restoreInput: (value) => {
    input.value = value
  },
  getInput: () => input.value,
  getAttachments: () => chatMainRef.value?.getAttachments() ?? [],
  buildPrompt: (prompt) => chatMainRef.value?.buildSendPayload(prompt) ?? Promise.resolve(prompt),
})

const demoBadge = computed(() =>
    appConfig.workbenchLlmProfile?.provider === 'mock' ? t('ai.demoBadge') : undefined,
)

const messages = computed(() => activeSession.value?.messages ?? [])
const capabilities = computed(() => tm('ai.capabilities') as { title: string; desc: string }[])
const quickPrompts = computed(() => tm('ai.quickPrompts') as string[])
const userInitial = computed(() => layout.profileName.trim().charAt(0).toUpperCase() || 'U')
const sending = computed(() => aiChat.isSending() || !!sqlConfirmPending.value || resumingSql.value)
const showQuickPrompts = computed(
    () => messages.value.length === 1 && !sending.value && !!activeSession.value,
)

function resolveInitialTargetIds() {
  return []
}

onMounted(() => {
  aiChat.ensureInitialized(resolveInitialTargetIds())
  void refreshTenantAiUsage()
  void settingsApi.fetchDeploymentProfile()
      .then((profile) => {
        pythonSimulated.value = Boolean(profile.pythonSimulated)
      })
      .catch(() => {
        pythonSimulated.value = false
      })
})

watch(activeSessionId, () => {
  input.value = ''
})

function createChat() {
  aiChat.createSession(resolveInitialTargetIds())
  input.value = ''
}

function onKeydown(e: KeyboardEvent) {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault()
    if (tenantAiExhausted.value) return
    void chatMainRef.value?.buildSendPayload(input.value.trim()).then((prompt) => {
      if (!prompt) return
      void onSend(prompt)
    })
  }
}

function onQuickPrompt(prompt: string) {
  input.value = prompt
  void onSend(prompt)
}

async function onSend(prompt: string) {
  if (tenantAiExhausted.value) return
  await refreshTenantAiUsageIfLimited()
  if (tenantAiExhausted.value) return
  try {
    await send(prompt)
  } finally {
    await refreshTenantAiUsageIfLimited()
  }
}

const analysisMode = computed(() => appConfig.aiPreferences.analysisMode ?? 'smart')

function applyAnalysisTemplate(template: AiAnalysisTemplate) {
  input.value = template.prompt
  aiChat.setSelectedTargetIds(template.targetIds)
  if (template.analysisMode) {
    appConfig.setAnalysisMode(template.analysisMode)
  }
  layout.showSuccessToast(t('ai.templates.applied', {name: template.name}))
}

async function shareSessionToTeam(sessionId: string) {
  const teamId = teamStore.activeTeamId
  if (!teamId) {
    layout.showErrorToast(t('team.selectTeamFirst'))
    return
  }
  const session = aiChat.sessions.find((item) => item.id === sessionId)
  if (!session) return
  try {
    const payload = buildTeamAiSessionSharePayload(session)
    await teamStore.shareAiSession(
        teamId,
        session.title,
        serializeTeamAiSessionSharePayload(payload),
    )
    layout.showSuccessToast(t('ai.history.shareSuccess'))
  } catch (error) {
    const message = error instanceof Error ? error.message : t('ai.history.shareFailed')
    layout.showErrorToast(message)
  }
}
</script>

<template>
  <div class="ai-workbench">
    <div v-if="appConfig.showExplorerPanel" class="explorer-pane" :style="{ width: `${explorer.width}px` }">
      <AiSideExplorer
          v-model:selected-ids="selectedTargetIds"
          class="explorer-pane__panel"
          :sessions="sortedSessions"
          :active-session-id="activeSessionId"
          :selected-targets="selectedTargets"
          @select="aiChat.selectSession"
          @create="createChat"
          @delete="aiChat.deleteSession"
          @share="shareSessionToTeam"
      />
      <ResizeHandle
          v-model="explorer.width"
          :min="explorerResizeMin"
          :max="explorerResizeMax"
          class="explorer-pane__resize panel-resize-handle--trailing"
      />
    </div>

    <div class="workbench-center">
      <AiPythonSimulatedBanner :visible="pythonSimulated"/>
      <AiChatMain
          ref="chatMainRef"
          v-model:input="input"
          :messages="messages"
          :sending="sending"
          :show-quick-prompts="showQuickPrompts"
          :quick-prompts="quickPrompts"
          :user-initial="userInitial"
          :capabilities="capabilities"
          :selected-targets="selectedTargets"
          :format-target-label="formatTargetLabel"
          :extract-sql="extractSqlFromContent"
          :session-id="activeSessionId"
          :analysis-steps="analysisSteps"
          :analysis-streaming="analysisStreaming"
          :sql-confirm-pending="sqlConfirmPending"
          :resuming-sql="resumingSql"
          :badge="demoBadge"
          :selected-target-ids="selectedTargetIds"
          :analysis-mode="analysisMode as AiAnalysisMode"
          :tenant-ai-usage="tenantAiUsage"
          :tenant-ai-near-limit="tenantAiNearLimit"
          :tenant-ai-exhausted="tenantAiExhausted"
          @send="onSend"
          @remove-target="removeTarget"
          @open-in-console="openInConsole"
          @quick-prompt="onQuickPrompt"
          @confirm-sql="confirmSqlExecution()"
          @cancel-sql="cancelSqlExecution()"
          @apply-template="applyAnalysisTemplate"
          @keydown="onKeydown"
      />
      <TerminalPane/>
    </div>

    <ShortcutRail v-if="appConfig.showShortcutRail"/>
  </div>
</template>

<style scoped>
.ai-workbench {
  display: flex;
  flex: 1;
  min-width: 0;
  min-height: 0;
  gap: var(--dw-panel-gap);
  background: transparent;
}

.explorer-pane {
  position: relative;
  flex-shrink: 0;
  align-self: stretch;
  display: flex;
  flex-direction: column;
  min-width: 0;
  min-height: 0;
}

.explorer-pane :deep(.explorer-pane__panel) {
  flex: 1;
  width: 100%;
  min-width: 0;
  min-height: 0;
  max-width: none;
}

.workbench-center {
  display: flex;
  flex-direction: column;
  flex: 1;
  min-width: 0;
  min-height: 0;
  gap: var(--dw-panel-gap);
}
</style>

<style src="./styles/ai-reply.css"></style>
