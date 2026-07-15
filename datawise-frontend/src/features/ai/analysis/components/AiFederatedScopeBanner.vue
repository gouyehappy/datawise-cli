<script setup lang="ts">
import {useI18n} from 'vue-i18n'

defineProps<{
  targetCount: number
}>()

const {t} = useI18n()
</script>

<template>
  <div v-if="targetCount > 1" class="federated-banner" role="status">
    <span class="federated-banner__icon" aria-hidden="true">⇄</span>
    <div class="federated-banner__body">
      <strong>{{ t('ai.federated.bannerTitle') }}</strong>
      <p>{{ t('ai.federated.bannerHint', {count: targetCount}) }}</p>
    </div>
  </div>
</template>

<style scoped>
.federated-banner {
  display: flex;
  gap: var(--dw-gap-md);
  align-items: flex-start;
  margin: var(--dw-space-6) var(--dw-space-10) 0;
  padding: var(--dw-pad-control-lg);
  border-radius: var(--dw-radius-lg);
  border: 1px solid color-mix(in srgb, var(--dw-primary) 24%, var(--dw-border-light));
  background: color-mix(in srgb, var(--dw-primary-soft) 55%, var(--dw-bg-panel));
}

.federated-banner__icon {
  flex-shrink: 0;
  width: 22px;
  height: var(--dw-control-h-xs);
  border-radius: var(--dw-radius-pill);
  display: inline-flex;
  align-items: center;
  justify-content: center;
  background: var(--dw-bg);
  color: var(--dw-primary);
  font-size: var(--dw-text-sm);
  font-weight: 700;
}

.federated-banner__body strong {
  display: block;
  font-size: var(--dw-text-sm);
  color: var(--dw-text);
}

.federated-banner__body p {
  margin: var(--dw-space-1) 0 0;
  font-size: var(--dw-text-xs);
  line-height: var(--dw-leading);
  color: var(--dw-text-secondary);
}
</style>
