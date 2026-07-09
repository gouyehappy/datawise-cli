import type {DatagenApi, DatagenPreviewRequest, DatagenPreviewResult} from '@/shared/api/types'
import type {ExecuteSqlResult} from '@/shared/api/types'
import {postJson} from '@/shared/api/http/request'
import {API_PATHS} from '@/shared/api/http/paths'

export function createHttpDatagenApi(): DatagenApi {
    return {
        previewTableDatagen: async (request: DatagenPreviewRequest): Promise<DatagenPreviewResult> =>
            postJson<DatagenPreviewResult>(API_PATHS.datagen.tablePreview, request),
        executeTableDatagen: async (
            request: DatagenPreviewRequest,
        ): Promise<ExecuteSqlResult> => postJson<ExecuteSqlResult>(API_PATHS.datagen.tableExecute, request),
    }
}

