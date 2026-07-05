<script setup lang="ts">
import {useI18n} from 'vue-i18n'

defineProps<{
  sql: string
  busy?: boolean
}>()

const emit = defineEmits<{
  confirm: []
  cancel: []
}>()

const {t} = useI18n()
</script>

<template>
  <div class="sql-confirm">
    <header class="sql-confirm__header">
      <div class="sql-confirm__heading">
        <span class="sql-confirm__badge" aria-hidden="true">
          <span class="sql-confirm__badge-dot"/>
          {{ t('ai.analysis.sqlConfirmBadge') }}
        </span>
        <h3 class="sql-confirm__title">{{ t('ai.analysis.sqlConfirmTitle') }}</h3>
        <p class="sql-confirm__hint">{{ t('ai.analysis.sqlConfirmHint') }}</p>
      </div>
    </header>

    <div class="sql-confirm__sql ai-code-surface">
      <div class="ai-code-surface__head">
        <span class="ai-code-surface__label">
          <span class="ai-code-surface__label-dot" aria-hidden="true"/>
          SQL
        </span>
        <span class="sql-confirm__readonly">{{ t('ai.analysis.sqlConfirmReadonly') }}</span>
      </div>
      <pre><code>{{ sql }}</code></pre>
    </div>

    <footer class="sql-confirm__actions">
      <button
          class="ai-btn ai-btn--primary"
          type="button"
          :disabled="busy"
          @click="emit('confirm')"
      >
        {{ busy ? t('ai.analysis.sqlConfirmRunning') : t('ai.analysis.sqlConfirmRun') }}
      </button>
      <button
          class="ai-btn ai-btn--ghost"
          type="button"
          :disabled="busy"
          @click="emit('cancel')"
      >
        {{ t('ai.analysis.sqlConfirmCancel') }}
      </button>
    </footer>
  </div>
</template>

<style scoped>
.sql-confirm {
  display: flex;
  flex-direction: column;
  gap: 14px;
  min-width: min(480px, 100%);
}

.sql-confirm__header {
  display: flex;
  align-items: flex-start;
  gap: 12px;
}

.sql-confirm__heading {
  display: flex;
  flex-direction: column;
  gap: 6px;
  min-width: 0;
}

.sql-confirm__badge {
  display: inline-flex;
  align-items: center;
  gap: 7px;
  align-self: flex-start;
  padding: 4px 12px 4px 9px;
  border-radius: 999px;
  border: 1px solid color-mix(in srgb, var(--dw-primary) 32%, var(--dw-border-light));
  background: linear-gradient(180deg, color-mix(in srgb, var(--dw-primary-soft) 85%, #fff), var(--dw-primary-soft));
  color: var(--dw-primary);
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.03em;
  box-shadow: inset 0 1px 0 color-mix(in srgb, #fff 45%, transparent),
  0 2px 8px color-mix(in srgb, var(--dw-primary) 12%, transparent);
}

.sql-confirm__badge-dot {
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background: var(--dw-primary);
  box-shadow: 0 0 0 3px color-mix(in srgb, var(--dw-primary) 22%, transparent),
  0 0 8px color-mix(in srgb, var(--dw-primary) 50%, transparent);
  animation: badge-pulse 2s ease-in-out infinite;
}

.sql-confirm__title {
  margin: 0;
  font-size: 16px;
  font-weight: 600;
  line-height: 1.35;
  color: var(--dw-text);
  letter-spacing: -0.01em;
}

.sql-confirm__hint {
  margin: 0;
  font-size: 12px;
  line-height: 1.55;
  color: var(--dw-text-muted);
}

.sql-confirm__readonly {
  font-size: 10px;
  font-weight: 600;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  color: var(--dw-text-muted);
}

.sql-confirm__sql pre {
  margin: 0;
  padding: 12px 14px;
  max-height: 220px;
  overflow: auto;
}

.sql-confirm__sql code {
  font-size: 12px;
  line-height: 1.55;
  white-space: pre-wrap;
  word-break: break-word;
}

.sql-confirm__actions {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: flex-end;
  gap: 10px;
  padding-top: 6px;
  margin-top: 4px;
  border-top: 1px solid var(--dw-border-light);
}

@keyframes badge-pulse {
  0%,
  100% {
    opacity: 1;
  }
  50% {
    opacity: 0.65;
  }
}
</style>
