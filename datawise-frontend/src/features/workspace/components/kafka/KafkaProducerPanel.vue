<script setup lang="ts">
import {onMounted, onUnmounted, ref, watch} from 'vue'
import {useI18n} from 'vue-i18n'
import {explorerApi} from '@/api'
import {useLayoutStore} from '@/features/layout/stores/layout'

const props = defineProps<{
  connectionId: string
  topic: string
}>()

const emit = defineEmits<{
  produced: []
}>()

const {t} = useI18n()
const layout = useLayoutStore()

const key = ref('')
const value = ref('')
const partition = ref('')
const sending = ref(false)
const error = ref<string | null>(null)
const lastResult = ref<string | null>(null)

function applySeed(payload?: { key?: string; value?: string; partition?: number }) {
  if (!payload) return
  if (payload.key != null) key.value = payload.key
  if (payload.value != null) value.value = payload.value
  if (payload.partition != null) partition.value = String(payload.partition)
}

async function onSubmit() {
  if (!props.connectionId || !props.topic || !value.value.trim()) return
  sending.value = true
  error.value = null
  lastResult.value = null
  try {
    const partitionNumber = partition.value.trim() === '' ? undefined : Number(partition.value)
    const result = await explorerApi.produceKafkaMessage(props.connectionId, props.topic, {
      key: key.value || undefined,
      value: value.value,
      partition: Number.isFinite(partitionNumber) ? partitionNumber : undefined,
    })
    lastResult.value = t('explorer.kafkaProducer.success', {
      partition: result.partition,
      offset: result.offset,
    })
    layout.showToast(t('explorer.kafkaProducer.sent'))
    value.value = ''
    emit('produced')
  } catch (err) {
    error.value = err instanceof Error ? err.message : t('explorer.kafkaProducer.failed')
  } finally {
    sending.value = false
  }
}

function onKeydown(event: KeyboardEvent) {
  if ((event.ctrlKey || event.metaKey) && event.key === 'Enter') {
    event.preventDefault()
    void onSubmit()
  }
}

watch(
    () => props.topic,
    () => {
      error.value = null
      lastResult.value = null
    },
)

onMounted(() => {
  window.addEventListener('keydown', onKeydown)
})

onUnmounted(() => {
  window.removeEventListener('keydown', onKeydown)
})

defineExpose({applySeed})
</script>

<template>
  <form class="kafka-producer-panel" @submit.prevent="onSubmit">
    <div class="kafka-producer-panel__scroll">
      <p class="kafka-producer-panel__hint">{{ t('explorer.kafkaProducer.hint', {topic}) }}</p>

      <div class="kafka-producer-panel__row">
        <label class="kafka-producer-panel__field">
          <span>{{ t('explorer.kafkaProducer.key') }}</span>
          <input
              v-model="key"
              type="text"
              spellcheck="false"
              :placeholder="t('explorer.kafkaProducer.keyOptional')"
          >
        </label>
        <label class="kafka-producer-panel__field kafka-producer-panel__field--partition">
          <span>{{ t('explorer.kafkaProducer.partition') }}</span>
          <input
              v-model="partition"
              type="text"
              inputmode="numeric"
              :placeholder="t('explorer.kafkaProducer.partitionOptional')"
          >
        </label>
      </div>

      <label class="kafka-producer-panel__field">
        <span>{{ t('explorer.kafkaProducer.value') }}</span>
        <textarea
            v-model="value"
            rows="3"
            spellcheck="false"
            :placeholder="t('explorer.kafkaProducer.valuePlaceholder')"
        />
      </label>
    </div>

    <footer class="kafka-producer-panel__footer">
      <p v-if="error" class="kafka-producer-panel__feedback is-error">{{ error }}</p>
      <p v-else-if="lastResult" class="kafka-producer-panel__feedback is-success">{{ lastResult }}</p>
      <p v-else class="kafka-producer-panel__feedback">{{ t('explorer.kafkaProducer.shortcut') }}</p>
      <button
          class="kafka-producer-panel__send"
          type="submit"
          :disabled="sending || !value.trim()"
      >
        {{ sending ? t('explorer.kafkaProducer.sending') : t('explorer.kafkaProducer.send') }}
      </button>
    </footer>
  </form>
</template>

<style scoped>
.kafka-producer-panel {
  display: flex;
  flex-direction: column;
  gap: 8px;
  height: 100%;
  min-height: 0;
  overflow: hidden;
}

.kafka-producer-panel__scroll {
  flex: 1;
  min-height: 0;
  overflow: auto;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.kafka-producer-panel__hint {
  margin: 0;
  color: var(--dw-text-muted);
  font-size: 11px;
  line-height: 1.4;
}

.kafka-producer-panel__row {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 120px;
  gap: 8px;
}

.kafka-producer-panel__field {
  display: flex;
  flex-direction: column;
  gap: 4px;
  font-size: 11px;
  color: var(--dw-text-muted);
}

.kafka-producer-panel__field input,
.kafka-producer-panel__field textarea {
  border: 1px solid var(--dw-border);
  border-radius: 6px;
  padding: 8px 10px;
  background: var(--dw-bg-panel);
  color: var(--dw-text);
  font-family: var(--dw-font-mono, ui-monospace, monospace);
  font-size: 12px;
}

.kafka-producer-panel__field textarea {
  min-height: 56px;
  resize: vertical;
  line-height: 1.5;
}

.kafka-producer-panel__footer {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-shrink: 0;
  padding-top: 2px;
  border-top: 1px solid var(--dw-border);
}

.kafka-producer-panel__feedback {
  flex: 1;
  min-width: 0;
  margin: 0;
  color: var(--dw-text-muted);
  font-size: 11px;
}

.kafka-producer-panel__feedback.is-error {
  color: var(--dw-danger);
}

.kafka-producer-panel__feedback.is-success {
  color: var(--dw-success, #15803d);
}

.kafka-producer-panel__send {
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

.kafka-producer-panel__send:hover {
  background: var(--dw-primary-soft);
}

.kafka-producer-panel__send:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

@media (max-width: 720px) {
  .kafka-producer-panel__row {
    grid-template-columns: 1fr;
  }

  .kafka-producer-panel__footer {
    flex-wrap: wrap;
  }
}
</style>
