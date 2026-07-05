<script setup lang="ts">
import type {TeamSharedAiSessionDetail, TeamSharedAiSessionSummary} from '@/core/types'
import TeamSharedAiSessionViewer from '@/features/team/components/TeamSharedAiSessionViewer.vue'

defineProps<{
  loadingList: boolean
  loadingDetail: boolean
  sessions: TeamSharedAiSessionSummary[]
  selectedSession: TeamSharedAiSessionDetail | null
  formatDate: (value: string) => string
}>()

const emit = defineEmits<{
  select: [sessionId: string]
}>()
</script>

<template>
  <div class="tab-panel ai-sessions-panel">
    <p v-if="loadingList" class="mp-empty">{{ $t('team.loading') }}</p>
    <p v-else-if="!sessions.length" class="mp-empty">{{ $t('team.sharedAiSessions.empty') }}</p>
    <div v-else class="ai-sessions-layout">
      <ul class="detail-list ai-sessions-list">
        <li
            v-for="session in sessions"
            :key="session.id"
            class="detail-list__row ai-sessions-list__row"
            :class="{ 'is-active': selectedSession?.id === session.id }"
            @click="emit('select', session.id)"
        >
          <div>
            <div class="detail-list__name">{{ session.title }}</div>
            <div class="detail-list__meta">
              {{ $t('team.sharedAiSessions.meta', {
                name: session.sharedByUserName,
                count: session.messageCount,
                time: formatDate(session.sharedAt),
              }) }}
            </div>
          </div>
        </li>
      </ul>
      <div class="ai-sessions-detail">
        <p v-if="loadingDetail" class="mp-empty">{{ $t('team.loading') }}</p>
        <p v-else-if="!selectedSession" class="mp-empty">
          {{ $t('team.sharedAiSessions.selectHint') }}
        </p>
        <TeamSharedAiSessionViewer v-else :session="selectedSession"/>
      </div>
    </div>
  </div>
</template>

<style scoped>
.detail-list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.detail-list__row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 10px 12px;
  border: 1px solid var(--dw-border-light);
  border-radius: 10px;
  background: var(--dw-bg-panel);
}

.detail-list__name {
  font-size: 13px;
  font-weight: 600;
}

.detail-list__meta {
  font-size: 11px;
  color: var(--dw-text-muted);
  margin-top: 2px;
}

.ai-sessions-layout {
  display: grid;
  grid-template-columns: minmax(220px, 280px) minmax(0, 1fr);
  gap: 12px;
  min-height: 320px;
}

.ai-sessions-list {
  overflow: auto;
  max-height: 420px;
}

.ai-sessions-list__row {
  cursor: pointer;
}

.ai-sessions-list__row.is-active {
  border-color: color-mix(in srgb, var(--dw-primary) 35%, var(--dw-border-light));
  background: color-mix(in srgb, var(--dw-primary-soft) 40%, var(--dw-bg-panel));
}

.ai-sessions-detail {
  min-height: 0;
  overflow: auto;
  padding: 12px;
  border: 1px solid var(--dw-border-light);
  border-radius: 10px;
  background: var(--dw-bg-panel);
}

@media (max-width: 900px) {
  .ai-sessions-layout {
    grid-template-columns: 1fr;
  }
}
</style>
