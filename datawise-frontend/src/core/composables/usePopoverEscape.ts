import {onUnmounted, watch, type MaybeRefOrGetter, toValue} from 'vue'

/**
 * 浮层关闭：仅 Esc，不因点击外部关闭（与 AppModal 一致）。
 */
export function usePopoverEscape(open: MaybeRefOrGetter<boolean>, onClose: () => void) {
  function onKeydown(event: KeyboardEvent) {
    if (event.key !== 'Escape' || !toValue(open)) return
    event.preventDefault()
    event.stopPropagation()
    onClose()
  }

  watch(
      () => toValue(open),
      (isOpen) => {
        if (isOpen) {
          window.addEventListener('keydown', onKeydown, true)
        } else {
          window.removeEventListener('keydown', onKeydown, true)
        }
      },
  )

  onUnmounted(() => {
    window.removeEventListener('keydown', onKeydown, true)
  })
}
