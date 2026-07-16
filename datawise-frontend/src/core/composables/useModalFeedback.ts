import {ref, watch, type Ref} from 'vue'

export type ModalFeedbackVariant = 'success' | 'error' | 'warning' | 'info'

export type ModalFeedback = {
    variant: ModalFeedbackVariant
    message: string
}

/**
 * 弹窗内操作反馈。弹窗打开时禁止 toast（会被遮罩压住），改用 DwInlineAlert。
 * 弹窗关闭后的 toast 仍可用。
 */
export function useModalFeedback(open?: Ref<boolean> | (() => boolean)) {
    const feedback = ref<ModalFeedback | null>(null)

    function setFeedback(variant: ModalFeedbackVariant, message: string) {
        const text = message.trim()
        if (!text) {
            feedback.value = null
            return
        }
        feedback.value = {variant, message: text}
    }

    function clearFeedback() {
        feedback.value = null
    }

    function showSuccess(message: string) {
        setFeedback('success', message)
    }

    function showError(message: string) {
        setFeedback('error', message)
    }

    function showWarning(message: string) {
        setFeedback('warning', message)
    }

    function showInfo(message: string) {
        setFeedback('info', message)
    }

    if (open) {
        watch(
            open,
            (isOpen) => {
                if (!isOpen) clearFeedback()
            },
        )
    }

    return {
        feedback,
        setFeedback,
        clearFeedback,
        showSuccess,
        showError,
        showWarning,
        showInfo,
    }
}
