<script setup lang="ts">
defineProps<{
  label?: string
  hint?: string
  inputId?: string
  wide?: boolean
}>()
</script>

<template>
  <div class="conn-form-field" :class="{ 'conn-form-field--wide': wide }">
    <label v-if="label" :for="inputId">{{ label }}</label>
    <div class="conn-form-field__control">
      <slot/>
    </div>
    <p v-if="hint" class="conn-form-field__hint">{{ hint }}</p>
  </div>
</template>

<style scoped>
.conn-form-field {
  display: flex;
  flex-direction: column;
  gap: 6px;
  min-width: 0;
}

.conn-form-field label {
  font-size: 12px;
  font-weight: 600;
  color: var(--dw-text);
  line-height: 1.2;
}

.conn-form-field__hint {
  margin: 0;
  color: var(--dw-text-muted);
  font-size: 11px;
  line-height: 1.4;
}

.conn-form-field--wide {
  grid-column: 1 / -1;
}
</style>
