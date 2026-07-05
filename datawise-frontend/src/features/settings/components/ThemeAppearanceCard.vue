<script setup lang="ts">
import type {ThemeAppearance} from '@/features/settings/constants/theme-presets'

defineProps<{
  variant: ThemeAppearance
  active?: boolean
  label: string
}>()

defineEmits<{ click: [] }>()
</script>

<template>
  <button class="appearance-card" :class="{ active }" type="button" @click="$emit('click')">
    <div class="preview-frame" :class="{ active }">
      <div v-if="variant === 'system'" class="preview-shell preview-shell--system">
        <div class="preview-half preview-half--light">
          <div class="preview-rail"/>
          <div class="preview-main">
            <div class="preview-line"/>
            <div class="preview-line short"/>
          </div>
        </div>
        <div class="preview-half preview-half--dark">
          <div class="preview-rail"/>
          <div class="preview-main">
            <div class="preview-line"/>
            <div class="preview-line short"/>
          </div>
        </div>
      </div>
      <div v-else class="preview-shell" :class="`preview-shell--${variant}`">
        <div class="preview-rail"/>
        <div class="preview-main">
          <div class="preview-line"/>
          <div class="preview-line short"/>
          <div class="preview-block"/>
        </div>
      </div>
    </div>
    <span class="card-label">{{ label }}</span>
  </button>
</template>

<style scoped>
.appearance-card {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 10px;
  padding: 0;
  border: none;
  background: transparent;
  cursor: pointer;
}

.preview-frame {
  width: 148px;
  height: 92px;
  padding: 3px;
  border: 1.5px solid var(--dw-border);
  border-radius: 10px;
  background: var(--dw-bg);
  transition: border-color 0.12s ease, box-shadow 0.12s ease;
}

.preview-frame.active {
  border-color: var(--dw-primary-border);
  border-width: 2px;
  padding: 2px;
  box-shadow: 0 0 0 3px var(--dw-primary-soft), var(--dw-panel-shadow);
}

.card-label {
  font-size: var(--mp-sub);
  color: var(--dw-text-secondary);
  transition: color 0.12s ease;
}

.appearance-card.active .card-label {
  color: var(--dw-primary);
  font-weight: 600;
}

.preview-shell {
  display: flex;
  width: 100%;
  height: 100%;
  overflow: hidden;
  border-radius: 6px;
  border: 1px solid rgba(15, 23, 42, 0.06);
}

.preview-shell--light .preview-rail {
  background: #eceef2;
}

.preview-shell--light .preview-main {
  background: #ffffff;
}

.preview-shell--light .preview-line {
  background: #e8eaee;
}

.preview-shell--light .preview-block {
  background: #f3f4f6;
}

.preview-shell--dark .preview-rail {
  background: #2a2a2e;
}

.preview-shell--dark .preview-main {
  background: #141416;
}

.preview-shell--dark .preview-line {
  background: #2e2e32;
}

.preview-shell--dark .preview-block {
  background: #1f1f23;
}

.preview-shell--system {
  position: relative;
}

.preview-half {
  position: absolute;
  inset: 0;
  display: flex;
}

.preview-half--light {
  clip-path: polygon(0 0, 100% 0, 0 100%);
}

.preview-half--light .preview-rail {
  background: #eceef2;
}

.preview-half--light .preview-main {
  background: #ffffff;
}

.preview-half--light .preview-line {
  background: #e8eaee;
}

.preview-half--dark {
  clip-path: polygon(100% 0, 100% 100%, 0 100%);
}

.preview-half--dark .preview-rail {
  background: #2a2a2e;
}

.preview-half--dark .preview-main {
  background: #141416;
}

.preview-half--dark .preview-line {
  background: #2e2e32;
}

.preview-rail {
  width: 22%;
  flex-shrink: 0;
}

.preview-main {
  flex: 1;
  padding: 10px 8px;
  display: flex;
  flex-direction: column;
  gap: 5px;
}

.preview-line {
  height: 5px;
  border-radius: 2px;
}

.preview-line.short {
  width: 62%;
}

.preview-block {
  flex: 1;
  margin-top: 4px;
  border-radius: 3px;
}
</style>
