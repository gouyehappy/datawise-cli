package org.apache.datawise.backend.platform.sql;

import org.apache.datawise.backend.ai.sql.SqlReviewAiRewriteService;
import org.apache.datawise.backend.database.sql.SqlReviewService;
import org.apache.datawise.backend.domain.SqlReviewRequest;
import org.apache.datawise.backend.domain.SqlReviewResultDto;
import org.springframework.stereotype.Service;

@Service
public class SqlReviewOrchestrator {

    private final SqlReviewService sqlReviewService;
    private final SqlReviewAiRewriteService rewriteService;

    public SqlReviewOrchestrator(SqlReviewService sqlReviewService, SqlReviewAiRewriteService rewriteService) {
        this.sqlReviewService = sqlReviewService;
        this.rewriteService = rewriteService;
    }

    public SqlReviewResultDto review(SqlReviewRequest request) {
        SqlReviewResultDto base = sqlReviewService.review(request);
        if (!Boolean.TRUE.equals(request.aiRewrite())) {
            return base;
        }
        return rewriteService.enrich(request, base);
    }
}
