<script setup lang="ts">
import {computed} from 'vue'
import {useI18n} from 'vue-i18n'
import CollapseIcon from './CollapseIcon.vue'
import IconButton from './IconButton.vue'

const props = withDefaults(
    defineProps<{
      /** 覆盖默认「收起」文案（如通知抽屉） */
      label?: string
      size?: 'sm' | 'md' | 'lg'
      disabled?: boolean
    }>(),
    {size: 'sm'},
)

const emit = defineEmits<{
  click: []
}>()

const {t} = useI18n()
const buttonLabel = computed(() => props.label ?? t('common.collapse'))
</script>

<template>
  <IconButton
      :size="size"
      :title="buttonLabel"
      :disabled="disabled"
      @click="emit('click')"
  >
    <CollapseIcon/>
  </IconButton>
</template>
