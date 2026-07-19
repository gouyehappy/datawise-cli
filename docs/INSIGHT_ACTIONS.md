# Insight → ticket / runbook (G10)

Turn digests and failures into organization actions.

## Automatic: outbound channels

In **Settings → Integrations**, create a hook with channel:

| Channel | URL | Secret |
|---------|-----|--------|
| `github_issue` | `https://api.github.com/repos/{owner}/{repo}/issues` | GitHub PAT with `issues:write` |
| `gitlab_issue` | `https://gitlab.example/api/v4/projects/{id}/issues` | GitLab PAT / project token |
| `jira_issue` | `https://{domain}.atlassian.net/rest/api/3/issue?project=KEY` | Atlassian API token, or `email:token` for Basic auth |

Subscribe to events such as:

- `insight.digest` — scheduled SQL/canvas digest
- `insight.action` — manual export (below)
- `data_quality.failed` / `scheduled_task.failed` — ops tickets

DataWise POSTs an Issues API body using the token in `secret`:

- **GitHub / GitLab:** `title` + `body` / `description`
- **Jira Cloud:** REST v3 `{ fields: { project, summary, description (ADF), issuetype } }` — project key from URL `?project=` / `?projectKey=`, or event `data.projectKey` / `data.jiraProject`

## Manual: API

```http
POST /api/platform/insight-actions
Content-Type: application/json

{
  "title": "Investigate negative order amounts",
  "body": "Digest showed 12 rows with amount < 0.",
  "data": {
    "source": "analysis-canvas",
    "canvasId": "…",
    "labels": ["datawise", "insight"]
  }
}
```

Publishes `insight.action` to matching tenant outbound hooks (so a `github_issue`, `gitlab_issue`, or `jira_issue` subscription opens the ticket).

Response includes `ticketUrl` / `ticketUrls` when an issue channel returns a browseable link (`html_url` / `web_url` / Jira browse URL). GitHub also accepts optional `data.labels` (string array) on create.

## Manual: AI workbench

On analysis replies in **AI Workbench**, use **Create ticket** / **导出工单** in the analysis export bar. This calls the same API with:

- **title** — first line of the reply summary (truncated), or “AI insight”
- **body** — reply text plus fenced SQL when present
- **data** — `{ "source": "ai-workbench", "sessionId": "<chat session>", "mode": "analysis" }`

Success toast shows the ticket URL when an issue channel returns one; otherwise the outbound event id. Configure hooks under **Settings → Integrations** (see above).

## Still out of scope

- Auto-open pull requests / commit runbooks
- Two-way sync of issue status back into DataWise
