<script setup lang="ts">
import {ref} from 'vue'
import AiMessageRow from '@/features/ai/chat/components/AiMessageRow.vue'
import AiChatLoading from '@/features/ai/chat/components/AiChatLoading.vue'
import AiAnalysisWorkflowRow from '@/features/ai/analysis/components/AiAnalysisWorkflowRow.vue'
import AiAnalysisWorkflowCard from '@/features/ai/analysis/components/AiAnalysisWorkflowCard.vue'
import type {AiChatMessage} from '@/features/ai/types'
import type {AiAnalysisStepEvent} from '@/features/ai/types/analysis'
import type {AiSqlConfirmPending} from '@/features/ai/types/chat'

defineProps<{
  messages: AiChatMessage[]
  sending: boolean
  showQuickPrompts: boolean
  quickPrompts: string[]
  userInitial: string
  capabilities: { title: string; desc: string }[]
  extractSql: (content: string) => string | null
  analysisSteps?: AiAnalysisStepEvent[]
  analysisStreaming?: boolean
  sqlConfirmPending?: AiSqlConfirmPending | null
  resumingSql?: boolean
}>()

const emit = defineEmits<{
  openInConsole: [content: string]
  quickPrompt: [prompt: string]
  confirmSql: []
  cancelSql: []
}>()

const scrollRef = ref<HTMLElement>()
defineExpose({
  getScrollEl: () => scrollRef.value,
})
</script>

<template>
  <div ref="scrollRef" class="chat-scroll">
    <AiMessageRow
        v-for="msg in messages"
        :key="msg.id"
        :message="msg"
        :user-initial="userInitial"
        :capabilities="capabilities"
        :extract-sql="extractSql"
        @open-in-console="emit('openInConsole', $event)"
    />

    <AiAnalysisWorkflowRow v-if="sqlConfirmPending">
      <AiAnalysisWorkflowCard
          mode="sql-confirm"
          :analysis-steps="analysisSteps"
          :sql-confirm-pending="sqlConfirmPending"
          :resuming-sql="resumingSql"
          @confirm-sql="emit('confirmSql')"
          @cancel-sql="emit('cancelSql')"
      />
    </AiAnalysisWorkflowRow>

    <AiAnalysisWorkflowRow v-else-if="sending">
      <AiAnalysisWorkflowCard
          v-if="analysisStreaming"
          mode="streaming"
          :analysis-steps="analysisSteps"
      />
      <AiChatLoading v-else/>
    </AiAnalysisWorkflowRow>

    <div v-if="showQuickPrompts" class="quick-prompts">
      <span class="quick-label">{{ $t('ai.tryPrompts') }}</span>
      <div class="quick-grid">
        <button
            v-for="prompt in quickPrompts"
            :key="prompt"
            class="quick-chip"
            type="button"
            @click="emit('quickPrompt', prompt)"
        >
          {{ prompt }}
        </button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.chat-scroll {
  flex: 1;
  min-height: 0;
  overflow: auto;
  padding: var(--dw-space-8) var(--dw-space-11) var(--dw-space-9);
  display: flex;
  flex-direction: column;
  gap: var(--dw-space-8);
  background: radial-gradient(ellipse 80% 50% at 50% -20%, color-mix(in srgb, var(--dw-primary) 6%, transparent), transparent 70%),
  var(--dw-bg);
}

.quick-prompts {
  padding-left: 44px;
}

.quick-label {
  display: block;
  margin-bottom: var(--dw-space-5);
  color: var(--dw-text-muted);
  font-size: var(--dw-text-sm);
}

.quick-grid {
  display: flex;
  flex-wrap: wrap;
  gap: var(--dw-gap);
}

.quick-chip {
  padding: var(--dw-space-4) var(--dw-space-7);
  border: 1px solid var(--dw-border);
  border-radius: var(--dw-radius-pill);
  background: var(--dw-bg-panel);
  font-size: var(--dw-text-sm);
  line-height: var(--dw-leading-snug);
  cursor: pointer;
  transition: var(--dw-transition-colors),
  color 0.15s ease,
  transform 0.12s ease;
}

.quick-chip:hover {
  border-color: var(--dw-primary-border);
  background: var(--dw-primary-soft);
  color: var(--dw-primary);
}
</style>
