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
  gap: var(--dw-space-7);
  min-width: min(480px, 100%);
}

.sql-confirm__header {
  display: flex;
  align-items: flex-start;
  gap: var(--dw-space-6);
}

.sql-confirm__heading {
  display: flex;
  flex-direction: column;
  gap: var(--dw-gap-sm);
  min-width: 0;
}

.sql-confirm__badge {
  display: inline-flex;
  align-items: center;
  gap: var(--dw-space-3);
  align-self: flex-start;
  padding: var(--dw-space-2) var(--dw-space-6) var(--dw-space-2) 9px;
  border-radius: var(--dw-radius-pill);
  border: 1px solid color-mix(in srgb, var(--dw-primary) 32%, var(--dw-border-light));
  background: linear-gradient(180deg, color-mix(in srgb, var(--dw-primary-soft) 85%, var(--dw-on-accent)), var(--dw-primary-soft));
  color: var(--dw-primary);
  font-size: var(--dw-text-xs);
  font-weight: 700;
  letter-spacing: 0.03em;
  box-shadow: inset 0 1px 0 color-mix(in srgb, var(--dw-on-accent) 45%, transparent),
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
  font-size: var(--dw-text-xl);
  font-weight: 600;
  line-height: var(--dw-leading-snug);
  color: var(--dw-text);
  letter-spacing: -0.01em;
}

.sql-confirm__hint {
  margin: 0;
  font-size: var(--dw-text-sm);
  line-height: var(--dw-leading-loose);
  color: var(--dw-text-muted);
}

.sql-confirm__readonly {
  font-size: var(--dw-text-xs);
  font-weight: 600;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  color: var(--dw-text-muted);
}

.sql-confirm__sql pre {
  margin: 0;
  padding: var(--dw-space-6) var(--dw-space-7);
  max-height: 220px;
  overflow: auto;
}

.sql-confirm__sql code {
  font-size: var(--dw-text-sm);
  line-height: var(--dw-leading-loose);
  white-space: pre-wrap;
  word-break: break-word;
}

.sql-confirm__actions {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: flex-end;
  gap: var(--dw-gap-md);
  padding-top: var(--dw-space-3);
  margin-top: var(--dw-space-2);
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
