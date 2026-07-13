export default {
    title: '新手指引',
    subtitle: '跟着光点走，认识核心功能区域',
    stepOf: '第 {current} / {total} 步',
    skip: '跳过',
    back: '上一步',
    next: '下一步',
    finish: '开始使用',
    steps: {
        welcome: {
            title: '欢迎使用',
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
        insightWelcome: {
            title: '连接已就绪，开始 30 秒出洞察',
            body: '很好，你已经完成首个连接。接下来 3 步走完“选表 → 提问 → 出结论”的最短路径。',
        },
        insightExplorer: {
            title: '先在 Explorer 选中你关心的表',
            body: '优先选择一个业务主表（如订单、用户、支付）作为上下文，AI 会基于它生成更准的 SQL。',
            hint: '先选数据范围',
        },
        insightAi: {
            title: '切到 AI，直接提业务问题',
            body: '例如“最近 7 天订单趋势和异常点”。系统会输出 SQL、摘要与图表，结果可一键回流控制台。',
            hint: '问一个业务问题',
        },
        insightDone: {
            title: '完成首个洞察闭环',
            body: '下一步建议：把结果保存为分析画布，并配置定时重跑，让洞察自动更新。',
        },
    },
}
