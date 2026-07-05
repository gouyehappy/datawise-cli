<script setup lang="ts">
import {onMounted, onUnmounted, watch} from 'vue'

const props = withDefaults(
    defineProps<{
      open: boolean
      ariaLabel: string
      width?: string
      maxHeight?: string
      closeOnEscape?: boolean
    }>(),
    {
      width: 'min(640px, calc(100vw - 32px))',
      maxHeight: 'min(60vh, 560px)',
      closeOnEscape: true,
    },
)

const emit = defineEmits<{
  close: []
}>()

function onKeydown(event: KeyboardEvent) {
  if (event.key === 'Escape' && props.open && props.closeOnEscape) {
    event.preventDefault()
    emit('close')
  }
}

watch(
    () => props.open,
    (isOpen) => {
      document.body.style.overflow = isOpen ? 'hidden' : ''
    },
)

onMounted(() => window.addEventListener('keydown', onKeydown))
onUnmounted(() => {
  window.removeEventListener('keydown', onKeydown)
  document.body.style.overflow = ''
})
</script>

<template>
  <Teleport to="body">
    <Transition name="modal-overlay">
      <div v-if="open" class="app-palette-overlay">
        <Transition name="modal-panel" appear>
          <div
              v-if="open"
              class="app-palette"
              role="dialog"
              aria-modal="true"
              :aria-label="ariaLabel"
              :style="{ width, maxHeight }"
          >
            <slot/>
          </div>
        </Transition>
      </div>
    </Transition>
  </Teleport>
</template>
