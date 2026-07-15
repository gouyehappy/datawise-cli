<script setup lang="ts">
import {computed} from 'vue'
import {useI18n} from 'vue-i18n'
import DbTypeIcon from '@/core/components/DbTypeIcon.vue'
import {DB_TYPE_ICON_SIZE} from '@/features/connection/constants/db-type-icon-sizes'
import {TagChip, AiIcon} from '@/core/components'
import {parseMessageBlocks} from '@/features/ai/chat/services/ai-chat.service'
import type {AiChatMessage} from '@/features/ai/types'
import AiWelcomeCard from '@/features/ai/shared/components/AiWelcomeCard.vue'
import AiAnalysisPanel from '@/features/ai/analysis/components/AiAnalysisPanel.vue'
import AiAnalysisProgress from '@/features/ai/analysis/components/AiAnalysisProgress.vue'

const props = defineProps<{
  message: AiChatMessage
  userInitial: string
  capabilities: { title: string; desc: string }[]
  extractSql: (content: string) => string | null
}>()

const emit = defineEmits<{
  openInConsole: [content: string]
}>()

const {t} = useI18n()

const contentBlocks = computed(() => parseMessageBlocks(props.message.content))

const hasSummaryText = computed(() =>
    contentBlocks.value.some((block) =>
        block.type === 'text' ? block.text.trim().length > 0 : block.type === 'list',
    ),
)
</script>

<template>
  <article class="msg-row" :class="[message.role, { 'msg-row--welcome': message.kind === 'welcome' }]">
    <div v-if="message.role === 'assistant' && message.kind !== 'welcome'" class="avatar avatar-ai" aria-hidden="true">
      <AiIcon :size="16"/>
    </div>
    <div v-else-if="message.role === 'user'" class="avatar avatar-user" aria-hidden="true">{{ userInitial }}</div>

    <div class="msg-body" :class="{ 'msg-body--analysis': message.analysis, 'msg-body--welcome': message.kind === 'welcome' }">
      <AiWelcomeCard v-if="message.kind === 'welcome'" :capabilities="capabilities"/>

      <template v-else>
        <div v-if="message.databases?.length" class="msg-databases">
          <TagChip v-for="db in message.databases" :key="db.id">
            <template #icon>
              <DbTypeIcon :db-type="db.dbType" :size="DB_TYPE_ICON_SIZE.chip"/>
            </template>
            {{ db.connectionLabel }}
            <template v-if="db.databaseLabel !== db.connectionLabel"> / {{ db.databaseLabel }}</template>
          </TagChip>
        </div>

        <div
            class="bubble"
            :class="[message.role, { 'bubble--analysis': message.analysis }]"
        >
          <template v-if="message.analysis">
            <AiAnalysisProgress
                v-if="message.analysisSteps?.length"
                :steps="message.analysisSteps"
                readonly
            />
            <header class="analysis-reply-header">
              <div class="analysis-reply-badge">
                <span class="analysis-reply-badge__dot" aria-hidden="true"/>
                {{ t('ai.analysis.reportBadge') }}
              </div>
              <span v-if="message.analysis.rows.length" class="analysis-reply-stat">
                {{ t('ai.analysis.rowCount', {count: message.analysis.rows.length}) }}
              </span>
            </header>

            <div class="analysis-reply-body">
              <section v-if="hasSummaryText" class="analysis-summary">
                <h4 class="analysis-summary__label">{{ t('ai.analysis.summaryLabel') }}</h4>
                <template v-for="(block, index) in contentBlocks" :key="index">
                  <p v-if="block.type === 'text'" class="text-block">{{ block.text }}</p>
                  <ul v-else-if="block.type === 'list'" class="list-block">
                    <li v-for="item in block.items" :key="item">{{ item }}</li>
                  </ul>
                </template>
              </section>

              <AiAnalysisPanel
                  :analysis="message.analysis"
                  :federated-target-count="message.databases?.length ?? 0"
                  :summary-text="message.content"
                  :targets-json="message.databases?.length ? JSON.stringify(message.databases) : undefined"
                  @open-in-console="emit('openInConsole', $event)"
              />
            </div>
          </template>

          <template v-else>
            <template v-for="(block, index) in contentBlocks" :key="index">
              <p v-if="block.type === 'text'" class="text-block">{{ block.text }}</p>
              <ul v-else-if="block.type === 'list'" class="list-block">
                <li v-for="item in block.items" :key="item">{{ item }}</li>
              </ul>
              <div v-else class="code-block ai-code-surface">
                <div class="code-head ai-code-surface__head">
                  <span class="ai-code-surface__label">
                    <span class="ai-code-surface__label-dot" aria-hidden="true"/>
                    SQL
                  </span>
                  <button
                      v-if="extractSql(message.content)"
                      class="ai-text-action"
                      type="button"
                      @click="emit('openInConsole', message.content)"
                  >
                    {{ t('ai.openInConsole') }}
                  </button>
                </div>
                <pre><code>{{ block.code }}</code></pre>
              </div>
            </template>

            <button
                v-if="
                message.role === 'assistant' &&
                extractSql(message.content) &&
                !contentBlocks.some((b) => b.type === 'code')
              "
                class="open-btn ai-text-action"
                type="button"
                @click="emit('openInConsole', message.content)"
            >
              {{ t('ai.openInConsole') }}
            </button>
          </template>
        </div>
      </template>

      <time v-if="message.kind !== 'welcome'">{{ message.time }}</time>
    </div>
  </article>
</template>

<style scoped>
.msg-row {
  display: flex;
  gap: var(--dw-space-6);
  align-items: flex-start;
}

.msg-row.user {
  flex-direction: row-reverse;
}

.msg-row--welcome {
  gap: 0;
}

.msg-body--welcome {
  max-width: 100%;
  width: 100%;
}

.avatar {
  flex-shrink: 0;
  width: 34px;
  height: var(--dw-control-h);
  border-radius: var(--dw-radius-lg);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: var(--dw-text-sm);
  font-weight: 600;
}

.avatar-ai {
  background: linear-gradient(
      145deg,
      color-mix(in srgb, var(--dw-primary) 20%, var(--dw-bg-panel)),
      var(--dw-bg-panel)
  );
  border: 1px solid color-mix(in srgb, var(--dw-primary) 28%, var(--dw-border));
  color: var(--dw-primary);
  box-shadow: 0 1px 0 color-mix(in srgb, var(--dw-primary) 10%, transparent),
  0 2px 10px color-mix(in srgb, var(--dw-primary) 12%, transparent);
}

.avatar-user {
  background: var(--dw-bg-panel);
  border: 1px solid var(--dw-border);
  color: var(--dw-text-secondary);
}

.msg-body {
  min-width: 0;
  max-width: min(720px, 88%);
  display: flex;
  flex-direction: column;
  gap: var(--dw-gap-sm);
}

.msg-body--analysis {
  max-width: min(920px, 96%);
}

.msg-row.user .msg-body {
  align-items: flex-end;
}

.msg-body time {
  color: var(--dw-text-muted);
  font-size: var(--dw-text-xs);
  padding: 0 var(--dw-space-1);
}

.msg-databases {
  display: flex;
  flex-wrap: wrap;
  gap: var(--dw-gap-sm);
}

.bubble {
  padding: var(--dw-space-6) var(--dw-space-8);
  border-radius: var(--dw-radius-xl);
  border: 1px solid var(--dw-border-light);
  background: var(--dw-bg);
  box-shadow: 0 1px 0 color-mix(in srgb, var(--dw-text) 4%, transparent);
}

.bubble.assistant {
  border-top-left-radius: var(--dw-control-radius-sm);
}

.bubble.user {
  background: linear-gradient(
      135deg,
      color-mix(in srgb, var(--dw-primary) 12%, var(--dw-bg)),
      color-mix(in srgb, var(--dw-primary) 6%, var(--dw-bg))
  );
  border-color: color-mix(in srgb, var(--dw-primary) 20%, var(--dw-border-light));
  border-top-right-radius: var(--dw-control-radius-sm);
}

.bubble--analysis {
  padding: 0;
  overflow: hidden;
  border-color: color-mix(in srgb, var(--dw-primary) 20%, var(--dw-border-light));
  background: var(--dw-bg-panel);
  box-shadow: 0 1px 0 color-mix(in srgb, var(--dw-on-accent) 35%, transparent) inset,
  0 12px 36px color-mix(in srgb, var(--dw-primary) 10%, transparent),
  0 4px 14px color-mix(in srgb, var(--dw-text) 5%, transparent);
}

.bubble--analysis::before {
  content: '';
  display: block;
  height: 3px;
  background: linear-gradient(
      90deg,
      color-mix(in srgb, var(--dw-primary) 60%, transparent),
      var(--dw-primary),
      color-mix(in srgb, var(--dw-primary) 45%, var(--dw-info))
  );
}

.analysis-reply-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--dw-space-6);
  padding: var(--dw-space-7) var(--dw-space-8);
  border-bottom: 1px solid var(--dw-border-light);
  background: radial-gradient(ellipse 80% 100% at 0% 0%, color-mix(in srgb, var(--dw-primary) 8%, transparent), transparent 60%),
  linear-gradient(180deg, color-mix(in srgb, var(--dw-primary) 6%, var(--dw-bg-panel)), var(--dw-bg-panel));
}

.analysis-reply-badge {
  display: inline-flex;
  align-items: center;
  gap: var(--dw-gap-md);
  font-size: var(--dw-text-xl);
  font-weight: 600;
  color: var(--dw-text);
  letter-spacing: 0.01em;
}

.analysis-reply-badge__dot {
  width: 9px;
  height: 9px;
  border-radius: 50%;
  background: linear-gradient(180deg, color-mix(in srgb, var(--dw-primary) 85%, var(--dw-on-accent)), var(--dw-primary));
  box-shadow: 0 0 0 3px color-mix(in srgb, var(--dw-primary) 18%, transparent),
  0 0 10px color-mix(in srgb, var(--dw-primary) 35%, transparent);
}

.analysis-reply-stat {
  padding: var(--dw-space-2) 11px;
  border-radius: var(--dw-radius-pill);
  border: 1px solid color-mix(in srgb, var(--dw-primary) 18%, var(--dw-border-light));
  background: color-mix(in srgb, var(--dw-bg) 80%, var(--dw-primary-soft));
  color: var(--dw-primary);
  font-size: var(--dw-text-xs);
  font-weight: 600;
  font-variant-numeric: tabular-nums;
}

.analysis-reply-body {
  display: flex;
  flex-direction: column;
  gap: var(--dw-space-8);
  padding: var(--dw-space-8) var(--dw-space-8) var(--dw-space-8);
  background: linear-gradient(180deg, var(--dw-bg) 0%, color-mix(in srgb, var(--dw-bg-panel) 30%, var(--dw-bg)) 100%);
}

.analysis-summary {
  padding: var(--dw-space-7) var(--dw-space-8);
  border-radius: var(--dw-radius-xl);
  border: 1px solid var(--dw-border-light);
  background: linear-gradient(135deg, color-mix(in srgb, var(--dw-primary) 4%, var(--dw-bg)), var(--dw-bg)),
  var(--dw-bg);
  border-left: 3px solid var(--dw-primary);
  box-shadow: 0 2px 12px color-mix(in srgb, var(--dw-text) 4%, transparent);
}

.analysis-summary__label {
  margin: 0 0 var(--dw-space-4);
  font-size: var(--dw-text-xs);
  font-weight: 600;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  color: var(--dw-text-muted);
}

.text-block {
  margin: 0 0 var(--dw-space-4);
  white-space: pre-wrap;
  font-size: var(--dw-text-md);
  line-height: var(--dw-leading-loose);
  color: var(--dw-text);
}

.text-block:last-child {
  margin-bottom: 0;
}

.list-block {
  margin: 0 0 var(--dw-space-4);
  padding-left: 18px;
  font-size: var(--dw-text-md);
  line-height: var(--dw-leading-loose);
}

.code-block {
  margin-top: var(--dw-space-2);
}

.open-btn {
  margin-top: var(--dw-space-5);
}
</style>
