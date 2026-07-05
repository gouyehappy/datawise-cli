<script setup lang="ts">
import {onMounted, onUnmounted, ref} from 'vue'

const props = withDefaults(
    defineProps<{
      modelValue: number
      min?: number
      max?: number
      axis?: 'horizontal' | 'vertical'
      /** When true, dragging left increases size (for handles on the trailing edge of a right-side panel). */
      invert?: boolean
    }>(),
    {axis: 'horizontal', invert: false},
)

const emit = defineEmits<{ 'update:modelValue': [value: number] }>()

const dragging = ref(false)
const startPos = ref(0)
const startSize = ref(0)

function onPointerDown(e: PointerEvent) {
  dragging.value = true
  startPos.value = props.axis === 'vertical' ? e.clientY : e.clientX
  startSize.value = props.modelValue
  ;(e.target as HTMLElement).setPointerCapture(e.pointerId)
}

function onPointerMove(e: PointerEvent) {
  if (!dragging.value) return
  const rawDelta = props.axis === 'vertical'
      ? startPos.value - e.clientY
      : e.clientX - startPos.value
  const delta = props.invert ? -rawDelta : rawDelta
  const next = startSize.value + delta
  const min = props.min ?? 200
  const max = props.max ?? 480
  emit('update:modelValue', Math.min(max, Math.max(min, next)))
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
      class="resize-handle"
      :class="[axis, { dragging }]"
      :title="axis === 'vertical' ? '拖动调整高度' : '拖动调整宽度'"
      @pointerdown="onPointerDown"
  />
</template>

<style scoped>
.resize-handle {
  flex-shrink: 0;
  background: transparent;
  transition: background 0.15s;
}

.resize-handle.horizontal {
  width: 4px;
  cursor: col-resize;
}

.resize-handle.vertical {
  height: 4px;
  cursor: row-resize;
}

.resize-handle:hover,
.resize-handle.dragging {
  background: var(--dw-primary-soft);
}
</style>
