<script setup lang="ts">
import {computed} from 'vue'
import {useI18n} from 'vue-i18n'
import {
    applyDatePresetToValues,
    detectDateParameterBinding,
    type DatePresetId,
} from '@/features/workspace/services/sql-date-param-presets.service'

const props = defineProps<{
  parameterNames: string[]
  values: Record<string, string>
}>()

const emit = defineEmits<{
  'update:values': [value: Record<string, string>]
}>()

const {t} = useI18n()

const hasParameters = computed(() => props.parameterNames.length > 0)
const dateBinding = computed(() => detectDateParameterBinding(props.parameterNames))
const showDatePresets = computed(() => Boolean(dateBinding.value))

const datePresets: DatePresetId[] = ['today', 'last7days', 'mtd', 'lastMonth']

function onInput(name: string, value: string) {
  emit('update:values', {...props.values, [name]: value})
}

function applyPreset(preset: DatePresetId) {
  const binding = dateBinding.value
  if (!binding) return
  emit('update:values', applyDatePresetToValues(preset, props.values, binding))
}
</script>

<template>
  <div v-if="hasParameters" class="sql-params">
    <span class="sql-params__label">{{ t('console.parameters.title') }}</span>

    <template v-if="showDatePresets">
      <span class="sql-params__divider" aria-hidden="true"/>
      <div class="sql-params__presets">
        <button
            v-for="preset in datePresets"
            :key="preset"
            class="sql-params__preset"
            type="button"
            @click="applyPreset(preset)"
        >
          {{ t(`console.parameters.datePresets.${preset}`) }}
        </button>
      </div>
    </template>

    <span class="sql-params__divider" aria-hidden="true"/>

    <div class="sql-params__fields">
      <label
          v-for="name in parameterNames"
          :key="name"
          class="sql-params__field"
      >
        <span class="sql-params__name">${{ name }}</span>
        <input
            class="sql-params__input"
            type="text"
            :placeholder="t('console.parameters.placeholder')"
            :value="values[name] ?? ''"
            @input="onInput(name, ($event.target as HTMLInputElement).value)"
        />
      </label>
    </div>
  </div>
</template>

<style scoped>
.sql-params {
  display: flex;
  align-items: center;
  flex-shrink: 0;
  gap: 8px;
  min-height: 28px;
  padding: 0 var(--dw-console-chrome-inset);
  border-bottom: 1px solid var(--dw-border-light);
  background: var(--dw-bg-editor);
  overflow-x: auto;
}

.sql-params__label {
  flex-shrink: 0;
  font-size: 10px;
  font-weight: 600;
  letter-spacing: 0.03em;
  color: var(--dw-text-muted);
  white-space: nowrap;
}

.sql-params__divider {
  flex-shrink: 0;
  width: 1px;
  height: 14px;
  background: var(--dw-border-light);
}

.sql-params__presets {
  display: inline-flex;
  align-items: center;
  flex-shrink: 0;
  gap: 4px;
}

.sql-params__preset {
  padding: 1px 7px;
  border: 1px solid var(--dw-border-light);
  border-radius: 999px;
  background: var(--dw-bg-panel);
  color: var(--dw-text-secondary);
  font-size: 10px;
  line-height: 1.5;
  white-space: nowrap;
  cursor: pointer;
}

.sql-params__preset:hover {
  border-color: color-mix(in srgb, var(--dw-primary) 24%, var(--dw-border-light));
  color: var(--dw-primary);
  background: var(--dw-primary-softer);
}

.sql-params__fields {
  display: inline-flex;
  align-items: center;
  flex: 1;
  flex-wrap: nowrap;
  gap: 10px;
  min-width: 0;
}

.sql-params__field {
  display: inline-flex;
  align-items: center;
  flex-shrink: 0;
  gap: 5px;
}

.sql-params__name {
  flex-shrink: 0;
  font-family: var(--dw-mono, monospace);
  font-size: 10px;
  color: var(--dw-text-muted);
}

.sql-params__input {
  width: 108px;
  padding: 2px 6px;
  border: 1px solid var(--dw-border-light);
  border-radius: 4px;
  background: var(--dw-bg-panel);
  color: var(--dw-text);
  font-size: 11px;
  line-height: 1.4;
}

.sql-params__input:focus {
  outline: none;
  border-color: color-mix(in srgb, var(--dw-primary) 40%, var(--dw-border-light));
}
</style>
