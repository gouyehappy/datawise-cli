<script setup lang="ts">
import {useI18n} from 'vue-i18n'
import {DwButton, DwCheckbox, DwInlineAlert, DwInput} from '@/core/components'
import DwSelect from '@/core/components/DwSelect.vue'
import {
    MIGRATION_BATCH_SIZE_MAX,
    MIGRATION_BATCH_SIZE_MIN,
    MIGRATION_THROTTLE_MAX_MS,
    type TableMigrationWizardForm,
} from '@/features/explorer/services/table-migration.service'
import {useMigrationWizard} from '@/features/workspace/composables/useMigrationWizardInject'

const {t} = useI18n()
const w = useMigrationWizard()

const migrationModes: Array<{value: TableMigrationWizardForm['mode']; labelKey: string}> = [
    {value: 'FULL_APPEND', labelKey: 'explorer.tableMigrationWizard.modeFullAppend'},
    {value: 'FULL_REPLACE', labelKey: 'explorer.tableMigrationWizard.modeFullReplace'},
    {value: 'INCR_APPEND', labelKey: 'explorer.tableMigrationWizard.modeIncrAppend'},
]
</script>

<template>
  <div class="migration-flow-panel">
    <section class="table-migration__route">
      <div class="route-card route-card--source">
        <h3>{{ t('explorer.tableMigrationWizard.source') }}</h3>
        <p class="route-card__connection">{{ w.source!.connectionLabel }}</p>
        <p class="route-card__database">{{ w.source!.database }}</p>
      </div>

      <span class="table-migration__arrow" aria-hidden="true">→</span>

      <div class="route-card route-card--target">
        <h3>{{ t('explorer.tableMigrationWizard.target') }}</h3>
        <label class="route-field">
          <span>{{ t('explorer.tableMigrationWizard.targetConnection') }}</span>
          <DwSelect
              v-model="w.form.targetConnectionId"
              :placeholder="t('explorer.tableMigrationWizard.pickConnection')"
              :options="w.targetConnectionOptions"
              :disabled="w.running"
          />
        </label>
        <label class="route-field">
          <span>{{ t('explorer.tableMigrationWizard.targetDatabase') }}</span>
          <DwSelect
              v-if="w.targetDatabases.length"
              v-model="w.form.targetDatabase"
              :placeholder="t('explorer.tableMigrationWizard.pickDatabase')"
              :options="w.targetDatabaseOptions"
              :disabled="w.running || !w.form.targetConnectionId"
          />
          <DwInput
              v-else
              v-model="w.form.targetDatabase"
              type="text"
              :placeholder="t('explorer.tableMigrationWizard.targetDatabaseManual')"
              :disabled="w.running || !w.form.targetConnectionId"
          />
        </label>
      </div>
    </section>

    <div class="setup-grid">
      <section class="tables-panel">
        <header class="tables-panel__head">
          <h3>{{ t('explorer.tableMigrationWizard.tables') }}</h3>
          <span class="tables-panel__meta">{{ w.selectedCountLabel }}</span>
        </header>
        <div class="tables-panel__toolbar">
          <DwInput
              v-model="w.tableFilter"
              class="tables-panel__search"
              type="search"
              :placeholder="t('explorer.tableMigrationWizard.tableFilter')"
              :disabled="w.running || w.tablesLoading"
          />
          <DwCheckbox
              v-model="w.showSelectedOnly"
              class="tables-panel__check"
              :label="t('explorer.tableMigrationWizard.showSelectedOnly')"
              :disabled="w.running || w.tablesLoading || !w.form.selectedTables.length"
          />
          <DwCheckbox
              v-model="w.allSelected"
              class="tables-panel__check"
              :label="t('explorer.tableMigrationWizard.selectAll')"
              :disabled="w.running || w.tablesLoading || !w.filteredTables.length"
          />
          <DwButton
              v-if="w.form.selectedTables.length"
              variant="ghost"
              size="sm"
              class="tables-panel__clear"
              :disabled="w.running"
              @click="w.clearSelection"
          >
            {{ t('explorer.tableMigrationWizard.clearSelection') }}
          </DwButton>
        </div>
        <div v-if="w.form.selectedTables.length" class="tables-panel__chips">
          <button
              v-for="name in w.form.selectedTables"
              :key="name"
              type="button"
              class="tables-panel__chip"
              :disabled="w.running"
              :title="t('explorer.tableMigrationWizard.removeTable')"
              @click="w.toggleTable(name, false)"
          >
            <span class="tables-panel__chip-label">{{ name }}</span>
            <span class="tables-panel__chip-remove" aria-hidden="true">×</span>
          </button>
        </div>
        <div class="tables-panel__list">
          <p v-if="w.tablesLoading" class="tables-panel__state">
            {{ t('explorer.tableMigrationWizard.loadingTables') }}
          </p>
          <DwInlineAlert
              v-else-if="w.tablesLoadError"
              class="tables-panel__state"
              :message="t('explorer.tableMigrationWizard.loadTablesFailed')"
          />
          <template v-else-if="w.filteredTables.length">
            <label
                v-for="name in w.filteredTables"
                :key="name"
                class="tables-panel__item"
                :class="{ 'is-selected': w.form.selectedTables.includes(name) }"
            >
              <DwCheckbox
                  :model-value="w.form.selectedTables.includes(name)"
                  :disabled="w.running"
                  @update:model-value="(checked) => w.toggleTable(name, checked)"
              />
              <span class="tables-panel__item-name">{{ name }}</span>
            </label>
          </template>
          <p v-else class="tables-panel__state">{{ t('explorer.tableMigrationWizard.noTables') }}</p>
        </div>
        <footer v-if="!w.tablesLoading && !w.tablesLoadError" class="tables-panel__footer">
          {{ w.tablesListFooterLabel }}
        </footer>
      </section>

      <aside class="options-panel">
        <h3>{{ t('explorer.tableMigrationWizard.optionsTitle') }}</h3>

        <div class="options-field">
          <span>{{ t('explorer.tableMigrationWizard.migrationMode') }}</span>
          <div class="mode-segment" role="radiogroup" :aria-label="t('explorer.tableMigrationWizard.migrationMode')">
            <button
                v-for="mode in migrationModes"
                :key="mode.value"
                type="button"
                class="mode-segment__btn"
                role="radio"
                :aria-checked="w.form.mode === mode.value"
                :class="{ 'is-active': w.form.mode === mode.value }"
                :disabled="w.running"
                @click="w.form.mode = mode.value"
            >
              {{ t(mode.labelKey) }}
            </button>
          </div>
          <p class="options-field__hint">{{ t(w.modeDescriptionKey) }}</p>
        </div>

        <label class="options-field">
          <span>{{ t('explorer.tableMigrationWizard.targetMissingPolicy') }}</span>
          <DwSelect
              v-model="w.form.targetMissingPolicy"
              :options="w.targetMissingPolicyOptions"
              :disabled="w.running"
          />
        </label>

        <div v-if="w.form.mode !== 'FULL_REPLACE'" class="options-field options-field--check">
          <DwCheckbox
              v-model="w.form.truncateTarget"
              :label="t('explorer.tableMigrationWizard.truncateTarget')"
              :disabled="w.running || w.truncateLockedByMode"
          />
        </div>

        <button
            type="button"
            class="options-panel__advanced-toggle"
            :aria-expanded="w.showAdvancedOptions"
            @click="w.showAdvancedOptions = !w.showAdvancedOptions"
        >
          <span>{{ t('explorer.tableMigrationWizard.advancedOptionsTitle') }}</span>
          <span class="options-panel__advanced-chevron" :class="{ 'is-open': w.showAdvancedOptions }" aria-hidden="true"/>
        </button>

        <div v-show="w.showAdvancedOptions" class="options-panel__advanced">
          <label class="options-field">
            <span>{{ t('explorer.tableMigrationWizard.where') }}</span>
            <DwInput
                v-model="w.form.whereClause"
                type="text"
                :placeholder="t('explorer.tableMigrationWizard.wherePlaceholder')"
                :disabled="w.running"
            />
            <span class="options-field__hint">{{ t('explorer.tableMigrationWizard.whereHint') }}</span>
          </label>

          <label class="options-field">
            <span>{{ t('explorer.tableMigrationWizard.batchSize') }}</span>
            <DwInput
                v-model.number="w.form.batchSize"
                type="number"
                :min="MIGRATION_BATCH_SIZE_MIN"
                :max="MIGRATION_BATCH_SIZE_MAX"
                :disabled="w.running"
            />
          </label>

          <label class="options-field">
            <span>{{ t('explorer.tableMigrationWizard.throttleMs') }}</span>
            <DwInput
                v-model.number="w.form.throttleMs"
                type="number"
                :min="0"
                :max="MIGRATION_THROTTLE_MAX_MS"
                :disabled="w.running"
            />
          </label>
        </div>
      </aside>
    </div>
  </div>
</template>
