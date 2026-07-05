<script setup lang="ts">
import {computed, nextTick, ref, watch} from 'vue'
import {useI18n} from 'vue-i18n'
import {DwButton, ProgressBar, StatusPill} from '@/core/components'
import {resolveLogLevelVariant, statusVariantClass} from '@/core/utils/status-variant'
import {useMigrationWizard} from '@/features/workspace/composables/useMigrationWizardInject'

const {t} = useI18n()
const w = useMigrationWizard()
const logListRef = ref<HTMLElement | null>(null)

const progressCaption = computed(() => {
    if (!w.progress) return ''
    return t('explorer.tableMigrationWizard.progress', {
        current: w.progress.currentTable ?? '—',
        completed: w.progress.completed,
        total: w.progress.total,
    })
})

watch(
    () => w.migrationRunLogs.length,
    async () => {
        await nextTick()
        const list = logListRef.value
        if (!list) return
        list.scrollTop = list.scrollHeight
    },
)
</script>

<template>
  <div class="migration-flow-panel">
    <section class="route-summary">
      <span>{{ w.source!.connectionLabel }} / {{ w.source!.database }}</span>
      <span aria-hidden="true">→</span>
      <span>{{ w.targetConnectionLabel }} / {{ w.form.targetDatabase }}</span>
    </section>

    <div v-if="w.running && w.progress" class="table-migration__running-banner migration-progress-card">
      <div class="table-migration__running-head">
        <span class="table-migration__spinner" aria-hidden="true"/>
        <strong>{{ t('explorer.tableMigrationWizard.migrating') }}</strong>
        <span class="table-migration__running-meta">{{ w.progressPercent }}%</span>
      </div>

      <div class="migration-progress-card__bar">
        <ProgressBar :value="w.progressPercent"/>
      </div>

      <div class="migration-progress-card__labels">
        <p class="table-migration__running-text">{{ progressCaption }}</p>
        <p v-if="w.progressDetailLabel" class="table-migration__running-text migration-progress-card__detail">
          {{ w.progressDetailLabel }}
        </p>
      </div>
    </div>

    <section v-if="w.migrationRunLogs.length" class="migration-run">
      <header class="migration-run__head">
        <h3>{{ t('explorer.tableMigrationWizard.migrationLogTitle') }}</h3>
        <DwButton variant="secondary" size="sm" @click="w.openMigrationTasksPanel()">
          {{ t('explorer.tableMigrationWizard.viewTaskPanel') }}
        </DwButton>
      </header>
      <p v-if="w.migrationRunLogsCompacted" class="migration-log-list__hint">
        {{
          t('shortcut.migration.logCompactHint', {
            shown: w.migrationRunLogs.length,
            total: w.migrationRunLogsFull.length,
          })
        }}
      </p>
      <ul ref="logListRef" class="migration-log-list migration-log-list--live">
        <li
            v-for="(line, index) in w.migrationRunLogs"
            :key="`${line.at}-${index}`"
            class="dw-log-line"
            :class="statusVariantClass(resolveLogLevelVariant(line.level))"
        >
          {{ w.formatLogLine(line) }}
        </li>
      </ul>
    </section>

    <section v-if="w.migrationResults.length" class="migration-results">
      <header class="migration-results__head">
        <h3>{{ t('explorer.tableMigrationWizard.migrationResultTitle') }}</h3>
      </header>
      <table class="detail-table">
        <thead>
          <tr>
            <th>{{ t('explorer.tableMigrationWizard.preflightTable') }}</th>
            <th>{{ t('explorer.tableMigrationWizard.validationMigratedRows') }}</th>
            <th>{{ t('explorer.tableMigrationWizard.preflightStatus') }}</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="row in w.migrationResults" :key="row.tableName">
            <td>{{ row.tableName }}</td>
            <td>{{ w.formatRowCount(row.rowsMigrated) }}</td>
            <td>
              <StatusPill
                  :status="row.status === 'success' ? 'ready' : 'blocked'"
                  domain="preflight"
              >
                {{ row.status }}
              </StatusPill>
            </td>
          </tr>
        </tbody>
      </table>
    </section>
  </div>
</template>
