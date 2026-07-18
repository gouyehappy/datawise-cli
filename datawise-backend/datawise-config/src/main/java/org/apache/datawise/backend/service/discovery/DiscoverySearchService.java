package org.apache.datawise.backend.service.discovery;

import org.apache.datawise.backend.configstore.SchemaCacheStore;
import org.apache.datawise.backend.configstore.SemanticMetricStore;
import org.apache.datawise.backend.domain.DiscoveryHitDto;
import org.apache.datawise.backend.domain.TreeNode;
import org.apache.datawise.backend.model.ConnectionEntity;
import org.apache.datawise.backend.model.SemanticMetricEntry;
import org.apache.datawise.backend.service.ConnectionVisibilityService;
import org.springframework.stereotype.Service;

import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashSet;
import java.util.List;
import java.util.Locale;
import java.util.Set;

/**
 * Cross-connection discovery over schema cache + semantic metrics (no live JDBC).
 */
@Service
public class DiscoverySearchService {

    private static final int DEFAULT_LIMIT = 40;
    private static final int MAX_LIMIT = 100;

    private final ConnectionVisibilityService connectionVisibilityService;
    private final SchemaCacheStore schemaCacheStore;
    private final SemanticMetricStore metricStore;

    public DiscoverySearchService(
            ConnectionVisibilityService connectionVisibilityService,
            SchemaCacheStore schemaCacheStore,
            SemanticMetricStore metricStore
    ) {
        this.connectionVisibilityService = connectionVisibilityService;
        this.schemaCacheStore = schemaCacheStore;
        this.metricStore = metricStore;
    }

    public List<DiscoveryHitDto> search(String query, Integer limit) {
        String normalized = query != null ? query.trim() : "";
        if (normalized.isEmpty()) {
            return List.of();
        }
        int cap = limit == null || limit <= 0 ? DEFAULT_LIMIT : Math.min(limit, MAX_LIMIT);
        List<String> tokens = tokenize(normalized);
        if (tokens.isEmpty()) {
            return List.of();
        }

        ConnectionVisibilityService.VisibleCatalog catalog =
                connectionVisibilityService.visibleCatalogForCurrentUser();
        List<DiscoveryHitDto> hits = new ArrayList<>();
        Set<String> seen = new HashSet<>();

        for (ConnectionEntity connection : catalog.connections()) {
            List<TreeNode> roots = schemaCacheStore.load(connection.getId());
            if (roots.isEmpty()) {
                continue;
            }
            for (TreeNode root : roots) {
                walkTables(root, List.of(), connection, tokens, hits, seen);
            }
        }

        for (SemanticMetricEntry metric : metricStore.listAll()) {
            if (!isMetricVisible(metric, catalog)) {
                continue;
            }
            DiscoveryHitDto hit = scoreMetric(metric, connectionLabel(metric, catalog), tokens);
            if (hit == null) {
                continue;
            }
            String key = "metric|" + hit.id();
            if (seen.add(key)) {
                hits.add(hit);
            }
        }

        return hits.stream()
                .sorted(Comparator.comparingInt(DiscoveryHitDto::score).reversed()
                        .thenComparing(DiscoveryHitDto::qualifiedLabel, String.CASE_INSENSITIVE_ORDER))
                .limit(cap)
                .toList();
    }

    private boolean isMetricVisible(SemanticMetricEntry metric, ConnectionVisibilityService.VisibleCatalog catalog) {
        String connectionId = metric.getConnectionId();
        if (connectionId == null || connectionId.isBlank()) {
            return true;
        }
        return catalog.connections().stream().anyMatch(c -> connectionId.equals(c.getId()));
    }

    private String connectionLabel(SemanticMetricEntry metric, ConnectionVisibilityService.VisibleCatalog catalog) {
        String connectionId = metric.getConnectionId();
        if (connectionId == null || connectionId.isBlank()) {
            return "";
        }
        return catalog.connections().stream()
                .filter(c -> connectionId.equals(c.getId()))
                .map(ConnectionEntity::getName)
                .findFirst()
                .orElse(connectionId);
    }

    private void walkTables(
            TreeNode node,
            List<TreeNode> parents,
            ConnectionEntity connection,
            List<String> tokens,
            List<DiscoveryHitDto> hits,
            Set<String> seen
    ) {
        String type = node.getType();
        if ("table".equals(type) || "view".equals(type)) {
            DiscoveryHitDto hit = scoreTable(node, parents, connection, tokens);
            if (hit != null) {
                String key = hit.kind() + "|" + hit.connectionId() + "|" + hit.database() + "|" + hit.name();
                if (seen.add(key)) {
                    hits.add(hit);
                }
            }
        }
        List<TreeNode> nextParents = new ArrayList<>(parents);
        nextParents.add(node);
        List<TreeNode> children = node.getChildren();
        if (children == null || children.isEmpty()) {
            return;
        }
        for (TreeNode child : children) {
            walkTables(child, nextParents, connection, tokens, hits, seen);
        }
    }

    private DiscoveryHitDto scoreTable(
            TreeNode node,
            List<TreeNode> parents,
            ConnectionEntity connection,
            List<String> tokens
    ) {
        String database = resolveDatabaseLabel(parents, connection.getDbType());
        String name = node.getLabel() != null ? node.getLabel() : "";
        String qualified = database.isBlank() ? name : database + "." + name;
        String connectionLabel = connection.getName() != null ? connection.getName() : connection.getId();
        String searchText = joinLower(
                name,
                qualified,
                connectionLabel,
                database,
                node.getType(),
                node.getMeta(),
                node.getComment()
        );
        int score = scoreTokens(name, qualified, searchText, tokens);
        if (score < 0) {
            return null;
        }
        String id = node.getId() != null && !node.getId().isBlank()
                ? node.getId()
                : connection.getId() + ":" + qualified;
        return new DiscoveryHitDto(
                node.getType(),
                id,
                name,
                qualified,
                connection.getId(),
                connectionLabel,
                database,
                null,
                trimOrNull(node.getComment()),
                score
        );
    }

    private DiscoveryHitDto scoreMetric(SemanticMetricEntry metric, String connectionLabel, List<String> tokens) {
        String name = metric.getName() != null ? metric.getName() : "";
        String database = metric.getDatabase() != null ? metric.getDatabase() : "";
        String qualified = database.isBlank() ? name : database + "." + name;
        String searchText = joinLower(
                name,
                qualified,
                connectionLabel,
                database,
                "metric",
                metric.getDescription(),
                metric.getOwner(),
                metric.getExpression()
        );
        int score = scoreTokens(name, qualified, searchText, tokens);
        if (score < 0) {
            return null;
        }
        if (metric.getOwner() != null && !metric.getOwner().isBlank()) {
            String ownerLower = metric.getOwner().toLowerCase(Locale.ROOT);
            for (String token : tokens) {
                if (ownerLower.contains(token)) {
                    score += 25;
                }
            }
        }
        String subtitle = firstNonBlank(metric.getDescription(), metric.getExpression());
        if (metric.getOwner() != null && !metric.getOwner().isBlank()) {
            subtitle = subtitle == null || subtitle.isBlank()
                    ? "owner: " + metric.getOwner()
                    : subtitle + " · owner: " + metric.getOwner();
        }
        return new DiscoveryHitDto(
                "metric",
                metric.getId(),
                name,
                qualified,
                metric.getConnectionId() != null ? metric.getConnectionId() : "",
                connectionLabel,
                database,
                trimOrNull(metric.getOwner()),
                trimOrNull(subtitle),
                score
        );
    }

    private static String resolveDatabaseLabel(List<TreeNode> parents, String dbType) {
        TreeNode database = findType(parents, "database");
        TreeNode schema = findType(parents, "schema");
        if (database == null) {
            return schema != null && schema.getLabel() != null ? schema.getLabel() : "";
        }
        String dbLabel = database.getLabel() != null ? database.getLabel() : "";
        if (isCatalogSchemaDbType(dbType) && schema != null && schema.getLabel() != null) {
            return dbLabel + "." + schema.getLabel();
        }
        return dbLabel;
    }

    private static TreeNode findType(List<TreeNode> parents, String type) {
        for (TreeNode parent : parents) {
            if (type.equals(parent.getType())) {
                return parent;
            }
        }
        return null;
    }

    private static boolean isCatalogSchemaDbType(String dbType) {
        if (dbType == null || dbType.isBlank()) {
            return false;
        }
        String normalized = dbType.trim().toLowerCase(Locale.ROOT);
        return "trino".equals(normalized) || "presto".equals(normalized) || "hive".equals(normalized);
    }

    private static List<String> tokenize(String query) {
        String[] parts = query.toLowerCase(Locale.ROOT).split("\\s+");
        List<String> tokens = new ArrayList<>();
        for (String part : parts) {
            if (!part.isBlank()) {
                tokens.add(part);
            }
        }
        return tokens;
    }

    private static int scoreTokens(String name, String qualified, String searchText, List<String> tokens) {
        int score = 0;
        String nameLower = name.toLowerCase(Locale.ROOT);
        String qualifiedLower = qualified.toLowerCase(Locale.ROOT);
        for (String token : tokens) {
            if (!searchText.contains(token)) {
                return -1;
            }
            if (nameLower.equals(token)) {
                score += 120;
            } else if (nameLower.startsWith(token)) {
                score += 80;
            } else if (qualifiedLower.startsWith(token)) {
                score += 60;
            } else if (nameLower.contains(token)) {
                score += 40;
            } else {
                score += 15;
            }
        }
        return score;
    }

    private static String joinLower(String... parts) {
        StringBuilder sb = new StringBuilder();
        for (String part : parts) {
            if (part == null || part.isBlank()) {
                continue;
            }
            if (!sb.isEmpty()) {
                sb.append(' ');
            }
            sb.append(part.toLowerCase(Locale.ROOT));
        }
        return sb.toString();
    }

    private static String firstNonBlank(String... values) {
        for (String value : values) {
            if (value != null && !value.isBlank()) {
                return value.trim();
            }
        }
        return null;
    }

    private static String trimOrNull(String value) {
        if (value == null) {
            return null;
        }
        String trimmed = value.trim();
        return trimmed.isEmpty() ? null : trimmed;
    }
}
