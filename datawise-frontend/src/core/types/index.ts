/**
 * 全局 TypeScript 类型定义
 *
 * 这里集中放「数据结构」描述，不包含逻辑。
 * 读代码时遇到 TreeNode、WorkspaceTab 等名词，先来这查字段含义。
 */
export type DbType =
    | 'mysql'
    | 'oracle'
    | 'postgresql'
    | 'sqlserver'
    | 'mariadb'
    | 'clickhouse'
    | 'dm'
    | 'oscar'
    | 'presto'
    | 'trino'
    | 'db2'
    | 'redis'
    | 'kafka'
    | 'mongodb'
    | 'sqlite'
    | 'hive'
    | 'oceanbase'
    | 'kingbase'
    | 'greenplum'
    | 'opengauss'
    | 'highgo'
    | 'gbase8a'
    | 'elasticsearch'
    | 'kylin'
    | 'starrocks'
    | 'doris'
    | 'tidb'
    | 'tdengine'
    | 'sybase'
    | 'phoenix'
    | 'cachedb'
    | 'h2'
    | 'hsql'
    | 'generic'
    | 'other'
    | 'dameng'
    | 'gaussdb'
    | 'flink'

/** 主导航模块，对应 Chat2DB Navigation Bar */
export type NavModule = 'profile' | 'database' | 'dashboard' | 'ai' | 'plugin' | 'pluginDev' | 'team' | 'settings'

/** 设置页左侧分区 */
export type SettingsSection =
    'basic'
    | 'layout'
    | 'connectionHealth'
    | 'systemMetrics'
    | 'profile'
    | 'editor'
    | 'sqlEditor'
    | 'shortcuts'
    | 'plugins'
    | 'ai'
    | 'dataAgent'
    | 'knowledge'
    | 'about'

/** 右侧快捷栏面板，对应 Chat2DB Shortcut Bar */
export type ShortcutPanel = 'info' | 'history' | 'monitor' | 'console' | 'export' | 'migration'

export type TreeNodeType =
    | 'group'
    | 'connection'
    | 'database'
    | 'schema'
    | 'folder'
    | 'table'
    | 'view'
    | 'function'
    | 'procedure'
    | 'trigger'
    | 'console'
    | 'columns'
    | 'keys'
    | 'indexes'
    | 'column'
    | 'primary_key'
    | 'foreign_key'
    | 'index'
    | 'sql_file'
    | 'view_model'
    | 'redis-key'
    | 'redis-empty'
    | 'redis-browser'
    | 'redis-feature'
    | 'kafka-feature'
    | 'kafka-topic'
    | 'load_more'

export interface TreeNode {
    id: string
    label: string
    type: TreeNodeType
    dbType?: DbType
    /** B-01: dev | staging | prod | custom */
    env?: string
    envCustom?: string
    children?: TreeNode[]
    /** 列类型或对象注释（树节点右侧灰色文字） */
    meta?: string
    /** 中文业务说明，显示在名称后 */
    comment?: string
    expanded?: boolean
}

/** 控制台上下文：数据源及其下属实例（库/Schema） */
export interface DataSourceOption {
    id: string
    label: string
    dbType: DbType
    instances: { id: string; label: string }[]
}

export interface ConnectionConfig {
    id: string
    name: string
    dbType: DbType
    env: string
    envCustom?: string
    storage: string
    host: string
    port: string
    auth: string
    user?: string
    password?: string
    url: string
    serviceType?: string
    sid?: string
    driver?: string
    driverClass?: string
    database?: string
    sshEnabled?: boolean
    sshHost?: string
    sshPort?: string
    sshUser?: string
    sshPassword?: string
    sshPrivateKey?: string
    sshPassphrase?: string
    advancedConfig?: string
}

export type WorkspaceTabType =
    | 'welcome'
    | 'console'
    | 'table'
    | 'connection'
    | 'terminal'
    | 'schema-compare'
    | 'schema-er'
    | 'schema-tables'
    | 'cross-env-compare'
    | 'table-migration'
    | 'view_model'
    | 'view_model_editor'
    | 'redis-key'
    | 'redis-console'
    | 'kafka-topics'
    | 'kafka-topic'
    | 'kafka-consumer-groups'

export interface WorkspaceTab {
    id: string
    title: string
    type: WorkspaceTabType
    closable: boolean
    connectionId?: string
    instanceId?: string | null
    /** 库 / Schema 名称，用于 SQL 与表数据查询 */
    database?: string
    tableName?: string
    dbType?: DbType
    sql?: string
    /** 新建连接时归属的分组 ID */
    targetGroupId?: string
    /** 实例 workspaces 目录下的 SQL 文件名，用于同一文件复用控制台 Tab */
    sqlFile?: string
    /** 上次保存到 workspaces 的 SQL 内容，用于 dirty 判断 */
    savedSql?: string
    /** 打开 Tab 时在连接树中对应的节点 ID，用于定位 */
    explorerNodeId?: string
    /** 表或数据库视图 */
    relationKind?: 'table' | 'view'
    /** 表详情 Tab 当前子视图 */
    tableView?: 'properties' | 'data' | 'ddl' | 'relations' | 'relationGraph'
    /** 表属性页左侧分区 */
    tableSection?: 'columns' | 'indexes' | 'foreignKeys'
    /** Schema 对比：左侧（参考）范围 */
    schemaCompareLeft?: import('@/features/schema-compare/types/schema-compare.types').SchemaScope
    /** Schema 对比：右侧（目标）范围 */
    schemaCompareRight?: import('@/features/schema-compare/types/schema-compare.types').SchemaScope
    /** 跨环境抽样对比：参考侧 */
    crossEnvCompareLeft?: import('@/features/schema-compare/types/schema-compare.types').SchemaScope
    /** 跨环境抽样对比：目标侧 */
    crossEnvCompareRight?: import('@/features/schema-compare/types/schema-compare.types').SchemaScope
    /** 跨环境抽样对比：SQL */
    crossEnvCompareSql?: string
    /** 表数据迁移：源库范围 */
    migrationSource?: import('@/features/schema-compare/types/schema-compare.types').SchemaScope
    /** 表数据迁移：预选的表名 */
    migrationPreselectedTables?: string[]
    /** 视图模型：显示名称 */
    viewModelName?: string
    /** 视图模型：SELECT SQL（打开 Tab 时缓存） */
    viewModelSql?: string
    /** 视图模型编辑器：上次已落盘 SQL */
    viewModelSavedSql?: string
    /** 视图模型编辑器：当前是否为草稿版本 */
    viewModelIsDraft?: boolean
    /** 视图模型迁移：源 SELECT */
    migrationSourceSelectSql?: string
    /** 视图模型迁移：目标表名 */
    migrationTargetTableName?: string
    /** Redis key 详情 Tab */
    redisKey?: string
    /** Kafka 工作台当前选中的 Topic */
    kafkaTopic?: string
    /** Redis 工作台初始视图 */
    redisView?: 'keys' | 'command'
}

export interface TableColumn {
    name: string
    /** 行数据唯一字段名（JOIN 重复列名时由后端生成，如 c1、c2） */
    key?: string
    type?: string
}

export interface TableRow {
    [key: string]: string | number | boolean | null | Record<string, unknown> | unknown[]
}

export type ContextMenuIcon =
    | 'run'
    | 'explain'
    | 'optimize'
    | 'format'
    | 'open'
    | 'console'
    | 'pin'
    | 'copy'
    | 'ddl'
    | 'table'
    | 'truncate'
    | 'edit'
    | 'export'
    | 'import'
    | 'delete'
    | 'close'
    | 'file'
    | 'connection'

export interface ContextMenuItem {
    id: string
    label: string
    disabled?: boolean
    /** disabled 时原生 title 提示（能力不支持等） */
    disabledHint?: string
    children?: ContextMenuItem[]
    /** 悬停时展示的自定义子面板 id（通过 registerContextMenuSubmenuPanel 注册） */
    submenuPanel?: string
    divider?: boolean
    icon?: ContextMenuIcon
    shortcut?: string
    accent?: boolean
    danger?: boolean
}

export interface StatusSnapshot {
    message: string
    duration: string
    durationMs?: number
    rowCount: string
}

export interface ExportTask {
    id: string
    name: string
    time: string
    status: 'running' | 'done' | 'failed'
}

export interface SqlLogEntry {
    id: string
    sql: string
    time: string
    duration: string
    durationMs?: number
    status: 'success' | 'error'
    rows?: number
    teamShared?: boolean
    connectionId?: string
    database?: string
}

export interface SavedConsole {
    id: string
    name: string
    connectionName: string
    updatedAt: string
    sql?: string
    teamShared?: boolean
    folder?: string
    tags?: string[]
}

export type NotificationCategory = 'system' | 'export' | 'workspace' | 'info'

export interface AppNotification {
    id: string
    category: NotificationCategory
    titleKey: string
    bodyKey: string
    params?: Record<string, string | number>
    createdAt: number
    read: boolean
}

export interface TableMetaInfo {
    tableName: string
    engine?: string
    rows?: number
    size?: string
    comment?: string
    columns: TableColumn[]
}

export type ExplorerInfoKind =
    | 'empty'
    | 'connection'
    | 'database'
    | 'table'
    | 'column'
    | 'primary_key'
    | 'foreign_key'
    | 'index'
    | 'columns'
    | 'keys'
    | 'indexes'

export interface ExplorerInfoField {
    /** i18n key under shortcut.infoFields */
    key: string
    value: string
    wide?: boolean
}

export interface ExplorerInfoListItem {
    name: string
    meta?: string
    comment?: string
}

/** 连接树选中节点在 Info 面板中的展示模型 */
export interface ExplorerNodeInfo {
    kind: ExplorerInfoKind
    title: string
    sourceNodeId?: string
    breadcrumb?: string
    comment?: string
    fields: ExplorerInfoField[]
    listTitleKey?: string
    listItems: ExplorerInfoListItem[]
}

export interface TeamSummary {
    id: string
    name: string
    memberCount: number
    role: 'owner' | 'admin' | 'member' | 'viewer'
    sharedConnectionIds?: string[]
    sharedConnectionAccess?: Record<string, 'readonly' | 'readwrite' | 'ddl' | 'read' | 'write'>
    onCallConnectionIds?: string[]
    sharedConsoleIds?: string[]
    shareSqlHistory?: boolean
    requireInviteApproval?: boolean
    inviteCode?: string | null
    pendingInviteCount?: number
}

export interface TeamJoinRequest {
    teamId: string
    teamName: string
    status: string
    requestedAt: string
}

export interface TeamMember {
    userId: number
    userName: string
    role: 'owner' | 'admin' | 'member' | 'viewer'
    joinedAt: string
}

export interface TeamInvite {
    id: string
    userId: number
    userName: string
    status: string
    requestedAt: string
}

export interface TeamAuditLog {
    id: string
    actorUserId: number
    actorUserName: string
    action: string
    detail: string
    createdAt: string
}

export interface TeamAuditLogQuery {
    actorUserId?: number
    since?: string
    until?: string
    limit?: number
}

export interface JoinTeamResult {
    status: 'joined' | 'pending' | 'already_member'
    team: TeamSummary | null
    message: string
}

export interface TeamSharedAiSessionSummary {
    id: string
    teamId: string
    title: string
    sharedByUserName: string
    sharedAt: string
    messageCount: number
}

export interface TeamSharedAiSessionDetail {
    id: string
    teamId: string
    title: string
    sharedByUserName: string
    sharedAt: string
    payloadJson: string
}

export interface TeamSharedQuerySummary {
    id: string
    teamId: string
    title: string
    description: string
    connectionId: string
    connectionName: string
    database: string
    tags: string[]
    sharedByUserName: string
    sharedByUserId: number
    sharedAt: string
    updatedAt: string
    commentCount: number
    favoriteCount: number
    starredByCurrentUser: boolean
}

export interface TeamSharedQueryComment {
    id: string
    userId: number
    userName: string
    content: string
    createdAt: string
}

export interface TeamSharedQueryDetail extends TeamSharedQuerySummary {
    sql: string
    sharedByUserId: number
    comments: TeamSharedQueryComment[]
}

export interface ShareTeamSharedQueryPayload {
    title: string
    description?: string
    connectionId?: string
    connectionName?: string
    database?: string
    sql: string
    tags?: string[]
}

export type TeamProductionApprovalStatus = 'pending' | 'executed' | 'failed' | 'rejected'

export interface TeamProductionApprovalSummary {
    id: string
    teamId: string
    connectionId: string
    connectionName: string
    database: string
    status: TeamProductionApprovalStatus
    requestedByUserName: string
    requestedByUserId: number
    reviewedByUserName: string
    requestedAt: string
    reviewedAt: string
}

export interface TeamProductionApprovalDetail extends TeamProductionApprovalSummary {
    sql: string
    reviewedByUserId?: number
    reviewComment?: string
    executionError?: string
}

export interface SubmitTeamProductionApprovalPayload {
    connectionId: string
    connectionName?: string
    database?: string
    sql: string
}

export interface PluginItem {
    id: string
    name: string
    version: string
    author: string
    description: string
    enabled: boolean
    category: 'datasource' | 'export' | 'ai' | 'tool'
}
