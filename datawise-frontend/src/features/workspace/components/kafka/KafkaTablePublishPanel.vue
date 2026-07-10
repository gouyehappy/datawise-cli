<script setup lang="ts">
import {computed, ref, watch} from 'vue'
import {useI18n} from 'vue-i18n'
import {explorerApi} from '@/api'
import {DwButton} from '@/core/components'
import DwSelect from '@/core/components/DwSelect.vue'
import type {SelectOption} from '@/core/components/select.types'
import {useExplorerStore} from '@/features/explorer/stores/explorer'
import type {PublishTableToKafkaResult} from '@/features/explorer/services/kafka-topic.service'
import {
    buildDefaultKafkaTopicForTable,
    buildKafkaTablePublishContextFromSource,
    buildPublishTableToKafkaRequest,
    createDefaultKafkaTablePublishForm,
    createDefaultKafkaTablePublishSourceForm,
    formatKafkaTablePublishSuccess,
    KAFKA_PUBLISH_MAX_INTERVAL_MS,
    KAFKA_PUBLISH_MAX_MESSAGES_CAP,
    listKafkaConnections,
    listPublishSourceConnections,
    resolveKafkaTablePublishErrorMessage,
    type KafkaTablePublishContext,
    type KafkaTablePublishForm,
    type KafkaTablePublishSourceForm,
    validateKafkaTablePublishForm,
    validateKafkaTablePublishSourceForm,
} from '@/features/explorer/services/kafka-table-publish.service'
import {fetchTablesForScope} from '@/features/explorer/services/table-migration.service'

const props = defineProps<{
    kafkaConnectionId?: string
    lockKafkaConnection?: boolean
    presetSource?: KafkaTablePublishContext | null
}>()

const {t} = useI18n()
const explorer = useExplorerStore()

const kafkaConnections = computed(() => listKafkaConnections(explorer.tree))
const needsSourceSelection = computed(() => !props.presetSource)

const form = ref<KafkaTablePublishForm>(
    createDefaultKafkaTablePublishForm(kafkaConnections.value, props.kafkaConnectionId),
)
const sourceForm = ref<KafkaTablePublishSourceForm>(createDefaultKafkaTablePublishSourceForm())
const sourceConnections = computed(() => listPublishSourceConnections(explorer.tree))
const sourceDatabases = computed(() =>
    sourceConnections.value.find((item) => item.id === sourceForm.value.sourceConnectionId)?.databases ?? [],
)
const availableTables = ref<string[]>([])
const databasesLoading = ref(false)
const tablesLoading = ref(false)
const tablesLoadError = ref(false)
const tablesResolved = ref(false)
const topicManual = ref(false)

const publishing = ref(false)
const submitError = ref<string | null>(null)
const submitResult = ref<PublishTableToKafkaResult | null>(null)
const submitAttempted = ref(false)
const touched = ref({
    sourceConnectionId: false,
    sourceDatabase: false,
    tableName: false,
    kafkaConnectionId: false,
    topic: false,
})

const sourceConnectionOptions = computed<SelectOption[]>(() =>
    sourceConnections.value.map((item) => ({value: item.id, label: item.label})),
)
const sourceDatabaseOptions = computed<SelectOption[]>(() =>
    sourceDatabases.value.map((item) => ({value: item.label, label: item.label})),
)
const sourceTableOptions = computed<SelectOption[]>(() =>
    availableTables.value.map((name) => ({value: name, label: name})),
)
const kafkaConnectionOptions = computed<SelectOption[]>(() =>
    kafkaConnections.value.map((item) => ({value: item.id, label: item.label})),
)

const resolvedContext = computed(() => {
    if (props.presetSource) return props.presetSource
    if (!needsSourceSelection.value) return null
    return buildKafkaTablePublishContextFromSource(sourceConnections.value, sourceForm.value)
})

const formValidationCode = computed(() => validateKafkaTablePublishForm(form.value, kafkaConnections.value))
const sourceValidationCode = computed(() => {
    if (!needsSourceSelection.value) return null
    return validateKafkaTablePublishSourceForm(sourceForm.value, sourceConnections.value)
})

const validationError = computed(() => {
    const code = formValidationCode.value ?? sourceValidationCode.value
    return code ? t(`explorer.kafkaTablePublish.errors.${code}`) : null
})

const canPublish = computed(() => (
    !validationError.value
    && !publishing.value
    && resolvedContext.value != null
    && submitResult.value == null
))

const successMessage = computed(() => (
    submitResult.value ? formatKafkaTablePublishSuccess(submitResult.value, t) : null
))

const footerMessage = computed(() => {
    if (submitError.value) return {text: submitError.value, tone: 'error' as const}
    if (successMessage.value) return {text: successMessage.value, tone: 'success' as const}
    if (submitAttempted.value && validationError.value) {
        return {text: validationError.value, tone: 'error' as const}
    }
    return {text: t('explorer.kafkaTablePublish.footerHint'), tone: 'muted' as const}
})

function shouldShowField(field: keyof typeof touched.value) {
    return submitAttempted.value || touched.value[field]
}

function fieldError(field: keyof typeof touched.value, code: string | null) {
    if (!shouldShowField(field) || !code) return null
    return t(`explorer.kafkaTablePublish.errors.${code}`)
}

const sourceConnectionError = computed(() => {
    if (!needsSourceSelection.value) return null
    if (!sourceConnections.value.length) return fieldError('sourceConnectionId', 'noSourceConnections')
    if (!sourceForm.value.sourceConnectionId.trim()) return fieldError('sourceConnectionId', 'sourceConnectionRequired')
    return null
})

const sourceDatabaseError = computed(() => {
    if (!needsSourceSelection.value || !shouldShowField('sourceDatabase')) return null
    if (!sourceForm.value.sourceDatabase.trim()) return t('explorer.kafkaTablePublish.errors.sourceDatabaseRequired')
    return null
})

const sourceTableError = computed(() => {
    if (!needsSourceSelection.value || !shouldShowField('tableName')) return null
    if (!sourceForm.value.tableName.trim()) return t('explorer.kafkaTablePublish.errors.sourceTableRequired')
    return null
})

const kafkaConnectionError = computed(() => {
    if (!shouldShowField('kafkaConnectionId')) return null
    if (!kafkaConnections.value.length) return t('explorer.kafkaTablePublish.errors.noKafkaConnections')
    if (!form.value.kafkaConnectionId.trim()) return t('explorer.kafkaTablePublish.errors.kafkaConnectionRequired')
    return null
})

const topicError = computed(() => {
    if (!shouldShowField('topic')) return null
    if (!form.value.topic.trim()) return t('explorer.kafkaTablePublish.errors.topicRequired')
    return null
})

function touchField(field: keyof typeof touched.value) {
    touched.value[field] = true
}

function applyTopicForTable(tableName: string) {
    if (topicManual.value) return
    form.value.topic = buildDefaultKafkaTopicForTable(tableName)
}

function onTopicInput() {
    topicManual.value = true
    touchField('topic')
}

function applyPresetSource(source: KafkaTablePublishContext | null | undefined) {
    if (!source) {
        sourceForm.value = createDefaultKafkaTablePublishSourceForm()
        return
    }
    sourceForm.value = {
        sourceConnectionId: source.sourceConnectionId,
        sourceDatabase: source.sourceDatabase,
        tableName: source.tableName,
    }
    topicManual.value = false
    applyTopicForTable(source.tableName)
}

function resetFormState() {
    form.value = createDefaultKafkaTablePublishForm(kafkaConnections.value, props.kafkaConnectionId)
    applyPresetSource(props.presetSource)
    availableTables.value = []
    databasesLoading.value = false
    tablesLoading.value = false
    tablesLoadError.value = false
    tablesResolved.value = false
    topicManual.value = false
    publishing.value = false
    submitError.value = null
    submitResult.value = null
    submitAttempted.value = false
    touched.value = {
        sourceConnectionId: false,
        sourceDatabase: false,
        tableName: false,
        kafkaConnectionId: false,
        topic: false,
    }
}

watch(
    () => [props.kafkaConnectionId, props.presetSource] as const,
    ([kafkaConnectionId, presetSource]) => {
        form.value = createDefaultKafkaTablePublishForm(kafkaConnections.value, kafkaConnectionId)
        applyPresetSource(presetSource)
        submitError.value = null
        submitResult.value = null
        submitAttempted.value = false
    },
    {immediate: true},
)

watch(
    kafkaConnections,
    (connections) => {
        if (!form.value.kafkaConnectionId && connections[0]) {
            form.value.kafkaConnectionId = connections[0].id
        }
        if (props.kafkaConnectionId && connections.some((item) => item.id === props.kafkaConnectionId)) {
            form.value.kafkaConnectionId = props.kafkaConnectionId
        }
    },
    {immediate: true},
)

watch(
    () => sourceForm.value.sourceConnectionId,
    async (connectionId, previousConnectionId) => {
        if (props.presetSource) return
        if (connectionId === previousConnectionId) return
        sourceForm.value.sourceDatabase = ''
        sourceForm.value.tableName = ''
        availableTables.value = []
        tablesLoadError.value = false
        tablesResolved.value = false
        if (!topicManual.value) {
            form.value.topic = ''
        }
        if (!connectionId) {
            databasesLoading.value = false
            return
        }
        databasesLoading.value = true
        try {
            await explorer.ensureChildrenLoaded(connectionId)
        } catch {
            // ignore
        } finally {
            databasesLoading.value = false
        }
    },
)

watch(
    () => [sourceForm.value.sourceConnectionId, sourceForm.value.sourceDatabase] as const,
    async ([connectionId, database], previous) => {
        if (props.presetSource) return
        const [prevConnectionId, prevDatabase] = previous ?? ['', '']
        if (connectionId === prevConnectionId && database === prevDatabase) return
        sourceForm.value.tableName = ''
        availableTables.value = []
        tablesLoadError.value = false
        tablesResolved.value = false
        if (!topicManual.value) {
            form.value.topic = ''
        }
        if (!needsSourceSelection.value || !connectionId || !database.trim()) return
        const connection = sourceConnections.value.find((item) => item.id === connectionId)
        if (!connection) return
        tablesLoading.value = true
        try {
            availableTables.value = await fetchTablesForScope(
                explorer.tree,
                {
                    connectionId,
                    database: database.trim(),
                    connectionLabel: connection.label,
                    dbType: connection.dbType,
                },
                {ensureChildrenLoaded: (nodeId) => explorer.ensureChildrenLoaded(nodeId)},
            )
        } catch {
            tablesLoadError.value = true
            availableTables.value = []
        } finally {
            tablesLoading.value = false
            tablesResolved.value = true
        }
    },
)

watch(
    () => sourceForm.value.tableName,
    (tableName) => {
        if (props.presetSource) return
        applyTopicForTable(tableName)
    },
)

watch(
    [form, sourceForm],
    () => {
        if (publishing.value) return
        submitError.value = null
        submitResult.value = null
    },
    {deep: true},
)

async function submit() {
    submitAttempted.value = true
    touched.value = {
        sourceConnectionId: true,
        sourceDatabase: true,
        tableName: true,
        kafkaConnectionId: true,
        topic: true,
    }
    const context = resolvedContext.value
    if (!context || !canPublish.value) return
    publishing.value = true
    submitError.value = null
    submitResult.value = null
    try {
        const result = await explorerApi.publishTableToKafka(
            form.value.kafkaConnectionId,
            buildPublishTableToKafkaRequest(context, form.value),
            {silent: true},
        )
        if (result.messagesFailed > 0 || result.stopReason === 'PRODUCE_ERROR') {
            submitError.value = result.lastError
                ?? t('explorer.kafkaTablePublish.partialFailed', {
                    sent: result.messagesSent,
                    failed: result.messagesFailed,
                })
            return
        }
        submitResult.value = result
    } catch (error) {
        submitError.value = resolveKafkaTablePublishErrorMessage(error, t)
    } finally {
        publishing.value = false
    }
}

defineExpose({resetFormState})
</script>

<template>
  <form class="kafka-table-publish-panel" @submit.prevent="submit">
    <div class="kafka-table-publish-panel__scroll">
      <p class="kafka-table-publish-panel__hint">{{ t('explorer.kafkaTablePublish.subtitle') }}</p>

      <div v-if="presetSource && !needsSourceSelection" class="kafka-table-publish-panel__source-tag">
        <span class="kafka-table-publish-panel__source-tag-label">{{ t('explorer.kafkaTablePublish.sourceSectionTitle') }}</span>
        <strong>{{ presetSource.sourceConnectionLabel }}</strong>
        <span>{{ presetSource.sourceDatabase }} · {{ presetSource.tableName }}</span>
      </div>

      <template v-if="needsSourceSelection">
        <label class="kafka-table-publish-panel__field">
          <span>{{ t('explorer.kafkaTablePublish.sourceConnection') }}</span>
          <div class="kafka-table-publish-panel__control">
            <DwSelect
                v-model="sourceForm.sourceConnectionId"
                :placeholder="t('explorer.kafkaTablePublish.pickSourceConnection')"
                :options="sourceConnectionOptions"
                @update:model-value="touchField('sourceConnectionId')"
            />
          </div>
          <p class="kafka-table-publish-panel__field-note">
            <span v-if="sourceConnectionError" class="is-error">{{ sourceConnectionError }}</span>
          </p>
        </label>

        <label class="kafka-table-publish-panel__field">
          <span>{{ t('explorer.kafkaTablePublish.sourceDatabase') }}</span>
          <div class="kafka-table-publish-panel__control">
            <DwSelect
                v-model="sourceForm.sourceDatabase"
                :placeholder="databasesLoading
                    ? t('explorer.kafkaTablePublish.loadingDatabases')
                    : t('explorer.kafkaTablePublish.pickSourceDatabase')"
                :options="sourceDatabaseOptions"
                :disabled="!sourceForm.sourceConnectionId || databasesLoading"
                @update:model-value="touchField('sourceDatabase')"
            />
          </div>
          <p class="kafka-table-publish-panel__field-note">
            <span v-if="sourceDatabaseError" class="is-error">{{ sourceDatabaseError }}</span>
          </p>
        </label>

        <label class="kafka-table-publish-panel__field">
          <span>{{ t('explorer.kafkaTablePublish.sourceTable') }}</span>
          <div class="kafka-table-publish-panel__control">
            <DwSelect
                v-if="!tablesResolved || sourceTableOptions.length > 0"
                v-model="sourceForm.tableName"
                :placeholder="tablesLoading
                    ? t('explorer.kafkaTablePublish.loadingTables')
                    : t('explorer.kafkaTablePublish.pickSourceTable')"
                :options="sourceTableOptions"
                :disabled="!sourceForm.sourceDatabase || tablesLoading || databasesLoading"
                @update:model-value="touchField('tableName')"
            />
            <input
                v-else
                v-model="sourceForm.tableName"
                class="kafka-table-publish-panel__input"
                type="text"
                spellcheck="false"
                :disabled="!sourceForm.sourceDatabase"
                @blur="touchField('tableName')"
                @input="applyTopicForTable(sourceForm.tableName)"
            >
          </div>
          <p class="kafka-table-publish-panel__field-note">
            <span v-if="tablesLoadError" class="is-error">{{ t('explorer.kafkaTablePublish.loadTablesFailed') }}</span>
            <span v-else-if="sourceTableError" class="is-error">{{ sourceTableError }}</span>
          </p>
        </label>
      </template>

      <div class="kafka-table-publish-panel__divider" aria-hidden="true"/>

      <div class="kafka-table-publish-panel__row">
        <label class="kafka-table-publish-panel__field">
          <span>{{ t('explorer.kafkaTablePublish.kafkaConnection') }}</span>
          <div class="kafka-table-publish-panel__control">
            <DwSelect
                v-model="form.kafkaConnectionId"
                :placeholder="t('explorer.kafkaTablePublish.noKafkaConnections')"
                :options="kafkaConnectionOptions"
                :disabled="lockKafkaConnection || !kafkaConnectionOptions.length"
                @update:model-value="touchField('kafkaConnectionId')"
            />
          </div>
          <p class="kafka-table-publish-panel__field-note">
            <span v-if="kafkaConnectionError" class="is-error">{{ kafkaConnectionError }}</span>
          </p>
        </label>

        <label class="kafka-table-publish-panel__field">
          <span>{{ t('explorer.kafkaTablePublish.topic') }}</span>
          <input
              v-model="form.topic"
              class="kafka-table-publish-panel__input"
              type="text"
              spellcheck="false"
              :disabled="publishing || !!successMessage"
              @input="onTopicInput"
          >
          <p class="kafka-table-publish-panel__field-note">
            <span v-if="topicError" class="is-error">{{ topicError }}</span>
          </p>
        </label>
      </div>

      <div class="kafka-table-publish-panel__row kafka-table-publish-panel__row--triple">
        <label class="kafka-table-publish-panel__field">
          <span>{{ t('explorer.kafkaTablePublish.maxMessages') }}</span>
          <input
              v-model.number="form.maxMessages"
              class="kafka-table-publish-panel__input"
              type="number"
              min="1"
              :max="KAFKA_PUBLISH_MAX_MESSAGES_CAP"
              :disabled="publishing || !!successMessage"
          >
        </label>

        <label class="kafka-table-publish-panel__field">
          <span>{{ t('explorer.kafkaTablePublish.intervalMs') }}</span>
          <input
              v-model.number="form.intervalMs"
              class="kafka-table-publish-panel__input"
              type="number"
              min="0"
              :max="KAFKA_PUBLISH_MAX_INTERVAL_MS"
              :disabled="publishing || !!successMessage"
          >
        </label>

        <label class="kafka-table-publish-panel__field">
          <span>{{ t('explorer.kafkaTablePublish.partition') }}</span>
          <input
              v-model="form.partition"
              class="kafka-table-publish-panel__input"
              type="text"
              inputmode="numeric"
              :placeholder="t('explorer.kafkaTablePublish.partitionOptional')"
              :disabled="publishing || !!successMessage"
          >
        </label>
      </div>

      <label class="kafka-table-publish-panel__field">
        <span>{{ t('explorer.kafkaTablePublish.keyColumn') }}</span>
        <input
            v-model="form.keyColumn"
            class="kafka-table-publish-panel__input"
            type="text"
            spellcheck="false"
            :placeholder="t('explorer.kafkaTablePublish.keyColumnOptional')"
            :disabled="publishing || !!successMessage"
        >
      </label>
    </div>

    <footer class="kafka-table-publish-panel__footer">
      <p
          class="kafka-table-publish-panel__feedback"
          :class="{
            'is-error': footerMessage.tone === 'error',
            'is-success': footerMessage.tone === 'success',
          }"
      >
        {{ footerMessage.text }}
      </p>
      <DwButton
          v-if="successMessage"
          variant="secondary"
          size="sm"
          type="button"
          @click="resetFormState"
      >
        {{ t('explorer.kafkaTablePublish.publishAgain') }}
      </DwButton>
      <button
          class="kafka-table-publish-panel__send"
          type="submit"
          :disabled="!canPublish"
      >
        {{ publishing ? t('explorer.kafkaTablePublish.publishing') : t('explorer.kafkaTablePublish.publish') }}
      </button>
    </footer>
  </form>
</template>

<style scoped>
.kafka-table-publish-panel {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.kafka-table-publish-panel__scroll {
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding: 10px 12px 4px;
}

.kafka-table-publish-panel__hint {
  margin: 0;
  color: var(--dw-text-muted);
  font-size: 11px;
  line-height: 1.45;
}

.kafka-table-publish-panel__source-tag {
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  gap: 6px 10px;
  padding: 8px 10px;
  border: 1px solid var(--dw-border);
  border-radius: 6px;
  background: color-mix(in srgb, var(--dw-primary) 5%, var(--dw-bg-panel));
  font-size: 12px;
}

.kafka-table-publish-panel__source-tag-label {
  color: var(--dw-text-muted);
  font-size: 11px;
}

.kafka-table-publish-panel__source-tag strong {
  font-weight: 600;
}

.kafka-table-publish-panel__divider {
  height: 1px;
  margin: 2px 0;
  background: var(--dw-border);
}

.kafka-table-publish-panel__row {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
  gap: 10px;
}

.kafka-table-publish-panel__row--triple {
  grid-template-columns: repeat(3, minmax(0, 1fr));
}

.kafka-table-publish-panel__field {
  display: flex;
  flex-direction: column;
  gap: 4px;
  min-width: 0;
  position: relative;
  z-index: 0;
  font-size: 11px;
  color: var(--dw-text-muted);
}

.kafka-table-publish-panel__field:has(:deep(.dw-select.is-open)) {
  z-index: 20;
}

.kafka-table-publish-panel__field :deep(.dw-select) {
  width: 100%;
}

.kafka-table-publish-panel__control {
  min-height: 34px;
}

.kafka-table-publish-panel__field-note {
  min-height: 16px;
  margin: 0;
  font-size: 11px;
  line-height: 16px;
}

.kafka-table-publish-panel__field-note .is-error {
  color: var(--dw-danger);
}

.kafka-table-publish-panel__input {
  width: 100%;
  min-height: 34px;
  box-sizing: border-box;
  border: 1px solid var(--dw-border);
  border-radius: 6px;
  padding: 8px 10px;
  background: var(--dw-bg-panel);
  color: var(--dw-text);
  font-size: 12px;
}

.kafka-table-publish-panel__field-error {
  margin: 0;
  color: var(--dw-danger);
  font-size: 11px;
}

.kafka-table-publish-panel__field-hint {
  margin: 0;
  color: var(--dw-text-muted);
  font-size: 11px;
}

.kafka-table-publish-panel__footer {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-shrink: 0;
  padding: 8px 12px 10px;
  border-top: 1px solid var(--dw-border);
  background: color-mix(in srgb, var(--dw-bg-editor) 70%, transparent);
}

.kafka-table-publish-panel__feedback {
  flex: 1;
  min-width: 0;
  margin: 0;
  color: var(--dw-text-muted);
  font-size: 11px;
  line-height: 1.45;
}

.kafka-table-publish-panel__feedback.is-error {
  color: var(--dw-danger);
}

.kafka-table-publish-panel__feedback.is-success {
  color: var(--dw-success, #15803d);
}

.kafka-table-publish-panel__send {
  flex-shrink: 0;
  border: 1px solid var(--dw-primary-ring);
  border-radius: 6px;
  padding: 8px 14px;
  background: var(--dw-primary-tint);
  color: var(--dw-primary);
  font-size: 12px;
  font-weight: 500;
  cursor: pointer;
}

.kafka-table-publish-panel__send:hover:not(:disabled) {
  background: var(--dw-primary-soft);
}

.kafka-table-publish-panel__send:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

@media (max-width: 720px) {
  .kafka-table-publish-panel__row,
  .kafka-table-publish-panel__row--triple {
    grid-template-columns: 1fr;
  }

  .kafka-table-publish-panel__footer {
    flex-wrap: wrap;
  }
}
</style>
