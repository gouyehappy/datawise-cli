import type {DbType} from '@/core/types'

export function buildJdbcUrl(
    dbType: DbType,
    host: string,
    port: string,
    extra?: { sid?: string; database?: string },
) {
    switch (dbType) {
        case 'mysql':
        case 'mariadb':
        case 'starrocks':
        case 'doris': {
            const db = extra?.database?.trim()
            return db ? `jdbc:mysql://${host}:${port}/${db}` : `jdbc:mysql://${host}:${port}/`
        }
        case 'oracle':
            return `jdbc:oracle:thin:@${host}:${port}:${extra?.sid ?? 'XE'}`
        case 'dm': {
            const db = extra?.database?.trim()
            return db ? `jdbc:dm://${host}:${port}/${db}` : `jdbc:dm://${host}:${port}`
        }
        case 'oscar': {
            const db = extra?.database?.trim()
            return db ? `jdbc:oscar://${host}:${port}/${db}` : `jdbc:oscar://${host}:${port}/OSCRDB`
        }
        case 'gbase8a': {
            const db = extra?.database?.trim()
            return db ? `jdbc:gbase://${host}:${port}/${db}` : `jdbc:gbase://${host}:${port}/`
        }
        case 'postgresql':
            return `jdbc:postgresql://${host}:${port}/postgres`
        case 'greenplum': {
            const db = extra?.database?.trim()
            return db ? `jdbc:postgresql://${host}:${port}/${db}` : `jdbc:postgresql://${host}:${port}/postgres`
        }
        case 'opengauss': {
            const db = extra?.database?.trim()
            return db ? `jdbc:opengauss://${host}:${port}/${db}` : `jdbc:opengauss://${host}:${port}/test`
        }
        case 'highgo': {
            const db = extra?.database?.trim()
            return db ? `jdbc:highgo://${host}:${port}/${db}` : `jdbc:highgo://${host}:${port}/highgo`
        }
        case 'db2': {
            const db = extra?.database?.trim()
            return db ? `jdbc:db2://${host}:${port}/${db}` : `jdbc:db2://${host}:${port}/testdb`
        }
        case 'sqlite': {
            const file = extra?.database?.trim() || host?.trim()
            return file ? `jdbc:sqlite:${file}` : 'jdbc:sqlite:/tmp/test.db'
        }
        case 'presto':
            return `jdbc:presto://${host}:${port}`
        case 'kingbase': {
            const db = extra?.database?.trim()
            return db ? `jdbc:kingbase8://${host}:${port}/${db}` : `jdbc:kingbase8://${host}:${port}/test`
        }
        case 'sqlserver': {
            const db = extra?.database?.trim()
            const base = `jdbc:sqlserver://${host}:${port}`
            return db ? `${base};DatabaseName=${db}` : base
        }
        case 'redis':
            return `jdbc:redis://${host}:${port}/`
        case 'kafka':
            return host.includes(',') ? `kafka://${host}` : `kafka://${host}:${port}`
        case 'mongodb': {
            const db = extra?.database?.trim()
            return db ? `mongodb://${host}:${port}/${db}` : `mongodb://${host}:${port}/`
        }
        case 'clickhouse': {
            const db = extra?.database?.trim()
            return db ? `jdbc:clickhouse://${host}:${port}/${db}` : `jdbc:clickhouse://${host}:${port}/default`
        }
        case 'elasticsearch':
            return `jdbc:es://${host}:${port}`
        case 'kylin': {
            const project = extra?.database?.trim()
            return project ? `jdbc:kylin://${host}:${port}/${project}` : `jdbc:kylin://${host}:${port}/learn_kylin`
        }
        case 'oceanbase': {
            const db = extra?.database?.trim()
            const path = db ? `/${db}` : '/test'
            return `jdbc:oceanbase://${host}:${port}${path}?pool=false&useUnicode=true&characterEncoding=utf-8&useSSL=false`
        }
        case 'tidb': {
            const db = extra?.database?.trim()
            const path = db ? `/${db}` : '/test'
            return `jdbc:mysql://${host}:${port}${path}?useUnicode=true&characterEncoding=utf-8&useSSL=false&zeroDateTimeBehavior=convertToNull&serverTimezone=Asia/Shanghai&tinyInt1isBit=false&rewriteBatchedStatements=true&useCompression=true`
        }
        case 'tdengine': {
            const db = extra?.database?.trim()
            const path = db ? `/${db}` : '/test'
            return `jdbc:TAOS-RS://${host}:${port}${path}?charset=UTF-8&locale=en_US.UTF-8&timezone=UTC+8`
        }
        case 'sybase': {
            const db = extra?.database?.trim()
            return db ? `jdbc:sybase:Tds:${host}:${port}/${db}?charset=cp936` : `jdbc:sybase:Tds:${host}:${port}/test?charset=cp936`
        }
        case 'phoenix':
            return `jdbc:phoenix:${host}:${port}`
        case 'cachedb':
            return `jdbc:Cache://${host}:${port}`
        case 'h2': {
            const db = extra?.database?.trim()
            return db ? `jdbc:h2:tcp://${host}:${port}/${db}` : `jdbc:h2:tcp://${host}:${port}/test`
        }
        case 'hsql': {
            const db = extra?.database?.trim()
            return db ? `jdbc:hsqldb://${host}:${port}/${db}` : `jdbc:hsqldb://${host}:${port}/test`
        }
        case 'generic':
        case 'other':
            return `jdbc:${dbType}://${host}:${port}/`
        case 'dameng': {
            const db = extra?.database?.trim()
            return db ? `jdbc:dm://${host}:${port}/${db}` : `jdbc:dm://${host}:${port}`
        }
        case 'gaussdb': {
            const db = extra?.database?.trim()
            return db ? `jdbc:gaussdb://${host}:${port}/${db}` : `jdbc:gaussdb://${host}:${port}/postgres`
        }
        case 'flink':
            return `jdbc:flink://${host}:${port}`
        case 'trino':
            return `jdbc:trino://${host}:${port}`
        case 'hive': {
            const db = extra?.database?.trim()
            return db ? `jdbc:hive2://${host}:${port}/${db}` : `jdbc:hive2://${host}:${port}/`
        }
        default:
            return `jdbc:${dbType}://${host}:${port}/`
    }
}
