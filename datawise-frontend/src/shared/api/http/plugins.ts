import type {PluginApi} from '@/shared/api/types'
import type {PluginItem} from '@/core/types'
import {getJson} from '@/shared/api/http/request'
import {API_PATHS} from '@/shared/api/http/paths'

export function createHttpPluginApi(): PluginApi {
    return {
        fetchAll: () => getJson<PluginItem[]>(API_PATHS.plugins),
    }
}
