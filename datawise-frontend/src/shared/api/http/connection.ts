import type {ConnectionApi, ConnectionTestResult} from '@/shared/api/types'
import {postJson} from '@/shared/api/http/request'
import {API_PATHS} from '@/shared/api/http/paths'

export function createHttpConnectionApi(): ConnectionApi {
    return {
        test: async (config) =>
            postJson<ConnectionTestResult>(API_PATHS.connection.test, config, {silent: true}),
    }
}
