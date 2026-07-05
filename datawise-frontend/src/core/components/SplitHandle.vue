<script setup lang="ts">
import {onMounted, onUnmounted, ref} from 'vue'

const props = withDefaults(
    defineProps<{
      modelValue: number
      min?: number
      max?: number
      direction?: 'horizontal' | 'vertical'
    }>(),
    {min: 120, max: 800, direction: 'horizontal'},
)

const emit = defineEmits<{ 'update:modelValue': [value: number] }>()

const dragging = ref(false)
const startPos = ref(0)
const startSize = ref(0)

function onPointerDown(e: PointerEvent) {
  dragging.value = true
  startPos.value = props.direction === 'horizontal' ? e.clientY : e.clientX
  startSize.value = props.modelValue
  ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
}

function onPointerMove(e: PointerEvent) {
  if (!dragging.value) return
  const pos = props.direction === 'horizontal' ? e.clientY : e.clientX
  const delta = pos - startPos.value
  emit('update:modelValue', Math.min(props.max, Math.max(props.min, startSize.value + delta)))
}

function onPointerUp() {
  dragging.value = false
}

onMounted(() => {
  window.addEventListener('pointermove', onPointerMove)
  window.addEventListener('pointerup', onPointerUp)
})

onUnmounted(() => {
  window.removeEventListener('pointermove', onPointerMove)
  window.removeEventListener('pointerup', onPointerUp)
})
</script>

<template>
  <div
      class="split-handle"
      :class="[direction, { dragging }]"
      @pointerdown="onPointerDown"
  />
</template>

<style scoped>
.split-handle {
  flex-shrink: 0;
  background: var(--dw-border-light);
  transition: background 0.15s;
}

.split-handle.horizontal {
  height: 4px;
  cursor: row-resize;
}

.split-handle.vertical {
  width: 4px;
  cursor: col-resize;
}

.split-handle:hover,
.split-handle.dragging {
  background: var(--dw-primary-soft);
}
</style>
