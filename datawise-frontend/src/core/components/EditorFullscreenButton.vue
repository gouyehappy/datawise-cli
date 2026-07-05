<script setup lang="ts">
import {computed} from 'vue'
import {useI18n} from 'vue-i18n'
import IconButton from '@/core/components/IconButton.vue'
import ConsoleToolbarIcon from '@/core/components/ConsoleToolbarIcon.vue'
import EditorFullscreenIcon from '@/core/components/EditorFullscreenIcon.vue'

const props = withDefaults(
    defineProps<{
      active?: boolean
      variant?: 'floating' | 'toolbar'
    }>(),
    {variant: 'floating'},
)

defineEmits<{
  click: []
}>()

const {t} = useI18n()

const title = computed(() =>
    props.active ? t('editor.exitFullscreen') : t('editor.enterFullscreen'),
)
</script>

<template>
  <IconButton
      class="editor-fs-btn"
      :class="props.variant === 'floating' ? 'editor-fs-btn--floating' : 'editor-fs-btn--toolbar'"
      :active="props.active"
      :title="title"
      @click="$emit('click')"
  >
    <ConsoleToolbarIcon
        v-if="props.variant === 'toolbar'"
        name="fullscreen"
        :active="props.active"
    />
    <EditorFullscreenIcon v-else :active="props.active"/>
  </IconButton>
</template>

<style scoped>
.editor-fs-btn--floating {
  position: absolute;
  top: 8px;
  right: 10px;
  z-index: 2;
  width: 32px;
  height: 32px;
  border-radius: 6px;
  color: var(--dw-text-secondary);
  background: color-mix(in srgb, var(--dw-bg) 88%, transparent);
  border: 1px solid var(--dw-border-light);
  box-shadow: 0 1px 4px rgba(15, 23, 42, 0.08);
  opacity: 0.72;
  backdrop-filter: blur(4px);
  transition: opacity 0.15s ease, background 0.15s ease, color 0.15s ease, box-shadow 0.15s ease;
}

.editor-fs-btn--floating:hover {
  opacity: 1;
  color: var(--dw-text);
  background: var(--dw-bg);
  box-shadow: 0 2px 6px rgba(15, 23, 42, 0.12);
}

.editor-fs-btn--floating.is-active {
  opacity: 1;
  color: var(--dw-primary);
  background: var(--dw-primary-soft);
  border-color: color-mix(in srgb, var(--dw-primary) 25%, var(--dw-border-light));
}

.editor-fs-btn--floating .editor-fs-icon {
  width: 16px;
  height: 16px;
}

.editor-fs-btn--toolbar.is-active {
  color: var(--dw-primary);
}
</style>
