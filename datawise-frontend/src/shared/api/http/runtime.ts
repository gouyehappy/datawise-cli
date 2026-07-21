import type {RuntimeApi} from '@/shared/api/types'
import type {RuntimeOverview} from '@/features/datasource/types/datasource.types'
import {getJson} from '@/shared/api/http/request'
import {API_PATHS} from '@/shared/api/http/paths'

export function createHttpRuntimeApi(): RuntimeApi {
    return {
        overview: async () => getJson<RuntimeOverview>(API_PATHS.runtime),
        jre: async () => getJson<RuntimeOverview['jre']>(API_PATHS.runtimeJre),
    }
}
