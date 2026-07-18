# Orchestration hooks (Airflow / dbt / Flink)

DataWise exposes a thin two-way bridge for external orchestrators.

## Outbound: scheduled task type `http_trigger`

Create a scheduled task with type `http_trigger`. Payload:

```json
{
  "url": "https://airflow.example/api/v1/dags/my_dag/dagRuns",
  "method": "POST",
  "headers": {
    "Authorization": "Bearer …"
  },
  "bodyJson": { "conf": {} },
  "timeoutMs": 10000,
  "successStatusMin": 200,
  "successStatusMax": 299
}
```

- Methods: `GET` | `POST` | `PUT` | `PATCH`
- Non-2xx (or outside the configured status window) fails the task and emits `scheduled_task.failed` plus `orchestration.failed`
- Success emits `scheduled_task.ok` and `orchestration.triggered`

## Inbound: trigger a DataWise task

```http
POST /api/platform/orchestration/trigger
Content-Type: application/json
Authorization: Bearer <api-token>
# or session cookie

{ "taskId": "<scheduled-task-id>" }
```

Same effect as `POST /api/platform/scheduled-tasks/{id}/run`. Use an API token or session belonging to the task owner.

## Typical Airflow pattern

1. DataWise cron/`http_trigger` → `POST` Airflow DAG run
2. Airflow DAG finishes → `POST /api/platform/orchestration/trigger` to run a DataWise SQL / DQ / canvas task
3. Subscribe outbound webhooks to `orchestration.*` / `data_quality.*` for Slack/Feishu observation
