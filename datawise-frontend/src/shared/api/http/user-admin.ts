import type {UserAdminApi} from '@/shared/api/types'
import type {
    FeaturePermissionMap,
    TenantRoleSummary,
    UserPermissionSummary,
} from '@/features/auth/types/feature-permission.types'
import {API_PATHS} from '@/shared/api/http/paths'
import {deleteJson, getJson, postJson, putJson} from '@/shared/api/http/request'

export function createHttpUserAdminApi(): UserAdminApi {
    return {
        listUsers: async () => getJson<UserPermissionSummary[]>(API_PATHS.admin.users),
        listTenantRoles: async () => getJson<TenantRoleSummary[]>(API_PATHS.admin.tenantRoles),
        createTenantRole: async (body) =>
            postJson<TenantRoleSummary>(API_PATHS.admin.tenantRoles, body),
        updateTenantRole: async (roleId, body) =>
            putJson<TenantRoleSummary>(API_PATHS.admin.tenantRole(roleId), body),
        deleteTenantRole: async (roleId) =>
            deleteJson<void>(API_PATHS.admin.tenantRole(roleId)),
        updateUserPermissions: async (userId, featurePermissions) =>
            putJson<UserPermissionSummary>(
                API_PATHS.admin.userPermissions(userId),
                {featurePermissions} satisfies {featurePermissions: FeaturePermissionMap},
            ),
        updateUserRoles: async (userId, roleIds) =>
            putJson<UserPermissionSummary>(
                API_PATHS.admin.userRoles(userId),
                {roleIds} satisfies {roleIds: string[]},
            ),
    }
}
