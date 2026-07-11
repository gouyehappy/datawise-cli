import {dirname, join} from 'node:path'
import {fileURLToPath} from 'node:url'

const scriptsRoot = join(dirname(fileURLToPath(import.meta.url)), '..')
export const frontendRoot = join(scriptsRoot, '..')
export const repoRoot = join(frontendRoot, '..')
export const backendRoot = join(repoRoot, 'datawise-backend')

export const desktopBundleRoot = join(frontendRoot, 'resources/desktop')
export const backendBundleOut = join(desktopBundleRoot, 'backend')
export const configBundleOut = join(desktopBundleRoot, 'config-bundle')
export const bundleConfigSrc = join(frontendRoot, 'resources/bundle-config')
export const repoConfig = join(repoRoot, 'config')
export const serverTargetDir = join(backendRoot, 'datawise-server/target')

export const releaseDir = join(frontendRoot, 'release')
export const winUnpackedDir = join(releaseDir, 'win-unpacked')
export const outputFlagFile = join(frontendRoot, '.electron-builder-output')

export const CONNECTOR_MODULES = [
    'datawise-connectors/datawise-connector-mysql',
    'datawise-connectors/datawise-connector-postgresql',
    'datawise-connectors/datawise-connector-redis',
    'datawise-connectors/datawise-connector-starrocks',
    'datawise-connectors/datawise-connector-doris',
    'datawise-connectors/datawise-connector-mongodb',
    'datawise-connectors/datawise-connector-kafka',
    'datawise-connectors/datawise-connector-sqlserver',
    'datawise-connectors/datawise-connector-oracle',
    'datawise-connectors/datawise-connector-dm',
    'datawise-connectors/datawise-connector-clickhouse',
    'datawise-connectors/datawise-connector-gbase8a',
    'datawise-connectors/datawise-connector-elasticsearch',
    'datawise-connectors/datawise-connector-kylin',
    'datawise-connectors/datawise-connector-trino',
]
