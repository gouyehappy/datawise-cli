<script setup lang="ts">
export interface SettingsSegmentTab {
  id: string
  label: string
  count?: number
}

withDefaults(
    defineProps<{
      tabs: SettingsSegmentTab[]
      modelValue: string
      ariaLabel?: string
      stretch?: boolean
      variant?: 'bar' | 'inline'
    }>(),
    {
      stretch: false,
      variant: 'bar',
    },
)

const emit = defineEmits<{
  'update:modelValue': [id: string]
}>()

function select(id: string) {
  emit('update:modelValue', id)
}
</script>

<template>
  <nav
      class="dw-segment settings-segment-tabs"
      :class="{
        'dw-segment--stretch settings-segment-tabs--stretch': stretch,
        'settings-segment-tabs--inline': variant === 'inline',
      }"
      role="tablist"
      :aria-label="ariaLabel"
  >
    <button
        v-for="tab in tabs"
        :key="tab.id"
        class="dw-segment__btn settings-segment-tabs__btn"
        :class="{'is-active': modelValue === tab.id}"
        type="button"
        role="tab"
        :aria-selected="modelValue === tab.id"
        @click="select(tab.id)"
    >
      <span class="settings-segment-tabs__label">{{ tab.label }}</span>
      <span v-if="tab.count != null" class="settings-segment-tabs__count">{{ tab.count }}</span>
    </button>
  </nav>
</template>
