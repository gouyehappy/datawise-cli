<script setup lang="ts">
import {computed} from 'vue'
import type {ConsoleToolbarIconName} from '@/core/types/console-toolbar-icon'
import {DwIcon} from '@/core/icons'
import type {DwIconName} from '@/core/icons'

const props = withDefaults(
    defineProps<{
      name: ConsoleToolbarIconName
      active?: boolean
      muted?: boolean
    }>(),
    {
      active: false,
      muted: false,
    },
)

const ICON_MAP: Record<ConsoleToolbarIconName, DwIconName> = {
    run: 'run',
    stop: 'stop',
    explainPlan: 'explain-plan',
    submit: 'submit',
    rollback: 'rollback',
    disconnect: 'disconnect',
    save: 'save',
    saveAs: 'save-as',
    bookmark: 'bookmark',
    viewModel: 'view-model',
    format: 'format',
    fullscreen: 'fullscreen',
    ai: 'ai',
}

const dwName = computed(() => ICON_MAP[props.name])
</script>

<template>
  <DwIcon
      class="dw-console-glyph"
      :class="{ 'dw-console-glyph--muted': muted }"
      :name="dwName"
      :active="active"
      :muted="muted"
      fit
  />
</template>
