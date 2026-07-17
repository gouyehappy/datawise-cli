<script setup lang="ts">
import type {SelectOption} from '@/core/components/select.types'
import type {ConnectionAccessLevel} from '@/features/team/services/connection-access.service'
import DwSelect from '@/core/components/DwSelect.vue'
import {DwButton} from '@/core/components'

interface SharedConnectionRow {
  id: string
  access: ConnectionAccessLevel
}

defineProps<{
  inviteCode: string | null
  requireInviteApproval: boolean
  showInviteBadge: boolean
  pendingInviteCount: number
  sharedConnectionsInput: string
  sharedConsolesInput: string
  shareSqlHistory: boolean
  sharedConnectionRows: SharedConnectionRow[]
  onCallConnectionIds: string[]
  connectionAccessOptions: SelectOption[]
  savingSettings: boolean
  savingSharedConnections: boolean
  savingOnCallConnections: boolean
  savingSharedConsoles: boolean
  savingShareSqlHistory: boolean
}>()

const emit = defineEmits<{
  'update:sharedConnectionsInput': [value: string]
  'update:sharedConsolesInput': [value: string]
  'update:requireInviteApproval': [value: boolean]
  'update:shareSqlHistory': [value: boolean]
  'update-connection-access': [connectionId: string, access: ConnectionAccessLevel]
  'copy-invite-code': []
  'open-invites-tab': []
  'save-settings': []
  'save-shared-connections': []
  'toggle-on-call-connection': [connectionId: string]
  'save-on-call-connections': []
  'save-shared-consoles': []
  'save-share-sql-history': []
}>()
</script>

<template>
  <div class="tab-panel sharing-panel">
    <div v-if="inviteCode" class="sharing-block">
      <h3 class="sharing-block__title">{{ $t('team.inviteCodeTitle') }}</h3>
      <p class="sharing-block__desc">{{ $t('team.inviteCodeDesc') }}</p>
      <div class="invite-row">
        <code class="invite-code">{{ inviteCode }}</code>
        <DwButton variant="secondary" @click="emit('copy-invite-code')">
          {{ $t('team.inviteCodeCopy') }}
        </DwButton>
      </div>
    </div>

    <div class="sharing-block">
      <h3 class="sharing-block__title">{{ $t('team.teamSettingsTitle') }}</h3>
      <p class="sharing-block__desc">{{ $t('team.requireInviteApprovalDesc') }}</p>
      <label class="share-toggle">
        <input
            :checked="requireInviteApproval"
            type="checkbox"
            @change="emit('update:requireInviteApproval', ($event.target as HTMLInputElement).checked)"
        />
        <span>{{ $t('team.requireInviteApproval') }}</span>
      </label>
      <DwButton
          variant="primary"
          class="mp-action"
          :loading="savingSettings"
          :disabled="savingSettings"
          @click="emit('save-settings')"
      >
        {{ savingSettings ? $t('team.settingsSaving') : $t('team.settingsSave') }}
      </DwButton>
      <p v-if="requireInviteApproval && showInviteBadge" class="sharing-block__hint">
        {{ $t('team.pendingInvitesHint', {count: pendingInviteCount}) }}
        <button class="dw-link-btn" type="button" @click="emit('open-invites-tab')">
          {{ $t('team.openInvitesTab') }}
        </button>
      </p>
    </div>

    <div class="sharing-block">
      <h3 class="sharing-block__title">{{ $t('team.sharedConnectionsTitle') }}</h3>
      <p class="sharing-block__desc">{{ $t('team.sharedConnectionsDesc') }}</p>
      <textarea
          :value="sharedConnectionsInput"
          class="mp-input shared-input"
          rows="3"
          :placeholder="$t('team.sharedConnectionsPlaceholder')"
          @input="emit('update:sharedConnectionsInput', ($event.target as HTMLTextAreaElement).value)"
      />
      <div v-if="sharedConnectionRows.length" class="shared-access-list">
        <p class="shared-access-list__hint">{{ $t('team.connectionAccessHint') }}</p>
        <div
            v-for="row in sharedConnectionRows"
            :key="row.id"
            class="shared-access-row"
        >
          <code class="shared-access-row__id">{{ row.id }}</code>
          <DwSelect
              :model-value="row.access"
              size="sm"
              :options="connectionAccessOptions"
              @update:model-value="emit('update-connection-access', row.id, $event as ConnectionAccessLevel)"
          />
        </div>
      </div>
      <DwButton
          variant="primary"
          class="mp-action"
          :loading="savingSharedConnections"
          :disabled="savingSharedConnections"
          @click="emit('save-shared-connections')"
      >
        {{ savingSharedConnections ? $t('team.sharedConnectionsSaving') : $t('team.sharedConnectionsSave') }}
      </DwButton>
    </div>

    <div class="sharing-block">
      <h3 class="sharing-block__title">{{ $t('team.onCallConnectionsTitle') }}</h3>
      <p class="sharing-block__desc">{{ $t('team.onCallConnectionsDesc') }}</p>
      <p v-if="!sharedConnectionRows.length" class="sharing-block__hint">
        {{ $t('team.onCallConnectionsNeedShared') }}
      </p>
      <div v-else class="on-call-list">
        <label
            v-for="row in sharedConnectionRows"
            :key="row.id"
            class="on-call-row"
        >
          <input
              type="checkbox"
              :checked="onCallConnectionIds.includes(row.id)"
              @change="emit('toggle-on-call-connection', row.id)"
          />
          <code class="on-call-row__id">{{ row.id }}</code>
        </label>
      </div>
      <DwButton
          variant="primary"
          class="mp-action"
          :loading="savingOnCallConnections"
          :disabled="savingOnCallConnections || !sharedConnectionRows.length"
          @click="emit('save-on-call-connections')"
      >
        {{ savingOnCallConnections ? $t('team.onCallConnectionsSaving') : $t('team.onCallConnectionsSave') }}
      </DwButton>
    </div>

    <div class="sharing-block">
      <h3 class="sharing-block__title">{{ $t('team.sharedConsolesTitle') }}</h3>
      <p class="sharing-block__desc">{{ $t('team.sharedConsolesDesc') }}</p>
      <textarea
          :value="sharedConsolesInput"
          class="mp-input shared-input"
          rows="3"
          :placeholder="$t('team.sharedConsolesPlaceholder')"
          @input="emit('update:sharedConsolesInput', ($event.target as HTMLTextAreaElement).value)"
      />
      <DwButton
          variant="primary"
          class="mp-action"
          :loading="savingSharedConsoles"
          :disabled="savingSharedConsoles"
          @click="emit('save-shared-consoles')"
      >
        {{ savingSharedConsoles ? $t('team.sharedConsolesSaving') : $t('team.sharedConsolesSave') }}
      </DwButton>
    </div>

    <div class="sharing-block">
      <h3 class="sharing-block__title">{{ $t('team.shareSqlHistoryTitle') }}</h3>
      <p class="sharing-block__desc">{{ $t('team.shareSqlHistoryDesc') }}</p>
      <label class="share-toggle">
        <input
            :checked="shareSqlHistory"
            type="checkbox"
            @change="emit('update:shareSqlHistory', ($event.target as HTMLInputElement).checked)"
        />
        <span>{{ $t('team.shareSqlHistoryEnable') }}</span>
      </label>
      <DwButton
          variant="primary"
          class="mp-action"
          :loading="savingShareSqlHistory"
          :disabled="savingShareSqlHistory"
          @click="emit('save-share-sql-history')"
      >
        {{ savingShareSqlHistory ? $t('team.shareSqlHistorySaving') : $t('team.shareSqlHistorySave') }}
      </DwButton>
    </div>
  </div>
</template>

<style scoped>
.sharing-panel {
  display: flex;
  flex-direction: column;
  gap: var(--dw-space-8);
}

.sharing-block__title {
  margin: 0 0 var(--dw-space-2);
  font-size: var(--dw-text-xl);
  font-weight: 600;
}

.sharing-block__desc {
  margin: 0 0 var(--dw-space-5);
  font-size: var(--dw-text-sm);
  color: var(--dw-text-muted);
}

.sharing-block__hint {
  margin-top: var(--dw-space-5);
  font-size: var(--dw-text-sm);
  color: var(--dw-text-secondary);
}

.link-btn {
  margin-left: var(--dw-space-2);
  padding: 0;
  border: none;
  background: transparent;
  color: var(--dw-primary);
  font-size: inherit;
  cursor: pointer;
  text-decoration: underline;
}

.shared-input {
  width: 100%;
  min-height: 84px;
  resize: vertical;
  margin-bottom: var(--dw-space-6);
}

.shared-access-list {
  display: grid;
  gap: var(--dw-gap);
  margin-bottom: var(--dw-space-6);
}

.shared-access-list__hint {
  margin: 0;
  font-size: var(--dw-text-sm);
  color: var(--dw-text-muted);
}

.shared-access-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--dw-space-6);
  padding: var(--dw-pad-control);
  border: 1px solid var(--dw-border-light);
  border-radius: var(--dw-control-radius);
  background: var(--dw-bg-panel);
}

.shared-access-row__id {
  font-size: var(--dw-text-sm);
}

.shared-access-row :deep(.dw-select) {
  min-width: 120px;
  width: auto;
}

.on-call-list {
  display: grid;
  gap: var(--dw-gap);
  margin-bottom: var(--dw-space-6);
}

.on-call-row {
  display: flex;
  align-items: center;
  gap: var(--dw-gap-md);
  padding: var(--dw-pad-control);
  border: 1px solid var(--dw-border-light);
  border-radius: var(--dw-control-radius);
  background: var(--dw-bg-panel);
  font-size: var(--dw-text-md);
  cursor: pointer;
}

.on-call-row__id {
  font-size: var(--dw-text-sm);
}

.invite-row {
  display: flex;
  align-items: center;
  gap: var(--dw-space-6);
  flex-wrap: wrap;
}

.invite-code {
  padding: var(--dw-space-4) var(--dw-space-6);
  border-radius: var(--dw-control-radius);
  background: var(--dw-bg-muted);
  font-family: var(--dw-mono);
  font-size: var(--dw-text-lg);
  letter-spacing: 0.08em;
}

.share-toggle {
  display: flex;
  align-items: center;
  gap: var(--dw-gap);
  margin-bottom: var(--dw-space-6);
  font-size: var(--dw-text-md);
}
</style>
