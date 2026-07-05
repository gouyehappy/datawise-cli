<script setup lang="ts">
import {computed, ref, watch} from 'vue'
import {useI18n} from 'vue-i18n'
import type {ProductionApprovalTeamOption} from '@/features/team/services/production-approval-policy.service'
import {AppModal, FormField, ModalActions} from '@/core/components'

const props = defineProps<{
    open: boolean
    saving?: boolean
    sql: string
    connectionName?: string
    database?: string
    teams: ProductionApprovalTeamOption[]
}>()

const emit = defineEmits<{
    'update:open': [value: boolean]
    submit: [teamId: string]
}>()

const {t} = useI18n()
const selectedTeamId = ref('')

const canSubmit = computed(() => selectedTeamId.value.trim().length > 0 && props.sql.trim().length > 0)

watch(
    () => props.open,
    (open) => {
        if (!open) return
        selectedTeamId.value = props.teams[0]?.teamId ?? ''
    },
    {immediate: true},
)

function close() {
    emit('update:open', false)
}

function submit() {
    if (!canSubmit.value) return
    emit('submit', selectedTeamId.value)
}
</script>

<template>
  <AppModal
      :open="open"
      :title="t('console.productionApproval.dialogTitle')"
      :subtitle="t('console.productionApproval.dialogHint')"
      width="560px"
      @close="close"
  >
    <form class="modal-form" @submit.prevent="submit">
      <FormField v-if="teams.length > 1" :label="t('console.productionApproval.teamField')">
        <template #default="{ id }">
          <select :id="id" v-model="selectedTeamId" class="dw-input">
            <option v-for="team in teams" :key="team.teamId" :value="team.teamId">
              {{ team.teamName }}
            </option>
          </select>
        </template>
      </FormField>

      <FormField :label="t('console.productionApproval.connectionField')">
        <template #default="{ id }">
          <input
              :id="id"
              class="dw-input"
              type="text"
              readonly
              :value="[connectionName, database].filter(Boolean).join(' · ') || '—'"
          />
        </template>
      </FormField>

      <FormField :label="t('console.productionApproval.sqlField')">
        <template #default="{ id }">
          <textarea :id="id" class="modal-textarea" readonly rows="8" :value="sql" />
        </template>
      </FormField>
    </form>

    <template #footer>
      <ModalActions
          :confirm-label="saving ? t('console.productionApproval.submitting') : t('console.productionApproval.submitAction')"
          :confirm-disabled="!canSubmit || saving"
          @cancel="close"
          @confirm="submit"
      />
    </template>
  </AppModal>
</template>
