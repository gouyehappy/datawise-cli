# Orchestration hooks (Airflow / dbt / Flink)

DataWise exposes a thin two-way bridge for external orchestrators, plus optional
**DAG / job status write-back** for outbound `http_trigger` tasks.

## Outbound: scheduled task type `http_trigger`

### Form presets

In the platform catalog task form, pick a **Preset** to fill example URL / headers / body / `statusUrlTemplate`:

- **Airflow DAG run** — POST `/api/v1/dags/{dag_id}/dagRuns` + status template with `{dag_run_id}`
- **dbt Cloud job run** — POST job run API with Token auth
- **Generic webhook** — simple JSON POST

Replace hosts, IDs, and secrets before enabling the schedule.

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
  "successStatusMax": 299,
  "statusUrlTemplate": "https://airflow.example/api/v1/dags/my_dag/dagRuns/{dag_run_id}"
}
```

| Field | Notes |
|-------|--------|
| Methods | `GET` \| `POST` \| `PUT` \| `PATCH` |
| `statusUrl` | Absolute URL to GET for status (optional) |
| `statusUrlTemplate` | Template with `{dag_run_id}` / `{run_id}` / `{ref}` filled from the trigger response |
| `statusJsonPath` | Optional JSON Pointer / dotted path to the state field (default: `state` / `status`) |

- Non-2xx (or outside the configured status window) fails the task and emits `scheduled_task.failed` plus `orchestration.failed`
- Success emits `scheduled_task.ok` and `orchestration.triggered`
- Trigger responses that look like Airflow (`dag_run_id` + `state`) are stored on the task
- When a status URL is configured, DataWise auto-polls once after a successful trigger

### Status poll API / UI

```http
POST /api/platform/orchestration/status
Content-Type: application/json

{ "taskId": "<http_trigger-task-id>" }
```

Returns `{ state, ref, detail, statusUrl, httpStatus, checkedAt }` and updates the task’s
`orchestrationState` / `orchestrationRef` columns. In **Scheduled tasks**, select an
`http_trigger` row and click **Check orchestration status**.

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

1. DataWise cron/`http_trigger` → `POST` Airflow DAG run (capture `dag_run_id`)
2. Optionally poll status via `statusUrlTemplate` / UI / `POST …/orchestration/status`
3. Airflow DAG finishes → `POST /api/platform/orchestration/trigger` to run a DataWise SQL / DQ / canvas task
4. Subscribe outbound webhooks to `orchestration.*` / `data_quality.*` for Slack/Feishu observation
