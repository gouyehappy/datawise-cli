<script setup lang="ts">
import {useI18n} from 'vue-i18n'
import {DwButton, DwPanelState, DwSelect, StatusPill} from '@/core/components'
import {useMigrationWizard} from '@/features/workspace/composables/useMigrationWizardInject'

const {t} = useI18n()
const w = useMigrationWizard()
</script>

<template>
  <div class="migration-flow-panel">
    <section class="route-summary">
      <span>{{ w.source!.connectionLabel }} / {{ w.source!.database }}</span>
      <span aria-hidden="true">→</span>
      <span>{{ w.targetConnectionLabel }} / {{ w.form.targetDatabase }}</span>
      <span class="route-summary__count">{{ w.selectedCountLabel }}</span>
    </section>

    <DwPanelState
        v-if="w.preflightLoading"
        status="loading"
        :message="t('explorer.tableMigrationWizard.checking')"
    />

    <DwPanelState
        v-else-if="w.preflightError"
        status="error"
        :message="w.preflightError"
    >
      <template #actions>
        <DwButton variant="secondary" size="sm" :disabled="!w.canCheck" @click="w.runPreflight">
          {{ t('explorer.tableMigrationWizard.retryPreflight') }}
        </DwButton>
      </template>
    </DwPanelState>

    <section v-else-if="w.preflightResult" class="preflight-inspector">
      <header class="preflight-inspector__head">
        <h3>{{ t('explorer.tableMigrationWizard.preflightTitle') }}</h3>
        <div class="preflight-inspector__summary">
          <button
              type="button"
              class="preflight-filter-chip"
              :class="{ 'is-active': w.preflightStatusFilter === 'all' }"
              @click="w.setPreflightStatusFilter('all')"
          >
            {{ t('explorer.tableMigrationWizard.filterAll') }}
          </button>
          <button
              type="button"
              class="preflight-filter-chip preflight-filter-chip--ready"
              :class="{ 'is-active': w.preflightStatusFilter === 'ready' }"
              @click="w.setPreflightStatusFilter('ready')"
          >
            {{ t('explorer.tableMigrationWizard.summaryReady', {count: w.preflightResult.readyCount}) }}
          </button>
          <button
              type="button"
              class="preflight-filter-chip preflight-filter-chip--warn"
              :class="{ 'is-active': w.preflightStatusFilter === 'warn' }"
              @click="w.setPreflightStatusFilter('warn')"
          >
            {{ t('explorer.tableMigrationWizard.summaryWarn', {count: w.preflightResult.warnCount}) }}
          </button>
          <button
              type="button"
              class="preflight-filter-chip preflight-filter-chip--blocked"
              :class="{ 'is-active': w.preflightStatusFilter === 'blocked' }"
              @click="w.setPreflightStatusFilter('blocked')"
          >
            {{ t('explorer.tableMigrationWizard.summaryBlocked', {count: w.preflightResult.blockedCount}) }}
          </button>
          <span v-if="w.migrateTablesCount" class="preflight-inspector__migrate-count">
            {{ t('explorer.tableMigrationWizard.footerHintPreflightReady', {count: w.migrateTablesCount}) }}
          </span>
        </div>
      </header>

      <section
          v-if="w.form.mode === 'INCR_APPEND' || w.recommendedWatermarkColumns.length"
          class="preflight-sort-options"
      >
        <h4>{{ t('explorer.tableMigrationWizard.sortOptionsTitle') }}</h4>
        <label v-if="w.form.mode === 'INCR_APPEND'" class="preflight-sort-options__field">
          <span>{{ t('explorer.tableMigrationWizard.watermarkColumn') }}</span>
          <DwSelect
              v-if="w.watermarkColumnSelectOptions.length"
              v-model="w.form.watermarkColumn"
              :placeholder="t('explorer.tableMigrationWizard.watermarkColumnPlaceholder')"
              :options="w.watermarkColumnSelectOptions"
              :disabled="w.running"
          />
          <input
              v-else
              v-model="w.form.watermarkColumn"
              class="preflight-sort-options__input"
              type="text"
              :placeholder="t('explorer.tableMigrationWizard.watermarkColumnPlaceholder')"
              :disabled="w.running"
          >
          <p class="preflight-sort-options__hint">{{ t('explorer.tableMigrationWizard.watermarkColumnHint') }}</p>
        </label>
        <div v-if="w.recommendedWatermarkColumns.length" class="preflight-sort-options__field">
          <span>{{ t('explorer.tableMigrationWizard.orderByColumns') }}</span>
          <div class="preflight-sort-options__checks">
            <label
                v-for="column in w.recommendedWatermarkColumns"
                :key="`order-${column}`"
                class="preflight-sort-options__check"
            >
              <input
                  type="checkbox"
                  :checked="w.form.orderByColumns.includes(column)"
                  :disabled="w.running"
                  @change="w.toggleOrderByColumn(column, ($event.target as HTMLInputElement).checked)"
              >
              {{ column }}
            </label>
          </div>
          <p class="preflight-sort-options__hint">{{ t('explorer.tableMigrationWizard.orderByColumnsHint') }}</p>
        </div>
      </section>

      <div class="preflight-inspector__grid">
        <aside class="preflight-inspector__list" :aria-label="t('explorer.tableMigrationWizard.preflightTitle')">
          <p v-if="!w.filteredPreflightTables.length" class="preflight-inspector__empty">
            {{ t('explorer.tableMigrationWizard.preflightFilterEmpty') }}
          </p>
          <button
              v-for="row in w.filteredPreflightTables"
              :key="row.tableName"
              type="button"
              class="preflight-list-item"
              :class="[`is-${row.status}`, { 'is-active': w.selectedPreflightTable === row.tableName }]"
              @click="w.selectPreflightTable(row.tableName)"
          >
            <span class="preflight-list-item__name">{{ row.tableName }}</span>
            <StatusPill :status="row.status" domain="preflight">{{ w.formatStatus(row.status) }}</StatusPill>
            <span class="preflight-list-item__meta">
              {{ w.formatRowCount(row.sourceRowCount) }} → {{ w.formatRowCount(row.targetRowCount) }}
            </span>
            <span v-if="row.issues.length" class="preflight-list-item__issues">
              {{ row.issues.map(w.formatIssue).join(' · ') }}
            </span>
          </button>
        </aside>

        <div class="preflight-inspector__detail">
          <template v-if="w.selectedPreflightDetail">
            <header class="preflight-detail__head">
              <div>
                <h4>{{ w.selectedPreflightDetail.tableName }}</h4>
                <p class="preflight-detail__stats">
                  {{ t('explorer.tableMigrationWizard.preflightSourceRows') }}:
                  {{ w.formatRowCount(w.selectedPreflightDetail.sourceRowCount) }}
                  ·
                  {{ t('explorer.tableMigrationWizard.preflightTargetRows') }}:
                  {{ w.formatRowCount(w.selectedPreflightDetail.targetRowCount) }}
                </p>
              </div>
              <StatusPill :status="w.selectedPreflightDetail.status" domain="preflight">
                {{ w.formatStatus(w.selectedPreflightDetail.status) }}
              </StatusPill>
            </header>

            <div v-if="w.selectedPreflightDetail.issues.length" class="preflight-detail__section">
              <strong>{{ t('explorer.tableMigrationWizard.preflightIssues') }}</strong>
              <ul class="preflight-issues">
                <li v-for="issue in w.selectedPreflightDetail.issues" :key="issue">
                  {{ w.formatIssue(issue) }}
                </li>
              </ul>
            </div>

            <div
                v-if="w.selectedPreflightDetail.suggestedWatermarkColumns.length"
                class="preflight-detail__section"
            >
              <strong>{{ t('explorer.tableMigrationWizard.preflightWatermark') }}</strong>
              <p class="preflight-detail__text">
                {{ w.selectedPreflightDetail.suggestedWatermarkColumns.join(', ') }}
              </p>
            </div>

            <div v-if="w.selectedPreflightDetail.mappingWarnings.length" class="preflight-detail__section">
              <strong>{{ t('explorer.tableMigrationWizard.mappingWarningsTitle') }}</strong>
              <ul class="preflight-detail__warnings">
                <li v-for="warning in w.selectedPreflightDetail.mappingWarnings" :key="warning">
                  {{ w.formatMappingWarning(warning) }}
                </li>
              </ul>
            </div>

            <div v-if="w.selectedPreflightDetail.columnMappings.length" class="preflight-detail__section">
              <h4>{{ t('explorer.tableMigrationWizard.typeMappingTitle') }}</h4>
              <table class="detail-table">
                <thead>
                  <tr>
                    <th>{{ t('explorer.tableMigrationWizard.preflightTable') }}</th>
                    <th>{{ t('explorer.tableMigrationWizard.typeMappingSource') }}</th>
                    <th>{{ t('explorer.tableMigrationWizard.typeMappingTarget') }}</th>
                  </tr>
                </thead>
                <tbody>
                  <tr
                      v-for="mapping in w.selectedPreflightDetail.columnMappings"
                      :key="mapping.columnName"
                      :class="{ 'is-warn': mapping.warning }"
                  >
                    <td>{{ mapping.columnName }}</td>
                    <td>{{ mapping.sourceType }}</td>
                    <td>
                      {{ mapping.targetType }}
                      <StatusPill v-if="mapping.warning" variant="warn" class="preflight-detail__warn-pill">
                        {{ w.formatMappingWarning(mapping.warning) }}
                      </StatusPill>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>

            <div v-if="w.selectedPreflightDetail.suggestedCreateDdl" class="preflight-detail__section">
              <header class="preflight-detail__ddl-head">
                <h4>{{ t('explorer.tableMigrationWizard.suggestedCreateDdl') }}</h4>
                <DwButton variant="secondary" size="sm" @click="w.copySuggestedDdl">
                  {{ t('explorer.tableMigrationWizard.copyDdl') }}
                </DwButton>
              </header>
              <pre class="preflight-detail__ddl">{{ w.selectedPreflightDetail.suggestedCreateDdl }}</pre>
            </div>
          </template>
          <p v-else class="preflight-inspector__hint">
            {{ t('explorer.tableMigrationWizard.preflightDetailHint') }}
          </p>
        </div>
      </div>
    </section>

    <p v-else class="migration-flow-panel__hint">
      {{ t('explorer.tableMigrationWizard.preflightStartHint') }}
    </p>
  </div>
</template>
