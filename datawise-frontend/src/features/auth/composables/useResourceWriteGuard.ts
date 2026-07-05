import {computed} from 'vue'
import type {UserResourceType} from '@/features/auth/types/user-resource.types'
import {useUserResourcePolicy} from '@/features/auth/composables/useUserResourcePolicy'
import {useToastStore} from '@/features/layout/stores/toast-store'

/** 设置页 / 工作区写操作守卫：按资源裁决访客只读并统一 Toast。 */
export function useResourceWriteGuard(resource: UserResourceType) {
    const policy = useUserResourcePolicy()
    const toast = useToastStore()
    const readOnly = computed(() => !policy.canWrite(resource))
    const hint = policy.readOnlyHint

    function denyIfReadOnly(): boolean {
        if (!readOnly.value) return false
        toast.show(hint.value)
        return true
    }

    function guardWrite(action: () => void): boolean {
        return policy.guardWrite(resource, action, () => toast.show(hint.value))
    }

    return {readOnly, hint, denyIfReadOnly, guardWrite}
}
