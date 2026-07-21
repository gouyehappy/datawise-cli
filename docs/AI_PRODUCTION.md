# AI 生产默认路径

分析图（planner → evidence → SQL → Python → chart → report）在代码侧已就绪；默认配置需按部署场景切换。

## 推荐生产配置

```yaml
datawise:
  ai:
    rag:
      enabled: true
      vector-store: pgvector
      pgvector:
        jdbc-url: jdbc:postgresql://db:5432/datawise_rag
        username: datawise
        password: ${DW_RAG_PASSWORD}
        table: ai_evidence_embeddings
      embedding:
        provider: openai
        base-url: https://api.openai.com/v1
        api-key: ${DW_EMBEDDING_API_KEY}
        model: text-embedding-3-small
    analysis:
      semantic-check: strict
      checkpoint:
        storage: file
    python:
      enabled: true
      executor: docker
      docker-binary: docker
      docker-image: python:3.12-slim
      docker-memory: 512m
      timeout-seconds: 30
```

## 开发 / 桌面默认

| 项 | 值 | 说明 |
|----|----|------|
| `vector-store` | `none` | 无需外部向量库 |
| `embedding.provider` | `hash` | 确定性离线向量 |
| `semantic-check` | `lenient`（dev/desktop profile） | 降低样例 schema 误杀 |
| `python.executor` | `simulated` | 无 Docker 时可用；结果为模拟 |

应用基础 `application.yml` 已将 `semantic-check` 默认设为 `strict`；`dev` / `desktop` profile 覆盖为 `lenient`。

## 配置错误提示

- `vector-store=pgvector` 但未配 JDBC：知识索引重建会返回 disabled 决策
- `executor=docker` 但主机无 Docker：执行节点失败，日志含可行动提示；可临时回退 `simulated` 仅用于联调

## 评测回归

离线黄金集：

```bash
cd datawise-backend
mvn -pl datawise-ai test -Dtest=TextToSqlEvalHarnessTest
```

用例：`datawise-ai/src/test/resources/ai-eval/golden-text-to-sql.json`。扩展时补充 `expectedSql` 或 `mustContain` / `mustNotContain`。
