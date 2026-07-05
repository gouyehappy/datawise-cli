import {computed, ref, type Ref} from 'vue'
import {useI18n} from 'vue-i18n'
import {useToastStore} from '@/features/layout/stores/toast-store'
import {sqlApi} from '@/api'
import type {CancelConsoleSqlResult, SessionKillMode} from '@/shared/api/types'

export function useConsoleSqlCancel(options: {
    sessionKey: Ref<string>
    running: Ref<boolean>
    canKill: Ref<boolean>
}) {
    const {t} = useI18n()
    const toast = useToastStore()
    const confirmOpen = ref(false)
    const pendingMode = ref<SessionKillMode>('connection')
    const cancelling = ref(false)

    const canCancel = computed(() => options.running.value && options.canKill.value)

    async function executeCancel(mode: SessionKillMode): Promise<CancelConsoleSqlResult | null> {
        if (!options.running.value) {
            return null
        }
        if (!options.canKill.value) {
            toast.show(t('console.cancelExecution.readOnly'))
            return null
        }

        cancelling.value = true
        try {
            const result = await sqlApi.cancelExecution({
                sessionKey: options.sessionKey.value,
                mode,
            })
            if (!result.cancelled) {
                toast.show(result.message || t('console.cancelExecution.failed'))
                return result
            }
            if (mode === 'connection') {
                toast.show(t('console.cancelExecution.connectionRequested'))
            } else {
                toast.show(t('console.cancelExecution.queryRequested'))
            }
            confirmOpen.value = false
            return result
        } catch {
            return null
        } finally {
            cancelling.value = false
        }
    }

    function cancelQueryNow() {
        if (!options.running.value) {
            toast.show(t('console.cancelExecution.notRunning'))
            return
        }
        void executeCancel('query')
    }

    function requestCancelConnection() {
        if (!options.canKill.value) {
            toast.show(t('console.cancelExecution.readOnly'))
            return
        }
        if (!options.running.value) {
            toast.show(t('console.cancelExecution.notRunning'))
            return
        }
        pendingMode.value = 'connection'
        confirmOpen.value = true
    }

    function closeConfirm() {
        if (cancelling.value) return
        confirmOpen.value = false
    }

    async function confirmCancel(): Promise<CancelConsoleSqlResult | null> {
        return executeCancel(pendingMode.value)
    }

    return {
        confirmOpen,
        pendingMode,
        cancelling,
        canCancel,
        cancelQueryNow,
        requestCancelConnection,
        closeConfirm,
        confirmCancel,
    }
}
