<script setup lang="ts">
defineProps<{
  label: string
  hint?: string
}>()

const model = defineModel<boolean>({required: true})
</script>

<template>
  <label class="settings-switch">
    <input v-model="model" type="checkbox"/>
    <span class="settings-switch__body">
      <span class="settings-switch__label">{{ label }}</span>
      <span v-if="hint" class="settings-switch__hint">{{ hint }}</span>
    </span>
  </label>
</template>

<style scoped>
.settings-switch {
  display: flex;
  align-items: flex-start;
  gap: 10px;
  padding: 10px 0;
  cursor: pointer;
}

.settings-switch input {
  flex-shrink: 0;
  margin-top: 2px;
  accent-color: var(--dw-primary);
}

.settings-switch__body {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.settings-switch__label {
  font-size: 13px;
  color: var(--dw-text);
}

.settings-switch__hint {
  color: var(--dw-text-secondary);
  font-size: 12px;
  line-height: 1.45;
}
</style>
