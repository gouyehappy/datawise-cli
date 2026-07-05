<script setup lang="ts">
import {onMounted, onUnmounted, watch} from 'vue'

const props = withDefaults(
    defineProps<{
      open: boolean
      ariaLabel: string
      width?: string
      closeOnEscape?: boolean
    }>(),
    {
      width: 'min(520px, 100vw)',
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
      <div v-if="open" class="app-drawer-overlay">
        <div class="app-drawer-backdrop" aria-hidden="true"/>
        <Transition name="app-drawer-panel" appear>
          <div
              v-if="open"
              class="app-drawer-panel"
              role="dialog"
              aria-modal="true"
              :aria-label="ariaLabel"
              :style="{ width }"
          >
            <slot/>
          </div>
        </Transition>
      </div>
    </Transition>
  </Teleport>
</template>
