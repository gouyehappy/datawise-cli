# 治理入口矩阵（生产写操作）

团队共享的 **生产** 连接上，写 SQL（DML/DDL）在各入口必须一致：不能仅靠前端拦截。

## 策略（与 UI 对齐）

同时满足以下条件时，需要团队生产审批：

1. 连接环境为 `prod` / `production`，或 `custom` 标签含 `prod`
2. SQL 被判定为写操作（`SqlWriteClassifier.requiresWriteAccess`）
3. 当前用户以 **非管理员** 角色（member / viewer）共享了该连接的团队

**放行例外：**

- 团队 `owner` / `admin` 可直接执行（仍受连接读写 / DDL 权限约束）
- 审批通过后的执行：`sessionKey` 以 `prod-approval-` 开头（`ProductionApprovalService.approveAndExecute`）

服务端实现：`ProductionWriteGuardService`。阻断时返回稳定错误码 `SQL_PRODUCTION_APPROVAL_REQUIRED`（HTTP 403）。

## 入口矩阵

| 入口 | 读 SQL | 写 SQL（共享生产连接） | 备注 |
|------|--------|------------------------|------|
| SQL 控制台（UI） | 允许 | 前端引导提交审批；服务端护栏强制拦截 | 危险 SQL 确认后若需审批则打开审批对话框 |
| Schema 对比 / 表迁移 / 还原向导 | — | 同上（提交审批，不直写） | 迁移计划可带 `DATAWISE_APPROVAL_KIND:DATA_MIGRATION` 标记 |
| `POST /api/sql/execute`（含 headless-cli） | 允许（需 token `sql` scope） | **服务端拦截** → `SQL_PRODUCTION_APPROVAL_REQUIRED` | CLI 不能绕过；应走团队审批 API |
| MCP `execute_readonly_sql` | 仅 SELECT（桥接层再校验） | 不适用 | 写操作不经此工具 |
| MCP `review_sql` | 审查 | 返回 `requiresApproval` / `PROD_APPROVAL` | 与护栏同源 |
| 定时任务创建/更新 | 可配置 | `SqlReviewService.requiresApproval` 为 true 时拒绝保存 | 文案：`SQL requires production approval` |
| 团队「批准并执行」 | — | 使用 `prod-approval-{id}` sessionKey 放行 | 仅审批人路径 |

## 推荐操作路径

1. 成员在控制台写好 SQL → 危险确认 → **提交生产审批**
2. 管理员在团队审批列表 **批准并执行**
3. CI / headless 需要改生产数据时：先走审批，或由管理员 token + 管理角色执行；勿依赖「关掉前端」绕过

## 相关代码

- `ProductionWriteGuardService` / `ProductionWriteBlockedException`
- `SqlExecuteService` / `SqlReviewService` / `ProductionApprovalService`
- 前端：`production-approval-policy.service.ts`
- 错误码：`DatawiseErrorCodes.SQL_PRODUCTION_APPROVAL_REQUIRED`
