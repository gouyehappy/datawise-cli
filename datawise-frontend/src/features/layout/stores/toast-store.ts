import {defineStore} from 'pinia'
import {ref} from 'vue'

export type ToastVariant = 'default' | 'error'

export type ToastShowOptions = {
    durationMs?: number
    variant?: ToastVariant
}

/** 全局 Toast 提示（底部居中浮层） */
export const useToastStore = defineStore('toast', () => {
    const message = ref<string | null>(null)
    const variant = ref<ToastVariant>('default')

    let hideTimer: ReturnType<typeof setTimeout> | null = null
    let activeKey = ''

    function show(text: string, options?: ToastShowOptions | number) {
        let durationMs = 2800
        let nextVariant: ToastVariant = 'default'
        if (typeof options === 'number') {
            durationMs = options
        } else if (options) {
            durationMs = options.durationMs ?? 2800
            nextVariant = options.variant ?? 'default'
        }

        const trimmed = text.trim()
        const key = `${nextVariant}:${trimmed}`
        message.value = trimmed
        variant.value = nextVariant
        activeKey = key

        if (hideTimer) clearTimeout(hideTimer)
        hideTimer = setTimeout(() => {
            if (activeKey === key) {
                message.value = null
                variant.value = 'default'
                activeKey = ''
            }
            hideTimer = null
        }, durationMs)
    }

    function showError(text: string, durationMs = 4500) {
        show(text, {durationMs, variant: 'error'})
    }

    function clear() {
        if (hideTimer) clearTimeout(hideTimer)
        hideTimer = null
        message.value = null
        variant.value = 'default'
        activeKey = ''
    }

    return {message, variant, show, showError, clear}
})
