<script setup lang="ts">
import type {TeamInvite} from '@/core/types'
import {DwButton} from '@/core/components'

defineProps<{
  loading: boolean
  invites: TeamInvite[]
  inviteActionId: string | null
  inviteStatusLabel: (status: string) => string
  formatDate: (value: string) => string
}>()

const emit = defineEmits<{
  approve: [invite: TeamInvite]
  reject: [invite: TeamInvite]
}>()
</script>

<template>
  <div class="tab-panel">
    <p v-if="loading" class="mp-empty">{{ $t('team.loading') }}</p>
    <p v-else-if="!invites.length" class="mp-empty">{{ $t('team.emptyInvites') }}</p>
    <ul v-else class="detail-list">
      <li v-for="invite in invites" :key="invite.id" class="detail-list__row">
        <div>
          <div class="detail-list__name">{{ invite.userName }}</div>
          <div class="detail-list__meta">
            {{ inviteStatusLabel(invite.status) }} · {{ formatDate(invite.requestedAt) }}
          </div>
        </div>
        <div class="invite-actions">
          <DwButton
              variant="primary"
              size="sm"
              :disabled="inviteActionId === invite.id"
              :loading="inviteActionId === invite.id"
              @click="emit('approve', invite)"
          >
            {{ $t('team.approveInvite') }}
          </DwButton>
          <DwButton
              variant="secondary"
              size="sm"
              :disabled="inviteActionId === invite.id"
              @click="emit('reject', invite)"
          >
            {{ $t('team.rejectInvite') }}
          </DwButton>
        </div>
      </li>
    </ul>
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

.invite-actions {
  display: flex;
  gap: 8px;
  flex-shrink: 0;
}
</style>
