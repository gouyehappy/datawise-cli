import type {Component} from 'vue'
import {
    Activity,
    AlignCenter,
    AlignLeft,
    ArrowLeftRight,
    ArrowUpDown,
    BarChart3,
    Bell,
    BookOpen,
    Bookmark,
    Bot,
    Cable,
    Check,
    ChevronDown,
    ChevronLeft,
    ChevronRight,
    ChevronsLeft,
    ChevronsRight,
    CircleAlert,
    Code,
    Columns2,
    Columns3,
    Command,
    Copy,
    Cpu,
    Crosshair,
    Database,
    Download,
    ExternalLink,
    Eye,
    EyeOff,
    File,
    FileCode,
    FileDiff,
    FileOutput,
    FileText,
    Files,
    Filter,
    Folder,
    FolderOpen,
    GitCompare,
    Grid3x3,
    History,
    Home,
    Import,
    Info,
    Key,
    Keyboard,
    LayoutGrid,
    LayoutTemplate,
    LineChart,
    Link,
    List,
    ListOrdered,
    ListTree,
    ListVideo,
    Lock,
    LogOut,
    Maximize2,
    MessageSquare,
    Mic,
    Minimize2,
    Minus,
    Network,
    Pencil,
    Pin,
    Play,
    Plus,
    RefreshCw,
    Save,
    Search,
    Send,
    Settings,
    Share2,
    ShieldCheck,
    SlidersHorizontal,
    Sparkles,
    Square,
    Star,
    Table,
    Terminal,
    Trash2,
    TrendingUp,
    TriangleAlert,
    Undo2,
    Unlock,
    Unplug,
    Upload,
    User,
    Users,
    Webhook,
    Wrench,
    X,
    Zap,
    Ellipsis,
} from 'lucide-vue-next'

/** 全系统统一图标名（Lucide Icons） */
export type DwIconName =
    | 'plus'
    | 'minus'
    | 'x'
    | 'chevron-down'
    | 'chevron-left'
    | 'chevron-right'
    | 'chevrons-left'
    | 'chevrons-right'
    | 'filter'
    | 'arrow-up-down'
    | 'visibility-off'
    | 'alert-circle'
    | 'alert-triangle'
    | 'send'
    | 'history'
    | 'monitor'
    | 'migration'
    | 'feedback'
    | 'lock'
    | 'unlock'
    | 'user'
    | 'users'
    | 'log-out'
    | 'link'
    | 'key'
    | 'mic'
    | 'bot'
    | 'zap'
    | 'list-ordered'
    | 'star'
    | 'cpu'
    | 'open-external'
    | 'add'
    | 'refresh'
    | 'locate'
    | 'settings'
    | 'search'
    | 'menu-group'
    | 'menu-connection'
    | 'menu-import'
    | 'run'
    | 'stop'
    | 'explain-plan'
    | 'submit'
    | 'rollback'
    | 'disconnect'
    | 'save'
    | 'save-as'
    | 'bookmark'
    | 'view-model'
    | 'format'
    | 'fullscreen'
    | 'ai'
    | 'explain'
    | 'optimize'
    | 'open'
    | 'folder'
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
    | 'database'
    | 'plugins'
    | 'dev-tools'
    | 'dashboard'
    | 'tools'
    | 'tree'
    | 'terminal'
    | 'align'
    | 'matrix'
    | 'usage'
    | 'connectors'
    | 'audit'
    | 'hooks'
    | 'notify'
    | 'command'
    | 'layout'
    | 'editor'
    | 'shortcuts'
    | 'about'
    | 'diff'
    | 'visibility'
    | 'comment-column'
    | 'comment-table'
    | 'comment-all'
    | 'settings-basic'
    | 'settings-layout'
    | 'settings-connection-health'
    | 'settings-system-metrics'
    | 'settings-profile'
    | 'settings-editor'
    | 'settings-sql-editor'
    | 'settings-shortcuts'
    | 'settings-plugins'
    | 'settings-ai'
    | 'settings-data-agent'
    | 'settings-knowledge'
    | 'settings-about'
    | 'tab-welcome'
    | 'tab-console'
    | 'tab-table'
    | 'tab-connection'
    | 'tab-terminal'
    | 'tab-schema-compare'
    | 'tab-schema-er'
    | 'tab-cross-env-compare'
    | 'tab-view-model'
    | 'tab-view-model-editor'
    | 'tab-redis-key'
    | 'tab-redis-console'
    | 'tab-kafka'
    | 'tab-file'
    | 'ellipsis'

export const DW_ICON_REGISTRY: Record<DwIconName, Component> = {
    plus: Plus,
    minus: Minus,
    x: X,
    'chevron-down': ChevronDown,
    'chevron-left': ChevronLeft,
    'chevron-right': ChevronRight,
    'chevrons-left': ChevronsLeft,
    'chevrons-right': ChevronsRight,
    filter: Filter,
    'arrow-up-down': ArrowUpDown,
    'visibility-off': EyeOff,
    'alert-circle': CircleAlert,
    'alert-triangle': TriangleAlert,
    send: Send,
    history: History,
    monitor: Activity,
    migration: Files,
    feedback: MessageSquare,
    lock: Lock,
    unlock: Unlock,
    user: User,
    users: Users,
    'log-out': LogOut,
    link: Link,
    key: Key,
    mic: Mic,
    bot: Bot,
    zap: Zap,
    'list-ordered': ListOrdered,
    star: Star,
    cpu: Cpu,
    'open-external': ExternalLink,
    add: Plus,
    refresh: RefreshCw,
    locate: Crosshair,
    settings: Settings,
    search: Search,
    'menu-group': LayoutGrid,
    'menu-connection': Database,
    'menu-import': Import,
    run: Play,
    stop: Square,
    'explain-plan': ListVideo,
    submit: Check,
    rollback: Undo2,
    disconnect: Unplug,
    save: Save,
    'save-as': FileOutput,
    bookmark: Bookmark,
    'view-model': LayoutTemplate,
    format: AlignLeft,
    fullscreen: Maximize2,
    ai: Sparkles,
    explain: Info,
    optimize: Sparkles,
    open: FolderOpen,
    folder: Folder,
    console: Terminal,
    pin: Pin,
    copy: Copy,
    ddl: FileCode,
    table: Table,
    truncate: ArrowLeftRight,
    edit: Pencil,
    export: Upload,
    import: Download,
    delete: Trash2,
    close: X,
    file: File,
    connection: Database,
    database: Database,
    plugins: LayoutGrid,
    'dev-tools': Wrench,
    dashboard: BarChart3,
    tools: Wrench,
    tree: ListTree,
    terminal: Terminal,
    align: AlignCenter,
    matrix: Grid3x3,
    usage: TrendingUp,
    connectors: Cable,
    audit: ShieldCheck,
    hooks: Webhook,
    notify: Bell,
    command: Command,
    layout: Columns2,
    editor: FileText,
    shortcuts: Keyboard,
    about: Info,
    diff: FileDiff,
    visibility: Eye,
    'comment-column': Columns3,
    'comment-table': Table,
    'comment-all': List,
    'settings-basic': SlidersHorizontal,
    'settings-layout': Columns2,
    'settings-connection-health': Activity,
    'settings-system-metrics': LineChart,
    'settings-profile': User,
    'settings-editor': FileText,
    'settings-sql-editor': Code,
    'settings-shortcuts': Keyboard,
    'settings-plugins': LayoutGrid,
    'settings-ai': Sparkles,
    'settings-data-agent': Network,
    'settings-knowledge': BookOpen,
    'settings-about': Info,
    'tab-welcome': Home,
    'tab-console': Terminal,
    'tab-table': Table,
    'tab-connection': Database,
    'tab-terminal': Terminal,
    'tab-schema-compare': GitCompare,
    'tab-schema-er': Network,
    'tab-cross-env-compare': Columns2,
    'tab-view-model': FileText,
    'tab-view-model-editor': FileText,
    'tab-redis-key': Key,
    'tab-redis-console': Terminal,
    'tab-kafka': MessageSquare,
    'tab-file': File,
    ellipsis: Ellipsis,
}

export function resolveDwIcon(
    name: DwIconName,
    options?: {active?: boolean},
): Component {
    if (name === 'fullscreen') {
        return options?.active ? Minimize2 : Maximize2
    }
    return DW_ICON_REGISTRY[name]
}
