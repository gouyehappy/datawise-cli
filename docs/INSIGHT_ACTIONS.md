# Insight → ticket / runbook (G10)

Turn digests and failures into organization actions.

## Automatic: outbound channels

In **Settings → Integrations**, create a hook with channel:

| Channel | URL | Secret |
|---------|-----|--------|
| `github_issue` | `https://api.github.com/repos/{owner}/{repo}/issues` | GitHub PAT with `issues:write` |
| `gitlab_issue` | `https://gitlab.example/api/v4/projects/{id}/issues` | GitLab PAT / project token |

Subscribe to events such as:

- `insight.digest` — scheduled SQL/canvas digest
- `insight.action` — manual export (below)
- `data_quality.failed` / `scheduled_task.failed` — ops tickets

DataWise POSTs a GitHub/GitLab Issues API body (`title` + `body`/`description`) using the token in `secret`.

## Manual: API

```http
POST /api/platform/insight-actions
Content-Type: application/json

{
  "title": "Investigate negative order amounts",
  "body": "Digest showed 12 rows with amount < 0.",
  "data": { "source": "analysis-canvas", "canvasId": "…" }
}
```

Publishes `insight.action` to matching tenant outbound hooks (so a `github_issue` subscription opens the ticket).

## Still out of scope

- Auto-open pull requests / commit runbooks
- Two-way sync of issue status back into DataWise
- Jira-native adapter (use generic `webhook` or GitHub/GitLab for now)
