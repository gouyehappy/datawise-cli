<script setup lang="ts">
import {computed, ref, watch} from 'vue'
import {useI18n} from 'vue-i18n'
import type {WorkspaceTab} from '@/core/types'
import {DwButton, DwInlineAlert, EmptyState, StatusPill} from '@/core/components'
import DwSelect from '@/core/components/DwSelect.vue'
import type {SelectOption} from '@/core/components/select.types'
import {
    resolveConnectionEnvironmentLabel,
    resolveConnectionEnvironmentVariant,
} from '@/features/connection/services/connection-environment.service'
import {
    clampCrossEnvSampleRowCount,
    CROSS_ENV_COMPARE_SAMPLE_DEFAULT,
    CROSS_ENV_COMPARE_SAMPLE_MAX,
    CrossEnvCompareSideError,
    crossEnvCompareTabStateKey,
    resolveConnectionEnvFromTree,
    resolveInitialCrossEnvCompareStep,
    scopesReadyForCompare,
    validateCrossEnvCompareSql,
    type CrossEnvCompareStep,
} from '@/features/cross-env-compare/services/cross-env-compare.service'
import {executeCrossEnvSampleCompare} from '@/features/cross-env-compare/services/cross-env-compare.actions'
import {useExplorerStore} from '@/features/explorer/stores/explorer'
import {extractConnectionsFromTree} from '@/features/explorer/utils/tree-targets'
import type {SchemaScope} from '@/features/schema-compare/types/schema-compare.types'
import {scopesEqual} from '@/features/schema-compare/services/schema-scope.service'
import QueryResultDiffPanel from '@/features/workspace/components/QueryResultDiffPanel.vue'
import MigrationWizardSteps from '@/features/workspace/components/migration/MigrationWizardSteps.vue'
import {useLayoutStore} from '@/features/layout/stores/layout'
import type {QueryResultDiffView} from '@/features/workspace/services/query-result-diff.service'

const props = defineProps<{ tab: WorkspaceTab }>()

const {t} = useI18n()
const explorer = useExplorerStore()
const layout = useLayoutStore()

const wizardStep = ref<CrossEnvCompareStep>(
    resolveInitialCrossEnvCompareStep({
        left: props.tab.crossEnvCompareLeft,
        right: props.tab.crossEnvCompareRight,
        sql: props.tab.crossEnvCompareSql,
    }),
)
const leftScope = ref<SchemaScope | null>(props.tab.crossEnvCompareLeft ?? null)
const rightScope = ref<SchemaScope | null>(props.tab.crossEnvCompareRight ?? null)
const sql = ref(props.tab.crossEnvCompareSql ?? '')
const sampleRows = ref(CROSS_ENV_COMPARE_SAMPLE_DEFAULT)
const comparing = ref(false)
const formError = ref<string | null>(null)
const diffView = ref<QueryResultDiffView | null>(null)

const connections = computed(() => extractConnectionsFromTree(explorer.tree))

const wizardSteps = computed(() => [
    {id: 'baseline' as const, label: t('crossEnvCompare.flowSteps.baseline'), number: 1},
    {id: 'target' as const, label: t('crossEnvCompare.flowSteps.target'), number: 2},
    {id: 'query' as const, label: t('crossEnvCompare.flowSteps.query'), number: 3},
    {id: 'diff' as const, label: t('crossEnvCompare.flowSteps.diff'), number: 4},
])

const connectionOptions = computed<SelectOption[]>(() => [
    {value: '', label: t('crossEnvCompare.selectConnection')},
    ...connections.value.map((conn) => ({
        value: conn.id,
        label: `${conn.groupLabel} / ${conn.label}`,
    })),
])

function databaseOptions(databases: { id: string; label: string }[]): SelectOption[] {
    return [
        {value: '', label: t('crossEnvCompare.selectDatabase')},
        ...databases.map((item) => ({value: item.label, label: item.label})),
    ]
}

function buildScope(connectionId: string, database: string): SchemaScope | null {
    const conn = connections.value.find((item) => item.id === connectionId)
    if (!conn || !database) return null
    return {
        connectionId: conn.id,
        connectionLabel: conn.label,
        database,
        dbType: conn.dbType,
    }
}

const leftConnectionId = computed({
    get: () => leftScope.value?.connectionId ?? '',
    set: (connectionId: string) => {
        const conn = connections.value.find((item) => item.id === connectionId)
        if (!conn) {
            leftScope.value = null
            return
        }
        const database = conn.databases[0]?.label ?? ''
        leftScope.value = buildScope(conn.id, database)
    },
})

const rightConnectionId = computed({
    get: () => rightScope.value?.connectionId ?? '',
    set: (connectionId: string) => {
        const conn = connections.value.find((item) => item.id === connectionId)
        if (!conn) {
            rightScope.value = null
            return
        }
        const database = conn.databases[0]?.label ?? ''
        rightScope.value = buildScope(conn.id, database)
    },
})

const leftDatabase = computed({
    get: () => leftScope.value?.database ?? '',
    set: (database: string) => {
        if (!leftScope.value) return
        leftScope.value = {...leftScope.value, database}
    },
})

const rightDatabase = computed({
    get: () => rightScope.value?.database ?? '',
    set: (database: string) => {
        if (!rightScope.value) return
        rightScope.value = {...rightScope.value, database}
    },
})

const leftDatabases = computed(() =>
    connections.value.find((item) => item.id === leftConnectionId.value)?.databases ?? [],
)

const rightDatabases = computed(() =>
    connections.value.find((item) => item.id === rightConnectionId.value)?.databases ?? [],
)

const leftDatabaseOptions = computed(() => databaseOptions(leftDatabases.value))
const rightDatabaseOptions = computed(() => databaseOptions(rightDatabases.value))

const leftEnv = computed(() =>
    leftScope.value
        ? resolveConnectionEnvFromTree(explorer.tree, leftScope.value.connectionId)
        : null,
)

const rightEnv = computed(() =>
    rightScope.value
        ? resolveConnectionEnvFromTree(explorer.tree, rightScope.value.connectionId)
        : null,
)

const sameScope = computed(() =>
    leftScope.value && rightScope.value && scopesEqual(leftScope.value, rightScope.value),
)

const canProceedBaseline = computed(() => Boolean(leftScope.value?.connectionId && leftScope.value.database))
const canProceedTarget = computed(() => scopesReadyForCompare(leftScope.value, rightScope.value))
const canCompare = computed(() => {
    if (!canProceedTarget.value) return false
    return validateCrossEnvCompareSql(sql.value) === null
})

function isStepCompleted(step: CrossEnvCompareStep): boolean {
    if (step === 'baseline') return canProceedBaseline.value
    if (step === 'target') return canProceedTarget.value
    if (step === 'query') return Boolean(diffView.value)
    if (step === 'diff') return Boolean(diffView.value)
    return false
}

function isStepAccessible(step: CrossEnvCompareStep): boolean {
    if (step === 'baseline') return true
    if (step === 'target') return canProceedBaseline.value
    if (step === 'query') return canProceedTarget.value
    if (step === 'diff') return Boolean(diffView.value)
    return false
}

function goToStep(step: CrossEnvCompareStep) {
    if (!isStepAccessible(step) && wizardStep.value !== step) return
    wizardStep.value = step
}

function resolveErrorMessage(code: string, message?: string): string {
    const key = `crossEnvCompare.errors.${code}`
    const translated = t(key, {message: message ?? ''})
    if (translated !== key) return translated
    return message ?? t('crossEnvCompare.compareFailed')
}

function goNext() {
    formError.value = null
    if (wizardStep.value === 'baseline') {
        if (!canProceedBaseline.value) return
        wizardStep.value = 'target'
        return
    }
    if (wizardStep.value === 'target') {
        if (!canProceedTarget.value) {
            formError.value = resolveErrorMessage('sameScope')
            return
        }
        wizardStep.value = 'query'
    }
}

function goBack() {
    formError.value = null
    if (wizardStep.value === 'target') wizardStep.value = 'baseline'
    else if (wizardStep.value === 'query') wizardStep.value = 'target'
    else if (wizardStep.value === 'diff') wizardStep.value = 'query'
}

async function runCompare() {
    formError.value = null
    if (!leftScope.value || !rightScope.value || !leftEnv.value || !rightEnv.value) return

    const sqlError = validateCrossEnvCompareSql(sql.value)
    if (sqlError) {
        formError.value = resolveErrorMessage(sqlError)
        return
    }
    if (!canProceedTarget.value) {
        formError.value = resolveErrorMessage('sameScope')
        return
    }

    comparing.value = true
    diffView.value = null
    try {
        const result = await executeCrossEnvSampleCompare({
            left: leftScope.value,
            right: rightScope.value,
            leftEnv: leftEnv.value,
            rightEnv: rightEnv.value,
            sql: sql.value,
            sampleRows: clampCrossEnvSampleRowCount(sampleRows.value),
            translate: t,
        })
        diffView.value = result.diff
        wizardStep.value = 'diff'
        layout.showSuccessToast(t('crossEnvCompare.compareDone'))
    } catch (error) {
        if (error instanceof CrossEnvCompareSideError) {
            formError.value = resolveErrorMessage(
                error.side === 'left' ? 'leftFailed' : 'rightFailed',
                error.message,
            )
        } else if (error instanceof Error) {
            formError.value = resolveErrorMessage(error.message, error.message)
        } else {
            formError.value = t('crossEnvCompare.compareFailed')
        }
    } finally {
        comparing.value = false
    }
}

function exitDiff() {
    wizardStep.value = 'query'
}

function resetCompare() {
    diffView.value = null
    wizardStep.value = 'baseline'
    formError.value = null
}

function syncFromTab(tab: WorkspaceTab) {
    leftScope.value = tab.crossEnvCompareLeft ?? null
    rightScope.value = tab.crossEnvCompareRight ?? null
    sql.value = tab.crossEnvCompareSql ?? ''
    diffView.value = null
    formError.value = null
    wizardStep.value = resolveInitialCrossEnvCompareStep({
        left: leftScope.value,
        right: rightScope.value,
        sql: sql.value,
    })
}

function localTabStateKey(): string {
    return crossEnvCompareTabStateKey({
        left: leftScope.value,
        right: rightScope.value,
        sql: sql.value,
    })
}

watch(leftScope, (value) => {
    props.tab.crossEnvCompareLeft = value ?? undefined
})
watch(rightScope, (value) => {
    props.tab.crossEnvCompareRight = value ?? undefined
})
watch(sql, (value) => {
    props.tab.crossEnvCompareSql = value.trim() ? value : undefined
})

watch(
    () => crossEnvCompareTabStateKey({
        left: props.tab.crossEnvCompareLeft,
        right: props.tab.crossEnvCompareRight,
        sql: props.tab.crossEnvCompareSql,
    }),
    (key) => {
        if (key === localTabStateKey()) return
        syncFromTab(props.tab)
    },
)
</script>

<template>
  <div class="cross-env-compare">
    <header class="cross-env-compare__head">
      <div>
        <h2>{{ t('crossEnvCompare.title') }}</h2>
        <p>{{ t('crossEnvCompare.subtitle') }}</p>
        <MigrationWizardSteps
            :steps="wizardSteps"
            :active-step="wizardStep"
            :ariaLabel="t('crossEnvCompare.flowTitle')"
            :is-step-accessible="(id) => isStepAccessible(id as CrossEnvCompareStep)"
            :is-step-completed="(id) => isStepCompleted(id as CrossEnvCompareStep)"
            @step-click="(id) => goToStep(id as CrossEnvCompareStep)"
        />
        <DwInlineAlert :message="formError"/>
        <p v-if="!formError && sameScope && wizardStep !== 'baseline'" class="cross-env-compare__hint">
          {{ t('crossEnvCompare.sameScopeHint') }}
        </p>
      </div>
    </header>

    <div v-if="wizardStep === 'baseline'" class="cross-env-compare__panel">
      <div class="scope-card">
        <h3>{{ t('crossEnvCompare.baselineTitle') }}</h3>
        <label class="scope-field">
          <span>{{ t('crossEnvCompare.connection') }}</span>
          <DwSelect v-model="leftConnectionId" size="sm" :options="connectionOptions"/>
        </label>
        <label class="scope-field">
          <span>{{ t('crossEnvCompare.database') }}</span>
          <DwSelect
              v-model="leftDatabase"
              size="sm"
              :options="leftDatabaseOptions"
              :disabled="!leftConnectionId"
          />
        </label>
        <div v-if="leftScope && leftEnv" class="scope-meta">
          <StatusPill
              chip
              :variant="resolveConnectionEnvironmentVariant(leftEnv.env)"
          >
            {{ resolveConnectionEnvironmentLabel(leftEnv.env, leftEnv.envCustom, t) }}
          </StatusPill>
          <span>{{ leftScope.connectionLabel }} / {{ leftScope.database }}</span>
        </div>
      </div>
    </div>

    <div v-else-if="wizardStep === 'target'" class="cross-env-compare__panel">
      <div class="scope-card">
        <h3>{{ t('crossEnvCompare.targetTitle') }}</h3>
        <label class="scope-field">
          <span>{{ t('crossEnvCompare.connection') }}</span>
          <DwSelect v-model="rightConnectionId" size="sm" :options="connectionOptions"/>
        </label>
        <label class="scope-field">
          <span>{{ t('crossEnvCompare.database') }}</span>
          <DwSelect
              v-model="rightDatabase"
              size="sm"
              :options="rightDatabaseOptions"
              :disabled="!rightConnectionId"
          />
        </label>
        <div v-if="rightScope && rightEnv" class="scope-meta">
          <StatusPill
              chip
              :variant="resolveConnectionEnvironmentVariant(rightEnv.env)"
          >
            {{ resolveConnectionEnvironmentLabel(rightEnv.env, rightEnv.envCustom, t) }}
          </StatusPill>
          <span>{{ rightScope.connectionLabel }} / {{ rightScope.database }}</span>
        </div>
      </div>
    </div>

    <div v-else-if="wizardStep === 'query'" class="cross-env-compare__panel cross-env-compare__panel--query">
      <label class="scope-field scope-field--full">
        <span>{{ t('crossEnvCompare.sql') }}</span>
        <textarea
            v-model="sql"
            class="sql-input"
            rows="8"
            :placeholder="t('crossEnvCompare.sqlPlaceholder')"
        />
        <span class="scope-field__hint">{{ t('crossEnvCompare.sqlHint') }}</span>
      </label>
      <label class="scope-field">
        <span>{{ t('crossEnvCompare.sampleRows') }}</span>
        <input
            v-model.number="sampleRows"
            class="sample-input"
            type="number"
            min="1"
            :max="CROSS_ENV_COMPARE_SAMPLE_MAX"
        />
        <span class="scope-field__hint">
          {{ t('crossEnvCompare.sampleRowsHint', {max: CROSS_ENV_COMPARE_SAMPLE_MAX}) }}
        </span>
      </label>
    </div>

    <div v-else-if="wizardStep === 'diff' && diffView" class="cross-env-compare__diff">
      <QueryResultDiffPanel :diff="diffView" @exit="exitDiff"/>
    </div>

    <EmptyState
        v-else-if="wizardStep === 'diff'"
        embedded
        :title="t('crossEnvCompare.compareFailed')"
    />

    <footer v-if="wizardStep !== 'diff'" class="cross-env-compare__footer">
      <DwButton
          v-if="wizardStep !== 'baseline'"
          variant="secondary"
          size="sm"
          @click="goBack"
      >
        {{ t('crossEnvCompare.back') }}
      </DwButton>
      <div class="cross-env-compare__footer-spacer"/>
      <DwButton
          v-if="wizardStep === 'query'"
          variant="primary"
          size="sm"
          :disabled="!canCompare || comparing"
          :loading="comparing"
          @click="runCompare"
      >
        {{ comparing ? t('crossEnvCompare.comparing') : t('crossEnvCompare.compareAction') }}
      </DwButton>
      <DwButton
          v-else
          variant="primary"
          size="sm"
          :disabled="wizardStep === 'baseline' ? !canProceedBaseline : !canProceedTarget"
          @click="goNext"
      >
        {{ t('crossEnvCompare.next') }}
      </DwButton>
    </footer>

    <footer v-else class="cross-env-compare__footer">
      <DwButton variant="secondary" size="sm" @click="resetCompare">
        {{ t('crossEnvCompare.rerun') }}
      </DwButton>
    </footer>
  </div>
</template>

<style scoped>
.cross-env-compare {
  display: flex;
  flex-direction: column;
  height: 100%;
  min-height: 0;
  background: var(--dw-bg-editor);
}

.cross-env-compare__head {
  padding: var(--dw-space-8) var(--dw-space-9) var(--dw-space-6);
  border-bottom: 1px solid var(--dw-border-light);
}

.cross-env-compare__head h2 {
  margin: 0 0 var(--dw-space-2);
  font-size: var(--dw-text-xl);
}

.cross-env-compare__head p {
  margin: 0;
  color: var(--dw-text-muted);
  font-size: var(--dw-text-sm);
}

.cross-env-compare__hint {
  margin: var(--dw-space-5) 0 0;
  color: var(--dw-text-secondary);
  font-size: var(--dw-text-sm);
}

.cross-env-compare__panel {
  flex: 1;
  min-height: 0;
  overflow: auto;
  padding: var(--dw-space-9);
}

.cross-env-compare__panel--query {
  display: flex;
  flex-direction: column;
  gap: var(--dw-space-8);
  max-width: 720px;
}

.cross-env-compare__diff {
  flex: 1;
  min-height: 0;
}

.scope-card {
  max-width: 420px;
  padding: var(--dw-space-8);
  border: 1px solid var(--dw-border-light);
  border-radius: var(--dw-radius-xl);
  background: var(--dw-bg-panel);
}

.scope-card h3 {
  margin: 0 0 var(--dw-space-6);
  font-size: var(--dw-text-md);
}

.scope-field {
  display: flex;
  flex-direction: column;
  gap: var(--dw-gap-sm);
  margin-bottom: var(--dw-space-6);
  font-size: var(--dw-text-sm);
}

.scope-field--full {
  max-width: none;
}

.scope-field__hint {
  color: var(--dw-text-muted);
  font-size: var(--dw-text-xs);
  line-height: var(--dw-leading);
}

.scope-meta {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: var(--dw-gap);
  margin-top: var(--dw-space-2);
  font-size: var(--dw-text-sm);
  color: var(--dw-text-secondary);
}

.sql-input,
.sample-input {
  width: 100%;
  padding: var(--dw-pad-control-lg);
  border: 1px solid var(--dw-border-light);
  border-radius: var(--dw-control-radius);
  background: var(--dw-bg);
  color: var(--dw-text);
  font-family: var(--dw-mono);
  font-size: var(--dw-text-sm);
}

.sample-input {
  max-width: 160px;
  font-family: inherit;
}

.cross-env-compare__footer {
  display: flex;
  align-items: center;
  gap: var(--dw-gap);
  padding: var(--dw-space-6) var(--dw-space-9);
  border-top: 1px solid var(--dw-border-light);
  background: var(--dw-bg-panel);
}

.cross-env-compare__footer-spacer {
  flex: 1;
}
</style>
