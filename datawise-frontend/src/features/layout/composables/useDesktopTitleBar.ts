import {onMounted, onUnmounted, ref} from 'vue'
import {desktopPlatform, isDesktopApp} from '@/features/layout/services/desktop-chrome'

export function useDesktopTitleBar() {
    const visible = ref(isDesktopApp())
    const maximized = ref(false)
    const isMac = ref(desktopPlatform() === 'darwin')

    let offMaximize: (() => void) | undefined
    let offState: (() => void) | undefined

    onMounted(() => {
        const chrome = window.datawise?.chrome
        const windowApi = window.datawise?.window
        if (!chrome) return

        void chrome.isMaximized().then((value) => {
            maximized.value = value
        })

        offMaximize = chrome.onMaximizeChange((value) => {
            maximized.value = value
        })

        offState = windowApi?.onStateChange((state) => {
            if (typeof state.maximized === 'boolean') {
                maximized.value = state.maximized
            }
        })
    })

    onUnmounted(() => {
        offMaximize?.()
        offState?.()
    })

    function minimize() {
        void window.datawise?.chrome?.minimize()
    }

    function toggleMaximize() {
        void window.datawise?.chrome?.toggleMaximize()
    }

    function close() {
        void window.datawise?.chrome?.close()
    }

    return {
        visible,
        maximized,
        isMac,
        minimize,
        toggleMaximize,
        close,
    }
}
