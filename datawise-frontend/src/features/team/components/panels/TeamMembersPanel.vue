<script setup lang="ts">
import type {TeamMember} from '@/core/types'
import type {SelectOption} from '@/core/components/select.types'
import DwSelect from '@/core/components/DwSelect.vue'
import {isTeamOwner, type TeamRole} from '@/features/team/services/team-role.service'

const props = defineProps<{
  loading: boolean
  members: TeamMember[]
  isOwner: boolean
  roleOptions: SelectOption[]
  roleUpdatingUserId: number | null
  roleLabel: (role: TeamRole | string) => string
  formatDate: (value: string) => string
}>()

const emit = defineEmits<{
  'update-role': [member: TeamMember, role: TeamRole]
}>()
</script>

<template>
  <div class="tab-panel">
    <p v-if="loading" class="mp-empty">{{ $t('team.loading') }}</p>
    <p v-else-if="!members.length" class="mp-empty">{{ $t('team.emptyMembers') }}</p>
    <ul v-else class="detail-list">
      <li v-for="member in members" :key="member.userId" class="detail-list__row">
        <div>
          <div class="detail-list__name">{{ member.userName }}</div>
          <div class="detail-list__meta">{{ formatDate(member.joinedAt) }}</div>
        </div>
        <DwSelect
            v-if="isOwner && !isTeamOwner(member.role)"
            :model-value="member.role"
            size="sm"
            :options="roleOptions"
            :disabled="roleUpdatingUserId === member.userId"
            @update:model-value="emit('update-role', member, $event as TeamRole)"
        />
        <span v-else class="role-badge">{{ roleLabel(member.role) }}</span>
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

.role-badge {
  font-size: 12px;
}

.detail-list__row :deep(.dw-select) {
  width: auto;
  min-width: 108px;
}
</style>
