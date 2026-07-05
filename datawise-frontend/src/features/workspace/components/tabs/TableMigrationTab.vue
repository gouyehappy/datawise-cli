<script setup lang="ts">
import {provide} from 'vue'
import {useI18n} from 'vue-i18n'
import type {WorkspaceTab} from '@/core/types'
import {EmptyState} from '@/core/components'
import MigrationWizardSteps from '@/features/workspace/components/migration/MigrationWizardSteps.vue'
import MigrationConfigureStep from '@/features/workspace/components/migration/MigrationConfigureStep.vue'
import MigrationPreflightStep from '@/features/workspace/components/migration/MigrationPreflightStep.vue'
import MigrationRunningStep from '@/features/workspace/components/migration/MigrationRunningStep.vue'
import MigrationCompleteStep from '@/features/workspace/components/migration/MigrationCompleteStep.vue'
import MigrationWizardFooter from '@/features/workspace/components/migration/MigrationWizardFooter.vue'
import {MIGRATION_WIZARD_KEY, type MigrationFlowStep} from '@/features/workspace/components/migration/migration-wizard.types'
import {useTableMigrationWizard} from '@/features/workspace/composables/useTableMigrationWizard'

const props = defineProps<{ tab: WorkspaceTab }>()

const {t} = useI18n()
const wizard = useTableMigrationWizard(props.tab)

provide(MIGRATION_WIZARD_KEY, wizard)
</script>

<template>
  <div v-if="wizard.source" class="table-migration" :class="{ 'table-migration--running': wizard.running }">
    <header class="table-migration__toolbar">
      <div class="table-migration__toolbar-main">
        <h2>{{ t('explorer.tableMigrationWizard.title') }}</h2>
        <p v-if="wizard.wizardStep === 'configure'" class="table-migration__subtitle">
          {{ t('explorer.tableMigrationWizard.subtitle') }}
        </p>
        <MigrationWizardSteps
            :steps="wizard.wizardSteps"
            :active-step="wizard.wizardStep"
            :ariaLabel="t('explorer.tableMigrationWizard.flowTitle')"
            :is-step-accessible="(id) => wizard.isFlowStepAccessible(id as MigrationFlowStep)"
            :is-step-completed="(id) => wizard.isFlowStepCompleted(id as MigrationFlowStep)"
            @step-click="wizard.goToFlowStep"
        />
        <p v-if="wizard.formError && !wizard.running" class="table-migration__error">{{ wizard.formError }}</p>
      </div>
    </header>

    <div class="table-migration__body">
      <MigrationConfigureStep v-show="wizard.wizardStep === 'configure'"/>
      <MigrationPreflightStep v-show="wizard.wizardStep === 'preflight'"/>
      <MigrationRunningStep v-show="wizard.wizardStep === 'running'"/>
      <MigrationCompleteStep v-show="wizard.wizardStep === 'complete'"/>
    </div>

    <MigrationWizardFooter/>
  </div>
  <EmptyState v-else embedded :title="t('explorer.tableMigrationContextMissing')"/>
</template>
