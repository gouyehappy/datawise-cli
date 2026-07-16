import {defineStore} from 'pinia'
import {ref} from 'vue'

export type ToastVariant = 'info' | 'success' | 'warning' | 'error'

/** @deprecated 使用 info；保留以兼容旧调用 */
type LegacyToastVariant = 'default'

export type ToastShowOptions = {
    durationMs?: number
    variant?: ToastVariant | LegacyToastVariant
}

function normalizeVariant(variant: ToastVariant | LegacyToastVariant | undefined): ToastVariant {
    if (!variant || variant === 'default') return 'info'
    return variant
}

/** 全局 Toast 提示（右下角浮层） */
export const useToastStore = defineStore('toast', () => {
    const message = ref<string | null>(null)
    const variant = ref<ToastVariant>('info')

    let hideTimer: ReturnType<typeof setTimeout> | null = null
    let activeKey = ''

    function show(text: string, options?: ToastShowOptions | number) {
        let durationMs = 2800
        let nextVariant: ToastVariant = 'info'
        if (typeof options === 'number') {
            durationMs = options
        } else if (options) {
            durationMs = options.durationMs ?? 2800
            nextVariant = normalizeVariant(options.variant)
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
                variant.value = 'info'
                activeKey = ''
            }
            hideTimer = null
        }, durationMs)
    }

    function showSuccess(text: string, durationMs = 2800) {
        show(text, {durationMs, variant: 'success'})
    }

    function showWarning(text: string, durationMs = 3600) {
        show(text, {durationMs, variant: 'warning'})
    }

    function showError(text: string, durationMs = 4500) {
        show(text, {durationMs, variant: 'error'})
    }

    function clear() {
        if (hideTimer) clearTimeout(hideTimer)
        hideTimer = null
        message.value = null
        variant.value = 'info'
        activeKey = ''
    }

    return {message, variant, show, showSuccess, showWarning, showError, clear}
})
