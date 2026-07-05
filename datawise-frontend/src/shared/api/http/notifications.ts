import type {AppNotification} from '@/core/types'
import type {NotificationApi, NotificationPushInput} from '@/shared/api/types'
import {deleteJson, getJson, postJson, putJson} from '@/shared/api/http/request'
import {API_PATHS} from '@/shared/api/http/paths'

export function createHttpNotificationApi(): NotificationApi {
    return {
        fetchAll: () => getJson<AppNotification[]>(API_PATHS.notifications.list),

        push: (input: NotificationPushInput) =>
            postJson<AppNotification>(API_PATHS.notifications.list, input),

        markAllRead: () => putJson<void>(API_PATHS.notifications.readAll, {}),

        markRead: (id) => putJson<void>(API_PATHS.notifications.read(id), {}),

        remove: (id) => deleteJson<void>(API_PATHS.notifications.item(id)),

        clearRead: () => deleteJson<void>(API_PATHS.notifications.clearRead),

        clearAll: () => deleteJson<void>(API_PATHS.notifications.clearAll),
    }
}
