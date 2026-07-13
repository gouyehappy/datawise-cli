import {api} from '@/shared/api'
import type {FeaturePermissionMap, UserPermissionSummary} from '@/features/auth/types/feature-permission.types'

export const userAdminApi = {
    listUsers: () => api.userAdmin.listUsers(),
    updateUserPermissions: (userId: number, featurePermissions: FeaturePermissionMap) =>
        api.userAdmin.updateUserPermissions(userId, featurePermissions),
}

export type {UserPermissionSummary}
