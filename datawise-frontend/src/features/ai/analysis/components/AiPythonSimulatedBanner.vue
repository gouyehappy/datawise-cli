<script setup lang="ts">
import {useI18n} from 'vue-i18n'

defineProps<{
  visible: boolean
}>()

const {t} = useI18n()
</script>

<template>
  <div v-if="visible" class="python-sim-banner" role="status">
    <span class="python-sim-banner__icon" aria-hidden="true">!</span>
    <div class="python-sim-banner__body">
      <strong>{{ t('ai.pythonSimulated.bannerTitle') }}</strong>
      <p>{{ t('ai.pythonSimulated.bannerHint') }}</p>
    </div>
  </div>
</template>

<style scoped>
.python-sim-banner {
  display: flex;
  gap: var(--dw-gap-md);
  align-items: flex-start;
  margin: var(--dw-space-6) var(--dw-space-10) 0;
  padding: var(--dw-pad-control-lg);
  border-radius: var(--dw-radius-lg);
  border: 1px solid color-mix(in srgb, var(--dw-warning, #c47b16) 40%, var(--dw-border-light));
  background: color-mix(in srgb, var(--dw-warning, #c47b16) 10%, var(--dw-bg-panel));
}

.python-sim-banner__icon {
  flex-shrink: 0;
  width: 22px;
  height: var(--dw-control-h-xs);
  border-radius: var(--dw-radius-pill);
  display: inline-flex;
  align-items: center;
  justify-content: center;
  background: var(--dw-bg);
  color: var(--dw-warning, #c47b16);
  font-size: var(--dw-text-sm);
  font-weight: 700;
}

.python-sim-banner__body strong {
  display: block;
  font-size: var(--dw-text-sm);
  color: var(--dw-text);
}

.python-sim-banner__body p {
  margin: var(--dw-space-1) 0 0;
  font-size: var(--dw-text-xs);
  line-height: var(--dw-leading);
  color: var(--dw-text-secondary);
}
</style>
