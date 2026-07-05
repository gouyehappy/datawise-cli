<script setup lang="ts">
import {ref, watch} from 'vue'
import {useI18n} from 'vue-i18n'
import {DwButton} from '@/core/components'
import {useLayoutStore} from '@/features/layout/stores/layout'

const props = withDefaults(defineProps<{
  open: boolean
  loading: boolean
  text: string
  title?: string
  loadingLabel?: string
  copyLabel?: string
  copiedLabel?: string
  copiedToast?: string
}>(), {
  title: undefined,
  loadingLabel: undefined,
  copyLabel: undefined,
  copiedLabel: undefined,
  copiedToast: undefined,
})

const emit = defineEmits<{
  close: []
}>()

const {t} = useI18n()
const layout = useLayoutStore()
const copied = ref(false)

watch(
    () => props.open,
    (open) => {
        if (!open) copied.value = false
    },
)

async function onCopy() {
  if (!props.text.trim()) return
  await navigator.clipboard.writeText(props.text)
  copied.value = true
  layout.showToast(props.copiedToast ?? t('queryResult.aiSummaryCopied'))
}
</script>

<template>
  <section v-if="open" class="result-ai-summary">
    <header class="result-ai-summary__head">
      <h3>{{ title ?? t('queryResult.aiSummaryTitle') }}</h3>
      <div class="result-ai-summary__actions">
        <DwButton
            variant="ghost"
            size="sm"
            type="button"
            :disabled="loading || !text.trim()"
            @click="onCopy"
        >
          {{ copied ? (copiedLabel ?? t('queryResult.aiSummaryCopiedShort')) : (copyLabel ?? t('queryResult.aiSummaryCopy')) }}
        </DwButton>
        <DwButton variant="ghost" size="sm" type="button" @click="emit('close')">
          {{ t('common.close') }}
        </DwButton>
      </div>
    </header>
    <p v-if="loading" class="result-ai-summary__loading">{{ loadingLabel ?? t('queryResult.aiSummaryLoading') }}</p>
    <pre v-else class="result-ai-summary__body">{{ text }}</pre>
  </section>
</template>

<style scoped>
.result-ai-summary {
  flex-shrink: 0;
  margin: 0 0 8px;
  padding: 10px 12px;
  border: 1px solid var(--dw-border-light);
  border-radius: 8px;
  background: var(--dw-bg-muted);
}

.result-ai-summary__head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  margin-bottom: 8px;
}

.result-ai-summary__head h3 {
  margin: 0;
  font-size: 12px;
  font-weight: 600;
  color: var(--dw-text);
}

.result-ai-summary__actions {
  display: flex;
  align-items: center;
  gap: 6px;
  flex-shrink: 0;
}

.result-ai-summary__loading {
  margin: 0;
  color: var(--dw-text-muted);
  font-size: 12px;
}

.result-ai-summary__body {
  margin: 0;
  white-space: pre-wrap;
  word-break: break-word;
  color: var(--dw-text-secondary);
  font-family: inherit;
  font-size: 12px;
  line-height: 1.55;
  max-height: 180px;
  overflow: auto;
}
</style>
