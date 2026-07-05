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
  gap: 10px;
  align-items: flex-start;
  margin: 12px 28px 0;
  padding: 10px 12px;
  border-radius: 10px;
  border: 1px solid color-mix(in srgb, var(--dw-primary) 24%, var(--dw-border-light));
  background: color-mix(in srgb, var(--dw-primary-soft) 55%, var(--dw-bg-panel));
}

.federated-banner__icon {
  flex-shrink: 0;
  width: 22px;
  height: 22px;
  border-radius: 999px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  background: var(--dw-bg);
  color: var(--dw-primary);
  font-size: 12px;
  font-weight: 700;
}

.federated-banner__body strong {
  display: block;
  font-size: 12px;
  color: var(--dw-text);
}

.federated-banner__body p {
  margin: 2px 0 0;
  font-size: 11px;
  line-height: 1.45;
  color: var(--dw-text-secondary);
}
</style>
