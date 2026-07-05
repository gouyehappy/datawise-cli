import {api} from '@/shared/api'
import type {JdbcDriverResolveResult} from '@/features/datasource/types/datasource.types'

export const datasourcesApi = {
    list: () => api.datasources.list(),
    resolveDriver: (mavenCoordinates: string, driverClass: string): Promise<JdbcDriverResolveResult> =>
        api.datasources.resolveDriver({mavenCoordinates, driverClass}),
}
