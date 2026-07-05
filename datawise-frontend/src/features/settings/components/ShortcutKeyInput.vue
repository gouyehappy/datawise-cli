<script setup lang="ts">
import {computed, ref, watch} from 'vue'
import {useI18n} from 'vue-i18n'
import {SHORTCUT_DEFINITIONS} from '@/core/shortcuts/definitions'
import type {ShortcutActionId} from '@/core/shortcuts/types'
import {eventToBinding, formatBinding, formatBindingParts} from '@/core/shortcuts/shortcut.service'
import {DwIcon} from '@/core/icons'
import {useShortcutSettingsStore} from '@/features/settings/stores/shortcut-settings-store'

const props = defineProps<{
  actionId: ShortcutActionId
}>()

const {t} = useI18n()
const shortcuts = useShortcutSettingsStore()
const fieldRef = ref<HTMLInputElement>()
const recording = ref(false)
const conflictId = ref<ShortcutActionId | null>(null)

const conflictLabel = computed(() => {
  if (!conflictId.value) return ''
  const def = SHORTCUT_DEFINITIONS.find((item) => item.id === conflictId.value)
  return def ? t(def.labelKey) : ''
})

const hasBinding = computed(() => Boolean(shortcuts.getBinding(props.actionId).trim()))

const keyChips = computed(() => {
  if (recording.value) return []
  const binding = shortcuts.getBinding(props.actionId)
  if (!binding.trim()) return []
  return formatBindingParts(binding)
})

const displayValue = ref('')

watch(
    () => shortcuts.getBinding(props.actionId),
    (binding) => {
      displayValue.value = binding ? formatBinding(binding) : ''
    },
    {immediate: true},
)

function onFocus() {
  recording.value = true
  conflictId.value = null
}

function onBlur() {
  recording.value = false
  const binding = shortcuts.getBinding(props.actionId)
  displayValue.value = binding ? formatBinding(binding) : ''
}

function onKeydown(event: KeyboardEvent) {
  event.preventDefault()
  event.stopPropagation()

  if (event.key === 'Escape') {
    fieldRef.value?.blur()
    return
  }

  if (event.key === 'Backspace' || event.key === 'Delete') {
    shortcuts.setBinding(props.actionId, '')
    conflictId.value = null
    displayValue.value = ''
    return
  }

  const binding = eventToBinding(event)
  if (!binding) return

  const conflict = shortcuts.findConflict(props.actionId, binding)
  conflictId.value = conflict
  if (conflict) {
    displayValue.value = formatBinding(binding)
    return
  }

  shortcuts.setBinding(props.actionId, binding)
  displayValue.value = formatBinding(binding)
  fieldRef.value?.blur()
}

function reset() {
  shortcuts.resetBinding(props.actionId)
  conflictId.value = null
}
</script>

<template>
  <div class="shortcut-key-input" :class="{ 'is-recording': recording, 'has-conflict': conflictId }">
    <label class="shortcut-key-input__trigger" :title="t('shortcuts.pressKeys')">
      <span v-if="recording" class="shortcut-key-input__recording">
        <span class="shortcut-key-input__pulse" aria-hidden="true"/>
        {{ t('shortcuts.pressKeys') }}
      </span>
      <span v-else-if="keyChips.length" class="shortcut-key-input__chips">
        <kbd v-for="chip in keyChips" :key="chip" class="shortcut-key-input__chip">{{ chip }}</kbd>
      </span>
      <span v-else class="shortcut-key-input__empty">{{ t('shortcuts.unassigned') }}</span>
      <input
          ref="fieldRef"
          class="shortcut-key-input__field"
          type="text"
          readonly
          :value="displayValue"
          @focus="onFocus"
          @blur="onBlur"
          @keydown="onKeydown"
      />
    </label>

    <button
        v-if="hasBinding"
        class="shortcut-key-input__reset"
        type="button"
        :title="t('shortcuts.resetOne')"
        @click="reset"
    >
      <DwIcon name="refresh" size="sm" :stroke-width="1.5"/>
    </button>

    <p v-if="conflictId" class="shortcut-key-input__error">
      {{ t('shortcuts.conflict', {action: conflictLabel}) }}
    </p>
  </div>
</template>

<style scoped>
.shortcut-key-input {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: flex-end;
  gap: 6px;
  min-width: 0;
}

.shortcut-key-input__trigger {
  position: relative;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 148px;
  min-height: 36px;
  padding: 6px 10px;
  border: 1px solid var(--dw-border-light);
  border-radius: 10px;
  background: var(--dw-bg);
  color: var(--dw-text);
  cursor: pointer;
  transition: border-color 0.15s ease,
  box-shadow 0.15s ease,
  background 0.15s ease;
}

.shortcut-key-input__trigger:hover {
  border-color: color-mix(in srgb, var(--dw-primary) 28%, var(--dw-border));
  background: var(--dw-bg-hover);
}

.shortcut-key-input.is-recording .shortcut-key-input__trigger {
  border-color: var(--dw-primary-border);
  box-shadow: 0 0 0 3px var(--dw-primary-soft);
  background: color-mix(in srgb, var(--dw-primary) 6%, var(--dw-bg));
}

.shortcut-key-input.has-conflict .shortcut-key-input__trigger {
  border-color: #ef4444;
  box-shadow: 0 0 0 3px color-mix(in srgb, #ef4444 18%, transparent);
}

.shortcut-key-input__field {
  position: absolute;
  inset: 0;
  opacity: 0;
  pointer-events: none;
}

.shortcut-key-input__chips {
  display: inline-flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: center;
  gap: 4px;
}

.shortcut-key-input__chip {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 22px;
  min-height: 22px;
  padding: 0 6px;
  border: 1px solid var(--dw-border-light);
  border-radius: 6px;
  background: linear-gradient(
      180deg,
      var(--dw-bg-panel) 0%,
      color-mix(in srgb, var(--dw-bg-muted) 80%, var(--dw-bg-panel)) 100%
  );
  box-shadow: 0 1px 0 color-mix(in srgb, var(--dw-text) 6%, transparent);
  font-family: var(--dw-mono);
  font-size: 11px;
  font-weight: 600;
  line-height: 1;
  color: var(--dw-text-secondary);
}

.shortcut-key-input.is-recording .shortcut-key-input__chip {
  border-color: color-mix(in srgb, var(--dw-primary) 30%, var(--dw-border-light));
  color: var(--dw-primary);
}

.shortcut-key-input__empty {
  font-size: 12px;
  color: var(--dw-text-muted);
}

.shortcut-key-input__recording {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  font-size: 12px;
  font-weight: 500;
  color: var(--dw-primary);
}

.shortcut-key-input__pulse {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: var(--dw-primary);
  animation: shortcut-pulse 1.2s ease-in-out infinite;
}

@keyframes shortcut-pulse {
  0%,
  100% {
    opacity: 0.35;
    transform: scale(0.85);
  }
  50% {
    opacity: 1;
    transform: scale(1);
  }
}

.shortcut-key-input__reset {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  border: 1px solid transparent;
  border-radius: 8px;
  background: transparent;
  color: var(--dw-text-muted);
  cursor: pointer;
  transition: background 0.12s ease, color 0.12s ease, border-color 0.12s ease;
}

.shortcut-key-input__reset:hover {
  border-color: var(--dw-border-light);
  background: var(--dw-bg-hover);
  color: var(--dw-text);
}

.shortcut-key-input__error {
  flex: 1 1 100%;
  margin: 0;
  text-align: right;
  color: #dc2626;
  font-size: 11px;
}
</style>
