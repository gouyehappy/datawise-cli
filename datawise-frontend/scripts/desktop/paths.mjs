/**
 * Shared paths and module lists for desktop packaging.
 */
import {dirname, join} from 'node:path'
import {fileURLToPath} from 'node:url'

const scriptsRoot = join(dirname(fileURLToPath(import.meta.url)), '..')

/** datawise-frontend/ */
export const frontendRoot = join(scriptsRoot, '..')
/** monorepo root */
export const repoRoot = join(frontendRoot, '..')
/** datawise-backend/ */
export const backendRoot = join(repoRoot, 'datawise-backend')
/** shared runtime config used by desktop / CLI */
export const repoConfig = join(repoRoot, 'config')

/** Staged desktop payload → electron-builder extraResources */
export const desktopBundleRoot = join(frontendRoot, 'resources/desktop')
export const backendBundleOut = join(desktopBundleRoot, 'backend')
export const configBundleOut = join(desktopBundleRoot, 'config-bundle')
export const bundleConfigSrc = join(frontendRoot, 'resources/bundle-config')

/**
 * Separate from IDE/`mvn` default `target/` so Cursor Java LS cannot
 * corrupt desktop packaging class files mid-compile on Windows.
 */
export const DESKTOP_MAVEN_BUILD_DIR = 'target-desktop'

export const serverTargetDir = join(backendRoot, 'datawise-server', DESKTOP_MAVEN_BUILD_DIR)
export const releaseDir = join(frontendRoot, 'release')
export const winUnpackedDir = join(releaseDir, 'win-unpacked')
export const outputFlagFile = join(frontendRoot, '.electron-builder-output')

/**
 * Connector plugins packaged into config/plugins (via Maven antrun) then
 * copied into the desktop bundle.
 * Excludes shared libs (spi / api / jdbc-runtime) and the aggregator module (all).
 */
export const CONNECTOR_MODULES = [
    'datawise-connectors/datawise-connector-mysql',
    'datawise-connectors/datawise-connector-postgresql',
    'datawise-connectors/datawise-connector-kingbase',
    'datawise-connectors/datawise-connector-opengauss',
    'datawise-connectors/datawise-connector-starrocks',
    'datawise-connectors/datawise-connector-doris',
    'datawise-connectors/datawise-connector-redis',
    'datawise-connectors/datawise-connector-kafka',
    'datawise-connectors/datawise-connector-yarn',
    'datawise-connectors/datawise-connector-ssh',
    'datawise-connectors/datawise-connector-mongodb',
    'datawise-connectors/datawise-connector-sqlserver',
    'datawise-connectors/datawise-connector-oracle',
    'datawise-connectors/datawise-connector-dm',
    'datawise-connectors/datawise-connector-oscar',
    'datawise-connectors/datawise-connector-tidb',
    'datawise-connectors/datawise-connector-tdengine',
    'datawise-connectors/datawise-connector-sybase',
    'datawise-connectors/datawise-connector-phoenix',
    'datawise-connectors/datawise-connector-cachedb',
    'datawise-connectors/datawise-connector-h2',
    'datawise-connectors/datawise-connector-hsql',
    'datawise-connectors/datawise-connector-clickhouse',
    'datawise-connectors/datawise-connector-gbase8a',
    'datawise-connectors/datawise-connector-elasticsearch',
    'datawise-connectors/datawise-connector-kylin',
    'datawise-connectors/datawise-connector-greenplum',
    'datawise-connectors/datawise-connector-oceanbase',
    'datawise-connectors/datawise-connector-highgo',
    'datawise-connectors/datawise-connector-db2',
    'datawise-connectors/datawise-connector-sqlite',
    'datawise-connectors/datawise-connector-presto',
    'datawise-connectors/datawise-connector-trino',
    'datawise-connectors/datawise-connector-hive',
    'datawise-connectors/datawise-connector-flink',
    'datawise-connectors/datawise-connector-gaussdb',
]

/** Single Maven -pl list: server JAR + desktop connector plugins. */
export const DESKTOP_BACKEND_MODULES = ['datawise-server', ...CONNECTOR_MODULES]
