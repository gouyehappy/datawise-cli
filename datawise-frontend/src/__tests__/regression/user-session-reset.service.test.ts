import assert from 'node:assert/strict'
import {describe, it} from 'node:test'
import {AI_CHAT_STORAGE_KEY} from '@/features/ai/chat/services/ai-chat-persistence.service'
import {AI_ANALYSIS_TEMPLATE_STORAGE_KEY} from '@/features/ai/analysis/types/analysis-template.types'
import {
    APP_CONFIG_KEY,
    resolveAppConfigStorageKey,
    resolveUserStorageKey,
    setAppConfigStorageScope,
} from '@/shared/config/app-config-storage-scope'

describe('user session app config scope', () => {
    it('setAppConfigStorageScope isolates storage keys per registered user id', () => {
        setAppConfigStorageScope({userId: 7, userName: 'admin', isGuest: false})
        assert.equal(resolveAppConfigStorageKey(), `${APP_CONFIG_KEY}:user:7`)
        assert.equal(resolveUserStorageKey(AI_CHAT_STORAGE_KEY), `${AI_CHAT_STORAGE_KEY}:user:7`)
        assert.equal(
            resolveUserStorageKey(AI_ANALYSIS_TEMPLATE_STORAGE_KEY),
            `${AI_ANALYSIS_TEMPLATE_STORAGE_KEY}:user:7`,
        )

        setAppConfigStorageScope({userId: 9, userName: 'bob', isGuest: false})
        assert.equal(resolveAppConfigStorageKey(), `${APP_CONFIG_KEY}:user:9`)

        setAppConfigStorageScope({isGuest: true})
        assert.equal(resolveAppConfigStorageKey(), `${APP_CONFIG_KEY}:guest`)
        assert.equal(resolveUserStorageKey(AI_CHAT_STORAGE_KEY), `${AI_CHAT_STORAGE_KEY}:guest`)
    })
})
