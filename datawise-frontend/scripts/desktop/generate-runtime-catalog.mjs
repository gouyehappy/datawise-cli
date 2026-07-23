/**
 * Generate runtime-catalog.json from built connector plugin JARs.
 *
 * Usage:
 *   node scripts/desktop/generate-runtime-catalog.mjs [--plugins-dir path] [--out path]
 */
import {createHash} from 'node:crypto'
import {createReadStream, existsSync, readFileSync, readdirSync, statSync, writeFileSync} from 'node:fs'
import {basename, join} from 'node:path'
import {fileURLToPath} from 'node:url'
import {repoConfig, repoRoot} from './paths.mjs'
import {isDirectRun, log} from './lib.mjs'

/** Connector id → packaging metadata (aligned with DbType + CONNECTOR_MODULES). */
const CONNECTOR_META = {
    mysql: {label: 'MySQL / MariaDB', tier: 'core', primary: true, jdbcDriver: {maven: 'com.mysql:mysql-connector-j:8.4.0', driverClass: 'com.mysql.cj.jdbc.Driver'}},
    postgresql: {label: 'PostgreSQL', tier: 'core', primary: true, jdbcDriver: {maven: 'org.postgresql:postgresql:42.7.4', driverClass: 'org.postgresql.Driver'}},
    sqlite3: {label: 'SQLite', tier: 'core', primary: false, jdbcDriver: {maven: 'org.xerial:sqlite-jdbc:3.46.1.3', driverClass: 'org.sqlite.JDBC'}},
    h2: {label: 'H2', tier: 'core', primary: false, jdbcDriver: {maven: 'com.h2database:h2:2.3.232', driverClass: 'org.h2.Driver'}},
    kingbase: {label: 'Kingbase', tier: 'common', primary: false},
    opengauss: {label: 'openGauss', tier: 'common', primary: false},
    starrocks: {label: 'StarRocks', tier: 'common', primary: false},
    doris: {label: 'Apache Doris', tier: 'common', primary: false},
    redis: {label: 'Redis', tier: 'common', primary: false},
    kafka: {label: 'Apache Kafka', tier: 'common', primary: false},
    yarn: {label: 'Apache YARN', tier: 'common', primary: false},
    mongodb: {label: 'MongoDB', tier: 'common', primary: false},
    sqlserver: {label: 'SQL Server', tier: 'common', primary: true, jdbcDriver: {maven: 'com.microsoft.sqlserver:mssql-jdbc:12.8.1.jre11', driverClass: 'com.microsoft.sqlserver.jdbc.SQLServerDriver'}},
    oracle: {label: 'Oracle', tier: 'common', primary: true},
    dm: {label: 'Dameng (DM)', tier: 'niche', primary: false},
    oscar: {label: 'Oscar', tier: 'niche', primary: false},
    tidb: {label: 'TiDB', tier: 'common', primary: false},
    tdengine: {label: 'TDengine', tier: 'niche', primary: false},
    sybase: {label: 'Sybase', tier: 'niche', primary: false},
    phoenix: {label: 'Apache Phoenix', tier: 'niche', primary: false},
    cachedb: {label: 'InterSystems Caché', tier: 'niche', primary: false},
    hsql: {label: 'HSQLDB', tier: 'niche', primary: false},
    clickhouse: {label: 'ClickHouse', tier: 'common', primary: false},
    gbase8a: {label: 'GBase 8a', tier: 'niche', primary: false},
    elasticsearch: {label: 'Elasticsearch', tier: 'common', primary: false},
    kylin: {label: 'Apache Kylin', tier: 'niche', primary: false},
    greenplum: {label: 'Greenplum', tier: 'common', primary: false},
    oceanbase: {label: 'OceanBase', tier: 'common', primary: false},
    highgo: {label: 'HighGo', tier: 'niche', primary: false},
    db2: {label: 'IBM Db2', tier: 'common', primary: false},
    presto: {label: 'Presto', tier: 'common', primary: false},
    trino: {label: 'Trino', tier: 'common', primary: false},
    hive: {label: 'Apache Hive', tier: 'common', primary: false},
    flink: {label: 'Apache Flink', tier: 'niche', primary: false},
    gaussdb: {label: 'GaussDB', tier: 'common', primary: false},
}

const MODULE_TO_CONNECTOR_ID = {
    'datawise-connector-mysql': 'mysql',
    'datawise-connector-postgresql': 'postgresql',
    'datawise-connector-sqlite': 'sqlite3',
    'datawise-connector-h2': 'h2',
    'datawise-connector-kingbase': 'kingbase',
    'datawise-connector-opengauss': 'opengauss',
    'datawise-connector-starrocks': 'starrocks',
    'datawise-connector-doris': 'doris',
    'datawise-connector-redis': 'redis',
    'datawise-connector-kafka': 'kafka',
    'datawise-connector-yarn': 'yarn',
    'datawise-connector-mongodb': 'mongodb',
    'datawise-connector-sqlserver': 'sqlserver',
    'datawise-connector-oracle': 'oracle',
    'datawise-connector-dm': 'dm',
    'datawise-connector-oscar': 'oscar',
    'datawise-connector-tidb': 'tidb',
    'datawise-connector-tdengine': 'tdengine',
    'datawise-connector-sybase': 'sybase',
    'datawise-connector-phoenix': 'phoenix',
    'datawise-connector-cachedb': 'cachedb',
    'datawise-connector-hsql': 'hsql',
    'datawise-connector-clickhouse': 'clickhouse',
    'datawise-connector-gbase8a': 'gbase8a',
    'datawise-connector-elasticsearch': 'elasticsearch',
    'datawise-connector-kylin': 'kylin',
    'datawise-connector-greenplum': 'greenplum',
    'datawise-connector-oceanbase': 'oceanbase',
    'datawise-connector-highgo': 'highgo',
    'datawise-connector-db2': 'db2',
    'datawise-connector-presto': 'presto',
    'datawise-connector-trino': 'trino',
    'datawise-connector-hive': 'hive',
    'datawise-connector-flink': 'flink',
    'datawise-connector-gaussdb': 'gaussdb',
}

function parseArgs(argv) {
    let pluginsDir = join(repoConfig, 'plugins')
    let out = join(repoRoot, 'datawise-frontend', 'resources', 'bundle-config', 'runtime-catalog.json')
    const pluginsIdx = argv.indexOf('--plugins-dir')
    if (pluginsIdx >= 0 && argv[pluginsIdx + 1]) {
        pluginsDir = argv[pluginsIdx + 1]
    }
    const outIdx = argv.indexOf('--out')
    if (outIdx >= 0 && argv[outIdx + 1]) {
        out = argv[outIdx + 1]
    }
    return {pluginsDir, out}
}

function connectorIdFromJarName(jarName) {
    const match = jarName.match(/^datawise-connector-([a-z0-9]+)-\d/)
    if (!match) return null
    const moduleSuffix = `datawise-connector-${match[1]}`
    return MODULE_TO_CONNECTOR_ID[moduleSuffix] ?? match[1]
}

function sha256File(filePath) {
    return new Promise((resolve, reject) => {
        const hash = createHash('sha256')
        createReadStream(filePath)
            .on('data', (chunk) => hash.update(chunk))
            .on('error', reject)
            .on('end', () => resolve(hash.digest('hex')))
    })
}

function readPackageVersion() {
    try {
        const pkg = JSON.parse(
            readFileSync(join(repoRoot, 'datawise-frontend', 'package.json'), 'utf8'),
        )
        return pkg.version ?? '4.0.1'
    } catch {
        return '4.0.1'
    }
}

async function generateCatalog({pluginsDir, out, releaseTag}) {
    const version = releaseTag || readPackageVersion()
    const baseUrl = `https://github.com/gouyehappy/datawise-cli/releases/download/v${version}/connectors/`
    const connectors = []

    if (!existsSync(pluginsDir)) {
        log('runtime-catalog', `plugins dir missing: ${pluginsDir}`)
    } else {
        const jars = readdirSync(pluginsDir)
            .filter((name) => name.endsWith('.jar'))
            .sort()
        for (const jar of jars) {
            const id = connectorIdFromJarName(jar)
            if (!id) continue
            const meta = CONNECTOR_META[id] ?? {label: id, tier: 'common', primary: false}
            const jarPath = join(pluginsDir, jar)
            const sizeBytes = statSync(jarPath).size
            const sha256 = await sha256File(jarPath)
            const versionMatch = jar.match(/-(\d+\.\d+\.\d+(?:[-.][\w.]+)?)\.jar$/)
            const pluginVersion = versionMatch?.[1] ?? version
            connectors.push({
                id,
                label: meta.label,
                tier: meta.tier,
                primary: meta.primary,
                jar,
                version: pluginVersion,
                downloadUrl: `${baseUrl}${jar}`,
                sha256,
                sizeBytes,
                ...(meta.jdbcDriver ? {jdbcDriver: meta.jdbcDriver} : {}),
            })
        }
    }

    const catalog = {
        schemaVersion: 1,
        channel: 'stable',
        updatedAt: new Date().toISOString(),
        releaseVersion: version,
        baseUrl,
        connectors,
    }
    writeFileSync(out, `${JSON.stringify(catalog, null, 2)}\n`, 'utf8')
    log('runtime-catalog', `wrote ${connectors.length} connector(s) → ${out}`)
    return catalog
}

/**
 * @param {{pluginsDir?: string, out?: string, releaseTag?: string}} [options]
 */
export async function generateRuntimeCatalog(options = {}) {
    const defaults = parseArgs([])
    return generateCatalog({
        pluginsDir: options.pluginsDir ?? defaults.pluginsDir,
        out: options.out ?? defaults.out,
        releaseTag: options.releaseTag,
    })
}

if (isDirectRun(import.meta.url)) {
    const args = parseArgs(process.argv.slice(2))
    await generateCatalog(args)
}
