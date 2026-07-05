import {onMounted, onUnmounted, ref} from 'vue'

/** SQL 编辑器全屏：隐藏结果区，Esc 退出 */
export function useEditorFullscreen() {
    const isFullscreen = ref(false)

    function toggle() {
        isFullscreen.value = !isFullscreen.value
    }

    function exit() {
        isFullscreen.value = false
    }

    function onKeydown(e: KeyboardEvent) {
        if (e.key !== 'Escape' || !isFullscreen.value) return
        e.preventDefault()
        exit()
    }

    onMounted(() => window.addEventListener('keydown', onKeydown))
    onUnmounted(() => window.removeEventListener('keydown', onKeydown))

    return {isFullscreen, toggle, exit}
}
