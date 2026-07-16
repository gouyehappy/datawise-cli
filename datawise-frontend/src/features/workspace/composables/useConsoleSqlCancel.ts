import {computed, ref, type Ref} from 'vue'
import {useI18n} from 'vue-i18n'
import {useAppToast} from '@/features/layout/composables/useAppToast'
import {sqlApi} from '@/api'
import type {CancelConsoleSqlResult, SessionKillMode} from '@/shared/api/types'

export function useConsoleSqlCancel(options: {
    sessionKey: Ref<string>
    running: Ref<boolean>
    canKill: Ref<boolean>
}) {
    const {t} = useI18n()
    const toast = useAppToast()
    const confirmOpen = ref(false)
    const pendingMode = ref<SessionKillMode>('connection')
    const cancelling = ref(false)
    /** 对话框内/连点失败时的就地错误；请求成功仍用 toast */
    const errorMessage = ref('')

    const canCancel = computed(() => options.running.value && options.canKill.value)

    async function executeCancel(mode: SessionKillMode): Promise<CancelConsoleSqlResult | null> {
        if (!options.running.value) {
            errorMessage.value = t('console.cancelExecution.notRunning')
            return null
        }
        if (!options.canKill.value) {
            errorMessage.value = t('console.cancelExecution.readOnly')
            return null
        }

        cancelling.value = true
        errorMessage.value = ''
        try {
            const result = await sqlApi.cancelExecution({
                sessionKey: options.sessionKey.value,
                mode,
            })
            if (!result.cancelled) {
                errorMessage.value = result.message || t('console.cancelExecution.failed')
                return result
            }
            if (mode === 'connection') {
                toast.success(t('console.cancelExecution.connectionRequested'))
            } else {
                toast.success(t('console.cancelExecution.queryRequested'))
            }
            confirmOpen.value = false
            return result
        } catch (error) {
            errorMessage.value =
                error instanceof Error ? error.message : t('console.cancelExecution.failed')
            return null
        } finally {
            cancelling.value = false
        }
    }

    function cancelQueryNow() {
        if (!options.running.value) {
            errorMessage.value = t('console.cancelExecution.notRunning')
            return
        }
        void executeCancel('query')
    }

    function requestCancelConnection() {
        errorMessage.value = ''
        if (!options.canKill.value) {
            errorMessage.value = t('console.cancelExecution.readOnly')
            return
        }
        if (!options.running.value) {
            errorMessage.value = t('console.cancelExecution.notRunning')
            return
        }
        pendingMode.value = 'connection'
        confirmOpen.value = true
    }

    function closeConfirm() {
        if (cancelling.value) return
        confirmOpen.value = false
        errorMessage.value = ''
    }

    async function confirmCancel(): Promise<CancelConsoleSqlResult | null> {
        return executeCancel(pendingMode.value)
    }

    return {
        confirmOpen,
        pendingMode,
        cancelling,
        canCancel,
        errorMessage,
        cancelQueryNow,
        requestCancelConnection,
        closeConfirm,
        confirmCancel,
    }
}
