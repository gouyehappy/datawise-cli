import {ref} from 'vue'
import {useI18n} from 'vue-i18n'
import type {ConnectionConfig} from '@/core/types'
import {connectionApi} from '@/api'
import {registerConnectionHealthCheck} from '@/features/explorer/services/register-connection-health.service'

/** 连接测试：校验 + 调用 api.connection.test */
export function useConnectionTest(
    getPayload: () => ConnectionConfig,
    getConnectionId?: () => string | undefined,
) {
    const {t} = useI18n()
    const testing = ref(false)
    const testMessage = ref<string | null>(null)
    const testOk = ref<boolean | null>(null)

    async function testConnection() {
        testing.value = true
        testMessage.value = null
        const payload = getPayload()

        if (!payload.host?.trim()) {
            testOk.value = false
            testMessage.value = t('connection.testHostRequired')
            testing.value = false
            return
        }
        if (payload.dbType !== 'redis' && payload.auth !== 'NONE' && !payload.user?.trim()) {
            testOk.value = false
            testMessage.value = t('connection.testUserRequired')
            testing.value = false
            return
        }

        try {
            const result = await connectionApi.test(payload)
            testOk.value = result.ok
            testMessage.value = result.ok
                ? t('connection.testSuccess', {message: result.message, latency: result.latencyMs})
                : result.message
            if (result.ok) {
                const connectionId = getConnectionId?.()
                if (connectionId) {
                    registerConnectionHealthCheck(connectionId, 'ok')
                }
            }
        } catch (error) {
            testOk.value = false
            testMessage.value = error instanceof Error ? error.message : t('connection.testFailed')
        } finally {
            testing.value = false
        }
    }

    return {testing, testMessage, testOk, testConnection}
}
