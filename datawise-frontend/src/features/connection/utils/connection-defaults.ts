import type {ConnectionConfig, DbType} from '@/core/types'
import type {DatasourceDefinition} from '@/features/datasource/types/datasource.types'
import {
    CONNECTION_AUTH_OPTIONS,
    CONNECTION_ENV_DEFAULT,
    CONNECTION_STORAGE_OPTIONS,
    DRIVER_PRESETS,
} from '../constants/connection-options'
import {DEFAULT_PORTS} from '../constants/db-types'
import {buildJdbcUrl} from './jdbc-url'

export function isUnsavedConnectionId(connectionId: string | undefined): boolean {
    return Boolean(connectionId?.trim().startsWith('new-'))
}

export function createDefaultConnection(
    dbType: DbType,
    catalogItem?: DatasourceDefinition | null,
): ConnectionConfig {
    const port = catalogItem?.defaultPort ?? DEFAULT_PORTS[dbType] ?? '3306'
    return {
        id: `new-${Date.now()}`,
        name: '',
        dbType,
        env: CONNECTION_ENV_DEFAULT,
        storage: CONNECTION_STORAGE_OPTIONS[0],
        host: 'localhost',
        port,
        auth: dbType === 'redis' || dbType === 'kafka' || dbType === 'kudu'
            ? CONNECTION_AUTH_OPTIONS[1]
            : dbType === 'ssh'
              ? CONNECTION_AUTH_OPTIONS[0]
              : CONNECTION_AUTH_OPTIONS[0],
        user: dbType === 'redis' || dbType === 'kafka' || dbType === 'kudu'
            ? ''
            : dbType === 'ssh'
              ? 'root'
              : dbType === 'sqlserver'
                ? 'sa'
                : 'root',
        password: '',
        serviceType: dbType === 'oracle' ? 'SID' : undefined,
        sid: dbType === 'oracle' ? 'XE' : undefined,
        driver: catalogItem?.defaultDriverMaven ?? DRIVER_PRESETS[dbType]?.jar,
        driverClass: catalogItem?.defaultDriverClass ?? DRIVER_PRESETS[dbType]?.driverClass,
        database: '',
        sshEnabled: false,
        sshHost: '',
        sshPort: '22',
        sshUser: '',
        sshPassword: '',
        sshPrivateKey: '',
        sshPassphrase: '',
        advancedConfig: '',
        url: buildJdbcUrl(dbType, 'localhost', port, {sid: 'XE', database: ''}),
    }
}

export function isJdbcDriverRequired(
    dbType: DbType,
    catalogItem?: DatasourceDefinition | null,
): boolean {
    if (catalogItem) return catalogItem.jdbcDriverRequired
    return dbType !== 'redis' && dbType !== 'kafka' && dbType !== 'mongodb' && dbType !== 'ssh' && dbType !== 'kudu'
}
