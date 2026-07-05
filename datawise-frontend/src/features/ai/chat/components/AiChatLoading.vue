<script setup lang="ts">
import {useI18n} from 'vue-i18n'
import AiIcon from '@/core/components/AiIcon.vue'

const {t} = useI18n()
</script>

<template>
  <div class="ai-workflow-card ai-workflow-card--inline ai-chat-loading">
    <div class="ai-chat-loading__orb" aria-hidden="true">
      <span class="ai-chat-loading__ring"/>
      <AiIcon :size="18"/>
    </div>
    <div class="ai-chat-loading__text">
      <span class="ai-chat-loading__label">{{ t('ai.typing') }}</span>
      <span class="ai-chat-loading__hint">{{ t('ai.typingHint') }}</span>
    </div>
    <span class="ai-chat-loading__dots" aria-hidden="true"><i/><i/><i/></span>
  </div>
</template>

<style scoped>
.ai-chat-loading {
  display: flex;
  align-items: center;
  gap: 14px;
  padding: 16px 20px;
  min-width: min(360px, 100%);
}

.ai-chat-loading__orb {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 40px;
  height: 40px;
  border-radius: 12px;
  background: linear-gradient(
      145deg,
      color-mix(in srgb, var(--dw-primary) 16%, var(--dw-bg)),
      var(--dw-bg-panel)
  );
  color: var(--dw-primary);
  flex-shrink: 0;
}

.ai-chat-loading__ring {
  position: absolute;
  inset: -3px;
  border-radius: 14px;
  border: 2px solid transparent;
  border-top-color: var(--dw-primary);
  animation: ring-spin 2.4s linear infinite;
}

.ai-chat-loading__text {
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
  flex: 1;
}

.ai-chat-loading__label {
  color: var(--dw-text);
  font-size: 13px;
  font-weight: 600;
}

.ai-chat-loading__hint {
  color: var(--dw-text-muted);
  font-size: 11px;
  line-height: 1.4;
}

.ai-chat-loading__dots {
  display: inline-flex;
  gap: 5px;
  flex-shrink: 0;
}

.ai-chat-loading__dots i {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: var(--dw-primary);
  opacity: 0.55;
  animation: typing-bounce 1.8s infinite ease-in-out;
}

.ai-chat-loading__dots i:nth-child(2) {
  animation-delay: 0.2s;
}

.ai-chat-loading__dots i:nth-child(3) {
  animation-delay: 0.4s;
}

@keyframes typing-bounce {
  0%,
  80%,
  100% {
    transform: translateY(0);
    opacity: 0.45;
  }
  40% {
    transform: translateY(-4px);
    opacity: 1;
  }
}

@keyframes ring-spin {
  to {
    transform: rotate(360deg);
  }
}
</style>
