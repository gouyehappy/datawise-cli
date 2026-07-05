<script setup lang="ts">
import {useI18n} from 'vue-i18n'

defineProps<{
  capabilities: { title: string; desc: string }[]
}>()

const {t} = useI18n()
</script>

<template>
  <div class="welcome-card">
    <div class="welcome-card__head">
      <h2>{{ t('ai.welcomeTitle') }}</h2>
      <p class="welcome-intro">{{ t('ai.welcomeIntro') }}</p>
    </div>
    <div class="capability-grid">
      <article v-for="(cap, index) in capabilities" :key="cap.title" class="cap-card">
        <span class="cap-index">{{ index + 1 }}</span>
        <div class="cap-copy">
          <strong>{{ cap.title }}</strong>
          <span>{{ cap.desc }}</span>
        </div>
      </article>
    </div>
  </div>
</template>

<style scoped>
.welcome-card {
  padding: 20px 22px;
  border: 1px solid var(--dw-border-light);
  border-radius: 16px;
  background: linear-gradient(
      165deg,
      color-mix(in srgb, var(--dw-primary) 5%, var(--dw-bg-panel)),
      var(--dw-bg-panel)
  );
}

.welcome-card__head {
  margin-bottom: 16px;
}

.welcome-card h2 {
  margin: 0;
  font-size: 17px;
  font-weight: 600;
  line-height: 1.35;
}

.welcome-intro {
  margin: 8px 0 0;
  color: var(--dw-text-secondary);
  font-size: 13px;
  line-height: 1.55;
}

.capability-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 10px;
}

.cap-card {
  display: flex;
  align-items: flex-start;
  gap: 10px;
  padding: 12px 14px;
  border-radius: 12px;
  border: 1px solid var(--dw-border-light);
  background: var(--dw-bg);
}

.cap-index {
  flex-shrink: 0;
  width: 24px;
  height: 24px;
  border-radius: 8px;
  background: var(--dw-primary-soft);
  color: var(--dw-primary);
  font-size: 11px;
  font-weight: 700;
  line-height: 24px;
  text-align: center;
}

.cap-copy {
  display: flex;
  flex-direction: column;
  gap: 4px;
  min-width: 0;
}

.cap-copy strong {
  font-size: 13px;
  line-height: 1.35;
}

.cap-copy span {
  color: var(--dw-text-secondary);
  font-size: 12px;
  line-height: 1.45;
}
</style>
