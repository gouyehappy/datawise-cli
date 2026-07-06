package org.apache.datawise.backend.database.sql;

import org.apache.datawise.backend.connector.api.support.SqlWriteClassifier;
import org.apache.datawise.backend.domain.SqlReviewFindingDto;
import org.apache.datawise.backend.domain.SqlReviewRequest;
import org.apache.datawise.backend.domain.SqlReviewResultDto;
import org.apache.datawise.backend.model.ConnectionEntity;
import org.apache.datawise.backend.service.ConnectionVisibilityService;
import org.springframework.stereotype.Service;

import java.util.ArrayList;
import java.util.List;
import java.util.Locale;
import java.util.regex.Pattern;

/**
 * 执行前 SQL 智能审查：危险操作、全表扫描风险、生产写操作审批提示。
 */
@Service
public class SqlReviewService {

    private static final Pattern SELECT_STAR = Pattern.compile(
            "\\bSELECT\\s+\\*\\s+FROM\\b",
            Pattern.CASE_INSENSITIVE
    );
    private static final Pattern MISSING_WHERE = Pattern.compile(
            "\\b(DELETE|UPDATE)\\b[\\s\\S]*?(;|$)",
            Pattern.CASE_INSENSITIVE
    );
    private static final Pattern FULL_TABLE_SCAN = Pattern.compile(
            "\\bFROM\\s+[\\w.`\"]+\\s*(;|$|GROUP|ORDER|LIMIT)",
            Pattern.CASE_INSENSITIVE
    );

    private final ConnectionVisibilityService connectionVisibilityService;

    public SqlReviewService(ConnectionVisibilityService connectionVisibilityService) {
        this.connectionVisibilityService = connectionVisibilityService;
    }

    public SqlReviewResultDto review(SqlReviewRequest request) {
        if (request.sql() == null || request.sql().isBlank()) {
            throw new IllegalArgumentException("sql is required");
        }
        String sql = request.sql().trim();
        List<SqlReviewFindingDto> findings = new ArrayList<>();

        if (SqlWriteClassifier.requiresDangerousSqlConfirmation(sql)) {
            findings.add(finding(
                    "error",
                    "DANGEROUS_DML",
                    "SQL 包含 DELETE / UPDATE / DROP / TRUNCATE 等危险操作",
                    "请确认影响范围，或在非生产环境先验证"
            ));
        }

        if (SqlWriteClassifier.requiresDdlAccess(sql)) {
            findings.add(finding(
                    "error",
                    "DDL",
                    "SQL 包含 DDL 语句（CREATE / ALTER / DROP 等）",
                    "DDL 变更建议通过迁移向导或审批流程执行"
            ));
        }

        if (SELECT_STAR.matcher(sql).find()) {
            findings.add(finding(
                    "warn",
                    "SELECT_STAR",
                    "使用了 SELECT *，可能返回过多列",
                    "仅选择需要的列以提升性能与可读性"
            ));
        }

        if (isMissingWhereDml(sql)) {
            findings.add(finding(
                    "error",
                    "MISSING_WHERE",
                    "UPDATE / DELETE 未检测到 WHERE 条件",
                    "添加 WHERE 子句以避免全表变更"
            ));
        }

        if (looksLikeFullTableScan(sql)) {
            findings.add(finding(
                    "warn",
                    "FULL_SCAN",
                    "查询可能触发全表扫描（无 WHERE / LIMIT）",
                    "添加过滤条件、索引列或 LIMIT 限制结果集"
            ));
        }

        boolean requiresApproval = requiresProductionApproval(request, sql);
        if (requiresApproval) {
            findings.add(finding(
                    "warn",
                    "PROD_APPROVAL",
                    "生产环境写操作需要团队审批",
                    "提交生产审批后再执行，或联系团队管理员"
            ));
        }

        boolean blocked = findings.stream().anyMatch(f -> "error".equals(f.severity()));
        return new SqlReviewResultDto(!blocked, requiresApproval, findings);
    }

    private boolean requiresProductionApproval(SqlReviewRequest request, String sql) {
        if (request.connectionId() == null || request.connectionId().isBlank()) {
            return false;
        }
        if (!SqlWriteClassifier.requiresWriteAccess(sql)) {
            return false;
        }
        return connectionVisibilityService.resolveConnectionEntity(request.connectionId())
                .map(this::isProductionConnection)
                .orElse(false);
    }

    private boolean isProductionConnection(ConnectionEntity connection) {
        String env = connection.getEnv();
        if (env == null || env.isBlank()) {
            return false;
        }
        String normalized = env.trim().toLowerCase(Locale.ROOT);
        if ("prod".equals(normalized) || "production".equals(normalized)) {
            return true;
        }
        String custom = connection.getEnvCustom();
        return custom != null && custom.toLowerCase(Locale.ROOT).contains("prod");
    }

    private static boolean isMissingWhereDml(String sql) {
        String upper = sql.toUpperCase(Locale.ROOT);
        if (!upper.startsWith("DELETE ") && !upper.startsWith("UPDATE ")) {
            return false;
        }
        return !upper.contains(" WHERE ");
    }

    private static boolean looksLikeFullTableScan(String sql) {
        String upper = sql.toUpperCase(Locale.ROOT);
        if (!upper.startsWith("SELECT ") && !upper.startsWith("WITH ")) {
            return false;
        }
        if (upper.contains(" WHERE ") || upper.contains(" LIMIT ") || upper.contains(" JOIN ")) {
            return false;
        }
        return FULL_TABLE_SCAN.matcher(sql).find();
    }

    private static SqlReviewFindingDto finding(String severity, String code, String message, String suggestion) {
        return new SqlReviewFindingDto(severity, code, message, suggestion);
    }
}
