import type {UserAdminApi} from '@/shared/api/types'
import type {FeaturePermissionMap, UserPermissionSummary} from '@/features/auth/types/feature-permission.types'
import {API_PATHS} from '@/shared/api/http/paths'
import {getJson, putJson} from '@/shared/api/http/request'

export function createHttpUserAdminApi(): UserAdminApi {
    return {
        listUsers: async () => getJson<UserPermissionSummary[]>(API_PATHS.admin.users),
        updateUserPermissions: async (userId, featurePermissions) =>
            putJson<UserPermissionSummary>(
                API_PATHS.admin.userPermissions(userId),
                {featurePermissions} satisfies {featurePermissions: FeaturePermissionMap},
            ),
    }
}
