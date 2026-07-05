export type ReportTemplateCategory = 'daily' | 'funnel' | 'retention' | 'ops'

export interface ReportSqlTemplate {
    id: string
    category: ReportTemplateCategory
    name: string
    description: string
    sql: string
    tags: string[]
}

/** 内置报表 SQL 模板（FB-086）；表名/列名需按实际库调整 */
export const REPORT_SQL_TEMPLATES: ReportSqlTemplate[] = [
    {
        id: 'daily-order-summary',
        category: 'daily',
        name: '日订单汇总',
        description: '按日统计订单量与 GMV',
        tags: ['日报', '订单'],
        sql: `-- 日报：订单汇总
SELECT
  DATE(created_at) AS stat_date,
  COUNT(*) AS order_count,
  SUM(amount) AS gmv
FROM orders
WHERE created_at >= \${start_date}
  AND created_at < \${end_date}
GROUP BY DATE(created_at)
ORDER BY stat_date;`,
    },
    {
        id: 'daily-new-users',
        category: 'daily',
        name: '日新增用户',
        description: '按日统计注册用户',
        tags: ['日报', '用户'],
        sql: `-- 日报：新增用户
SELECT
  DATE(created_at) AS stat_date,
  COUNT(*) AS new_users
FROM users
WHERE created_at >= \${start_date}
  AND created_at < \${end_date}
GROUP BY DATE(created_at)
ORDER BY stat_date;`,
    },
    {
        id: 'funnel-conversion',
        category: 'funnel',
        name: '注册→下单→支付漏斗',
        description: '三阶段转化人数与转化率',
        tags: ['漏斗', '转化'],
        sql: `-- 漏斗：注册 → 下单 → 支付
WITH registered AS (
  SELECT COUNT(DISTINCT user_id) AS cnt
  FROM users
  WHERE created_at >= \${start_date} AND created_at < \${end_date}
),
ordered AS (
  SELECT COUNT(DISTINCT user_id) AS cnt
  FROM orders
  WHERE created_at >= \${start_date} AND created_at < \${end_date}
),
paid AS (
  SELECT COUNT(DISTINCT user_id) AS cnt
  FROM orders
  WHERE status = 'paid'
    AND created_at >= \${start_date} AND created_at < \${end_date}
)
SELECT
  r.cnt AS registered,
  o.cnt AS ordered,
  p.cnt AS paid,
  ROUND(o.cnt * 100.0 / NULLIF(r.cnt, 0), 2) AS order_rate_pct,
  ROUND(p.cnt * 100.0 / NULLIF(o.cnt, 0), 2) AS pay_rate_pct
FROM registered r, ordered o, paid p;`,
    },
    {
        id: 'funnel-step-events',
        category: 'funnel',
        name: '事件漏斗步骤',
        description: '按事件名统计 UV',
        tags: ['漏斗', '事件'],
        sql: `-- 漏斗：各步骤 UV
SELECT
  event_name,
  COUNT(DISTINCT user_id) AS uv
FROM events
WHERE event_time >= \${start_date}
  AND event_time < \${end_date}
  AND event_name IN ('view', 'add_cart', 'checkout', 'pay')
GROUP BY event_name
ORDER BY uv DESC;`,
    },
    {
        id: 'retention-cohort-7d',
        category: 'retention',
        name: '7 日留存（ cohort ）',
        description: '注册 cohort 在 D+1~D+7 的回访率',
        tags: ['留存', 'cohort'],
        sql: `-- 留存：注册 cohort × 7 日回访
WITH cohort AS (
  SELECT id AS user_id, DATE(created_at) AS cohort_date
  FROM users
  WHERE created_at >= \${start_date} AND created_at < \${end_date}
),
activity AS (
  SELECT DISTINCT user_id, DATE(event_time) AS active_date
  FROM events
  WHERE event_time >= \${start_date}
)
SELECT
  c.cohort_date,
  COUNT(DISTINCT c.user_id) AS cohort_size,
  COUNT(DISTINCT CASE WHEN DATEDIFF(a.active_date, c.cohort_date) = 1 THEN c.user_id END) AS d1,
  COUNT(DISTINCT CASE WHEN DATEDIFF(a.active_date, c.cohort_date) = 7 THEN c.user_id END) AS d7
FROM cohort c
LEFT JOIN activity a ON a.user_id = c.user_id
GROUP BY c.cohort_date
ORDER BY c.cohort_date;`,
    },
    {
        id: 'retention-weekly-active',
        category: 'retention',
        name: '周活跃用户',
        description: '按周统计 WAU',
        tags: ['留存', '活跃'],
        sql: `-- 留存：周活跃用户
SELECT
  DATE_TRUNC('week', event_time) AS week_start,
  COUNT(DISTINCT user_id) AS wau
FROM events
WHERE event_time >= \${start_date}
  AND event_time < \${end_date}
GROUP BY DATE_TRUNC('week', event_time)
ORDER BY week_start;`,
    },
    {
        id: 'ops-kpi-dashboard',
        category: 'ops',
        name: '运营大盘 KPI',
        description: '订单、用户、客单价一览',
        tags: ['运营', 'KPI'],
        sql: `-- 运营大盘
SELECT
  COUNT(DISTINCT o.id) AS order_count,
  COUNT(DISTINCT o.user_id) AS buyer_count,
  SUM(o.amount) AS gmv,
  ROUND(SUM(o.amount) / NULLIF(COUNT(DISTINCT o.id), 0), 2) AS avg_order_value,
  COUNT(DISTINCT u.id) AS new_users
FROM orders o
LEFT JOIN users u
  ON u.created_at >= \${start_date} AND u.created_at < \${end_date}
WHERE o.created_at >= \${start_date}
  AND o.created_at < \${end_date};`,
    },
    {
        id: 'ops-top-products',
        category: 'ops',
        name: 'Top 商品销量',
        description: '按销量/GMV 排行',
        tags: ['运营', '排行'],
        sql: `-- 运营：Top 商品
SELECT
  product_id,
  SUM(quantity) AS units,
  SUM(amount) AS gmv
FROM order_items oi
JOIN orders o ON o.id = oi.order_id
WHERE o.created_at >= \${start_date}
  AND o.created_at < \${end_date}
GROUP BY product_id
ORDER BY gmv DESC
LIMIT 20;`,
    },
]

export const REPORT_TEMPLATE_CATEGORIES: ReportTemplateCategory[] = [
    'daily',
    'funnel',
    'retention',
    'ops',
]
