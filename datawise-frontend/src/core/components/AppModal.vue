<script setup lang="ts">
import {onMounted, onUnmounted, watch} from 'vue'
import {useI18n} from 'vue-i18n'
import IconButton from '@/core/components/IconButton.vue'

const props = withDefaults(
    defineProps<{
      open: boolean
      title: string
      subtitle?: string
      width?: string
      /** 点击遮罩是否关闭，默认 false */
      closeOnBackdrop?: boolean
      /** Esc 是否关闭，默认 true */
      closeOnEscape?: boolean
    }>(),
    {
      width: '440px',
      closeOnBackdrop: false,
      closeOnEscape: true,
    },
)

const emit = defineEmits<{
  close: []
}>()

const {t} = useI18n()

function requestClose() {
  emit('close')
}

function onBackdropClick() {
  if (props.closeOnBackdrop) requestClose()
}

function onKeydown(e: KeyboardEvent) {
  if (e.key === 'Escape' && props.open && props.closeOnEscape) {
    requestClose()
  }
}

watch(
    () => props.open,
    (isOpen) => {
      document.body.style.overflow = isOpen ? 'hidden' : ''
    },
)

onMounted(() => document.addEventListener('keydown', onKeydown))
onUnmounted(() => {
  document.removeEventListener('keydown', onKeydown)
  document.body.style.overflow = ''
})
</script>

<template>
  <Teleport to="body">
    <Transition name="modal-overlay">
      <div v-if="open" class="app-modal-overlay" @click.self="onBackdropClick">
        <Transition name="modal-panel" appear>
          <div
              v-if="open"
              class="app-modal"
              role="dialog"
              aria-modal="true"
              :aria-label="title"
              :style="{ maxWidth: width }"
          >
            <header class="app-modal-header">
              <div class="app-modal-heading">
                <h2>{{ title }}</h2>
                <p v-if="subtitle">{{ subtitle }}</p>
              </div>
              <IconButton size="sm" :title="t('common.close')" @click="requestClose">×</IconButton>
            </header>

            <div class="app-modal-body">
              <slot/>
            </div>

            <footer v-if="$slots.footer" class="app-modal-footer">
              <slot name="footer"/>
            </footer>
          </div>
        </Transition>
      </div>
    </Transition>
  </Teleport>
</template>
