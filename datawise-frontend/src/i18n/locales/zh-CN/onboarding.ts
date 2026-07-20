export default {
    title: '新手指引',
    subtitle: '按指引了解核心功能区域',
    stepOf: '第 {current} / {total} 步',
    skip: '跳过',
    back: '上一步',
    next: '下一步',
    finish: '开始使用',
    steps: {
        welcome: {
            title: '欢迎使用',
            body: '本指引将高亮界面中的关键区域，帮助你完成连接数据、编写 SQL 与 AI 分析的基本流程。',
        },
        home: {
            title: '个人中心',
            body: '点击 Home 头像打开菜单：登录账号、个人资料、设置，以及随时重新打开本指引。',
            hint: '个人中心入口',
        },
        database: {
            title: 'Database 工作台',
            body: '日常开发的主入口。进入数据库模块后，左侧为连接树，右侧为 SQL 工作区。',
            hint: '左侧导航',
        },
        explorer: {
            title: '连接与资源树',
            body: '展开连接 → 实例 → 表/视图；双击表可查看数据，在 Workspaces 下管理 SQL 脚本。',
            hint: '连接树面板',
        },
        workspace: {
            title: 'SQL 工作区',
            body: '在此新建控制台、编写并执行 SQL，结果在下方网格展示；也可拖入 .sql 文件打开。',
            hint: '主编辑区',
        },
        ai: {
            title: 'AI 助手',
            body: '切换到 AI 模块：自然语言转 SQL、解释与优化语句，DataAgent 支持智能分析与图表。',
            hint: 'AI 入口',
        },
        terminal: {
            title: '内置终端',
            body: '底部 Terminal 可打开命令行面板，配合脚本与本地工具使用。',
            hint: '终端按钮',
        },
        tips: {
            title: '效率提示',
            body: '按 Ctrl+K 打开命令面板，可快速跳转模块或新建控制台；快捷键可在设置中自定义。',
        },
        insightWelcome: {
            title: '连接已就绪，开始首次洞察',
            body: '首个连接已配置完成。按以下 3 步完成「选表 → 提问 → 得出结论」的最短路径。',
        },
        insightExplorer: {
            title: '在 Explorer 中选择目标表',
            body: '建议选择一张业务主表（如订单、用户、支付）作为上下文，以便 AI 生成更准确的 SQL。',
            hint: '选择数据范围',
        },
        insightAi: {
            title: '切换至 AI，提出业务问题',
            body: '例如「最近 7 天订单趋势和异常点」。系统将输出 SQL、摘要与图表，结果可写入控制台。',
            hint: '提出业务问题',
        },
        insightDone: {
            title: '完成首次洞察闭环',
            body: '建议下一步：将结果保存为分析画布，并配置定时重新运行，使洞察持续更新。',
        },
    },
}
