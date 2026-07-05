import {computed, onMounted, onUnmounted, ref} from 'vue'

export const SIDE_PANEL_RESIZE_MAX_PX = 960
export const SIDE_PANEL_RESIZE_MAX_VIEWPORT_RATIO = 0.55
export const EXPLORER_PANEL_RESIZE_MIN = 180
export const SHORTCUT_PANEL_RESIZE_MIN = 240

export function useSidePanelResizeBounds(options: {
    min?: number
    maxPx?: number
    maxViewportRatio?: number
} = {}) {
    const min = options.min ?? EXPLORER_PANEL_RESIZE_MIN
    const maxPx = options.maxPx ?? SIDE_PANEL_RESIZE_MAX_PX
    const maxViewportRatio = options.maxViewportRatio ?? SIDE_PANEL_RESIZE_MAX_VIEWPORT_RATIO

    const viewportWidth = ref(
        typeof window !== 'undefined' ? window.innerWidth : 1920,
    )

    function onWindowResize() {
        viewportWidth.value = window.innerWidth
    }

    onMounted(() => window.addEventListener('resize', onWindowResize))
    onUnmounted(() => window.removeEventListener('resize', onWindowResize))

    const max = computed(() =>
        Math.round(Math.min(maxPx, viewportWidth.value * maxViewportRatio)),
    )

    return {min, max}
}
