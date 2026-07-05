export default {
    title: '新手指引',
    subtitle: '跟着光点走，认识 DataWise 的核心区域',
    stepOf: '第 {current} / {total} 步',
    skip: '跳过',
    back: '上一步',
    next: '下一步',
    finish: '开始使用',
    steps: {
        welcome: {
            title: '欢迎使用 DataWise',
            body: '接下来会用聚光灯带你认识界面上的关键区域——连接数据、写 SQL、用 AI 分析，几步就能上手。',
        },
        home: {
            title: '个人中心',
            body: '点击 Home 头像打开菜单：登录账号、个人资料、设置，以及随时重新打开本指引。',
            hint: '看这里',
        },
        database: {
            title: 'Database 工作台',
            body: '这是日常开发的主入口。点这里进入数据库模块，左侧是连接树，右侧是 SQL 工作区。',
            hint: '左侧导航',
        },
        explorer: {
            title: '连接与资源树',
            body: '展开连接 → 实例 → 表/视图；双击表看数据，Workspaces 下管理 SQL 脚本。',
            hint: '连接树面板',
        },
        workspace: {
            title: 'SQL 工作区',
            body: '在这里新建控制台、编写并执行 SQL，结果在下方网格展示；也可拖入 .sql 文件打开。',
            hint: '主编辑区',
        },
        ai: {
            title: 'AI 助手',
            body: '切换到 AI 模块：自然语言转 SQL、解释优化语句，DataAgent 还能做智能分析与图表。',
            hint: 'AI 入口',
        },
        terminal: {
            title: '内置终端',
            body: '底部 Terminal 可打开命令行面板，配合脚本与本地工具使用。',
            hint: '终端按钮',
        },
        tips: {
            title: '快捷上手',
            body: '按 Ctrl+K 打开命令面板，快速跳转模块、新建控制台；设置里可自定义快捷键。',
        },
    },
}
