import type {ApiClient} from '@/shared/api/types'
import {createHttpAuthApi} from '@/shared/api/http/auth'
import {createHttpSqlApi} from '@/shared/api/http/sql'
import {createHttpAiApi} from '@/shared/api/http/ai'
import {createHttpTableDataApi} from '@/shared/api/http/table-data'
import {createHttpTableDetailApi} from '@/shared/api/http/table-detail'
import {createHttpConnectionApi} from '@/shared/api/http/connection'
import {createHttpTerminalApi} from '@/shared/api/http/terminal'
import {createHttpExplorerApi} from '@/shared/api/http/explorer'
import {createHttpWorkspaceApi} from '@/shared/api/http/workspace'
import {createHttpNotificationApi} from '@/shared/api/http/notifications'
import {createHttpPluginApi} from '@/shared/api/http/plugins'
import {createHttpTeamApi} from '@/shared/api/http/teams'
import {createHttpSystemApi} from '@/shared/api/http/system'
import {createHttpConfigApi} from '@/shared/api/http/config'
import {createHttpDatasourcesApi} from '@/shared/api/http/datasources'
import {createHttpMigrationApi} from '@/shared/api/http/migration'

/** HTTP 实现：按域组装，路径见 http/paths.ts */
export function createHttpApiClient(): ApiClient {
    return {
        auth: createHttpAuthApi(),
        sql: createHttpSqlApi(),
        ai: createHttpAiApi(),
        tableData: createHttpTableDataApi(),
        tableDetail: createHttpTableDetailApi(),
        connection: createHttpConnectionApi(),
        terminal: createHttpTerminalApi(),
        explorer: createHttpExplorerApi(),
        workspace: createHttpWorkspaceApi(),
        notifications: createHttpNotificationApi(),
        plugins: createHttpPluginApi(),
        teams: createHttpTeamApi(),
        system: createHttpSystemApi(),
        config: createHttpConfigApi(),
        datasources: createHttpDatasourcesApi(),
        migration: createHttpMigrationApi(),
    }
}

export {API_PATHS} from '@/shared/api/http/paths'
