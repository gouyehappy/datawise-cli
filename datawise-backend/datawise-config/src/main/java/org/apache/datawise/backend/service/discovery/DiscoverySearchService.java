package org.apache.datawise.backend.service.discovery;

import org.apache.datawise.backend.configstore.SchemaCacheStore;
import org.apache.datawise.backend.configstore.SemanticMetricStore;
import org.apache.datawise.backend.domain.DiscoveryColumnPeekDto;
import org.apache.datawise.backend.domain.DiscoveryFacetValueDto;
import org.apache.datawise.backend.domain.DiscoveryFacetsDto;
import org.apache.datawise.backend.domain.DiscoveryHitDto;
import org.apache.datawise.backend.domain.DiscoverySearchPageDto;
import org.apache.datawise.backend.domain.TreeNode;
import org.apache.datawise.backend.model.ConnectionEntity;
import org.apache.datawise.backend.model.SemanticMetricEntry;
import org.apache.datawise.backend.service.ConnectionVisibilityService;
import org.springframework.stereotype.Service;

import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * Cross-connection discovery over schema cache + semantic metrics (no live JDBC).
 */
@Service
public class DiscoverySearchService {

    private static final int DEFAULT_LIMIT = 40;
    private static final int MAX_LIMIT = 100;
    private static final int MAX_COLUMN_PEEK = 40;
    private static final Pattern HASHTAG = Pattern.compile("#([\\p{L}\\p{N}_-]+)");

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

    public DiscoverySearchPageDto search(String query, Integer limit) {
        return search(query, limit, null, null, null, null, null);
    }

    public DiscoverySearchPageDto search(String query, Integer limit, Integer offset) {
        return search(query, limit, offset, null, null, null, null);
    }

    public DiscoverySearchPageDto search(
            String query,
            Integer limit,
            Integer offset,
            List<String> kinds,
            List<String> connectionIds,
            List<String> owners,
            List<String> tags
    ) {
        String normalized = query != null ? query.trim() : "";
        int cap = limit == null || limit <= 0 ? DEFAULT_LIMIT : Math.min(limit, MAX_LIMIT);
        int skip = offset == null || offset < 0 ? 0 : offset;
        List<String> tokens = tokenize(normalized);
        boolean browse = tokens.isEmpty();

        Set<String> kindFilter = normalizeFilterSet(kinds, true);
        Set<String> connectionFilter = normalizeFilterSet(connectionIds, false);
        Set<String> ownerFilter = normalizeFilterSet(owners, true);
        Set<String> tagFilter = normalizeFilterSet(tags, true);

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
                walkTables(root, List.of(), connection, tokens, browse, hits, seen);
            }
        }

        for (SemanticMetricEntry metric : metricStore.listAll()) {
            if (!isMetricVisible(metric, catalog)) {
                continue;
            }
            DiscoveryHitDto hit = scoreMetric(metric, connectionLabel(metric, catalog), tokens, browse);
            if (hit == null) {
                continue;
            }
            String key = "metric|" + hit.id();
            if (seen.add(key)) {
                hits.add(hit);
            }
        }

        Comparator<DiscoveryHitDto> order = browse
                ? Comparator.comparing(DiscoveryHitDto::qualifiedLabel, String.CASE_INSENSITIVE_ORDER)
                : Comparator.comparingInt(DiscoveryHitDto::score).reversed()
                        .thenComparing(DiscoveryHitDto::qualifiedLabel, String.CASE_INSENSITIVE_ORDER);

        List<DiscoveryHitDto> matched = hits.stream().sorted(order).toList();
        DiscoveryFacetsDto facets = buildFacets(matched, kindFilter, connectionFilter, ownerFilter, tagFilter);
        List<DiscoveryHitDto> filtered = applyFilters(matched, kindFilter, connectionFilter, ownerFilter, tagFilter);
        int total = filtered.size();
        List<DiscoveryHitDto> page = filtered.stream()
                .skip(skip)
                .limit(cap)
                .toList();
        boolean hasMore = skip + page.size() < total;
        return new DiscoverySearchPageDto(page, total, skip, cap, hasMore, facets);
    }

    private DiscoveryFacetsDto buildFacets(
            List<DiscoveryHitDto> matched,
            Set<String> kinds,
            Set<String> connectionIds,
            Set<String> owners,
            Set<String> tags
    ) {
        return new DiscoveryFacetsDto(
                countKinds(applyFilters(matched, Set.of(), connectionIds, owners, tags)),
                countConnections(applyFilters(matched, kinds, Set.of(), owners, tags)),
                countOwners(applyFilters(matched, kinds, connectionIds, Set.of(), tags)),
                countTags(applyFilters(matched, kinds, connectionIds, owners, Set.of()))
        );
    }

    private static List<DiscoveryHitDto> applyFilters(
            List<DiscoveryHitDto> hits,
            Set<String> kinds,
            Set<String> connectionIds,
            Set<String> owners,
            Set<String> tags
    ) {
        if (kinds.isEmpty() && connectionIds.isEmpty() && owners.isEmpty() && tags.isEmpty()) {
            return hits;
        }
        List<DiscoveryHitDto> out = new ArrayList<>();
        for (DiscoveryHitDto hit : hits) {
            if (!kinds.isEmpty() && !kinds.contains(hit.kind().toLowerCase(Locale.ROOT))) {
                continue;
            }
            if (!connectionIds.isEmpty()) {
                String connectionId = hit.connectionId() != null ? hit.connectionId() : "";
                if (!connectionIds.contains(connectionId)) {
                    continue;
                }
            }
            if (!owners.isEmpty()) {
                String owner = hit.owner() != null ? hit.owner().trim().toLowerCase(Locale.ROOT) : "";
                if (owner.isEmpty() || !owners.contains(owner)) {
                    continue;
                }
            }
            if (!tags.isEmpty()) {
                List<String> hitTags = hit.tags() != null ? hit.tags() : List.of();
                boolean any = false;
                for (String tag : hitTags) {
                    if (tag != null && tags.contains(tag.toLowerCase(Locale.ROOT))) {
                        any = true;
                        break;
                    }
                }
                if (!any) {
                    continue;
                }
            }
            out.add(hit);
        }
        return out;
    }

    private static List<DiscoveryFacetValueDto> countKinds(List<DiscoveryHitDto> hits) {
        Map<String, Integer> counts = new LinkedHashMap<>();
        for (String kind : List.of("table", "view", "metric")) {
            counts.put(kind, 0);
        }
        for (DiscoveryHitDto hit : hits) {
            counts.merge(hit.kind(), 1, Integer::sum);
        }
        List<DiscoveryFacetValueDto> out = new ArrayList<>();
        for (Map.Entry<String, Integer> entry : counts.entrySet()) {
            if (entry.getValue() > 0) {
                out.add(new DiscoveryFacetValueDto(entry.getKey(), entry.getKey(), entry.getValue()));
            }
        }
        return out;
    }

    private static List<DiscoveryFacetValueDto> countConnections(List<DiscoveryHitDto> hits) {
        Map<String, Integer> counts = new LinkedHashMap<>();
        Map<String, String> labels = new LinkedHashMap<>();
        for (DiscoveryHitDto hit : hits) {
            String id = hit.connectionId() != null ? hit.connectionId().trim() : "";
            if (id.isEmpty()) {
                continue;
            }
            counts.merge(id, 1, Integer::sum);
            labels.putIfAbsent(id, hit.connectionLabel() != null && !hit.connectionLabel().isBlank()
                    ? hit.connectionLabel()
                    : id);
        }
        return counts.entrySet().stream()
                .map(entry -> new DiscoveryFacetValueDto(
                        entry.getKey(),
                        labels.getOrDefault(entry.getKey(), entry.getKey()),
                        entry.getValue()
                ))
                .sorted(Comparator
                        .comparing(DiscoveryFacetValueDto::label, String.CASE_INSENSITIVE_ORDER)
                        .thenComparing(DiscoveryFacetValueDto::count, Comparator.reverseOrder()))
                .toList();
    }

    private static List<DiscoveryFacetValueDto> countOwners(List<DiscoveryHitDto> hits) {
        Map<String, Integer> counts = new LinkedHashMap<>();
        for (DiscoveryHitDto hit : hits) {
            String owner = hit.owner() != null ? hit.owner().trim() : "";
            if (owner.isEmpty()) {
                continue;
            }
            counts.merge(owner, 1, Integer::sum);
        }
        return counts.entrySet().stream()
                .map(entry -> new DiscoveryFacetValueDto(entry.getKey(), entry.getKey(), entry.getValue()))
                .sorted(Comparator
                        .comparing(DiscoveryFacetValueDto::label, String.CASE_INSENSITIVE_ORDER)
                        .thenComparing(DiscoveryFacetValueDto::count, Comparator.reverseOrder()))
                .toList();
    }

    private static List<DiscoveryFacetValueDto> countTags(List<DiscoveryHitDto> hits) {
        Map<String, Integer> counts = new LinkedHashMap<>();
        for (DiscoveryHitDto hit : hits) {
            if (hit.tags() == null) {
                continue;
            }
            for (String tag : hit.tags()) {
                if (tag == null || tag.isBlank()) {
                    continue;
                }
                counts.merge(tag.toLowerCase(Locale.ROOT), 1, Integer::sum);
            }
        }
        return counts.entrySet().stream()
                .map(entry -> new DiscoveryFacetValueDto(entry.getKey(), entry.getKey(), entry.getValue()))
                .sorted(Comparator
                        .comparing(DiscoveryFacetValueDto::label, String.CASE_INSENSITIVE_ORDER)
                        .thenComparing(DiscoveryFacetValueDto::count, Comparator.reverseOrder()))
                .toList();
    }

    private static Set<String> normalizeFilterSet(List<String> values, boolean lowerCase) {
        if (values == null || values.isEmpty()) {
            return Set.of();
        }
        Set<String> out = new LinkedHashSet<>();
        for (String value : values) {
            if (value == null) {
                continue;
            }
            for (String part : value.split(",")) {
                String trimmed = part.trim();
                if (trimmed.isEmpty()) {
                    continue;
                }
                if (trimmed.startsWith("#")) {
                    trimmed = trimmed.substring(1).trim();
                }
                if (trimmed.isEmpty()) {
                    continue;
                }
                out.add(lowerCase ? trimmed.toLowerCase(Locale.ROOT) : trimmed);
            }
        }
        return out;
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
            boolean browse,
            List<DiscoveryHitDto> hits,
            Set<String> seen
    ) {
        String type = node.getType();
        if ("table".equals(type) || "view".equals(type)) {
            DiscoveryHitDto hit = scoreTable(node, parents, connection, tokens, browse);
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
            walkTables(child, nextParents, connection, tokens, browse, hits, seen);
        }
    }

    private DiscoveryHitDto scoreTable(
            TreeNode node,
            List<TreeNode> parents,
            ConnectionEntity connection,
            List<String> tokens,
            boolean browse
    ) {
        String database = resolveDatabaseLabel(parents, connection.getDbType());
        String name = node.getLabel() != null ? node.getLabel() : "";
        String qualified = database.isBlank() ? name : database + "." + name;
        String connectionLabel = connection.getName() != null ? connection.getName() : connection.getId();
        List<String> tags = extractHashtags(node.getComment());
        String searchText = joinLower(
                name,
                qualified,
                connectionLabel,
                database,
                node.getType(),
                node.getMeta(),
                node.getComment(),
                String.join(" ", tags)
        );
        int score;
        if (browse) {
            score = 1;
        } else {
            score = scoreTokens(name, qualified, searchText, tokens);
            if (score < 0) {
                return null;
            }
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
                score,
                List.of(),
                extractColumnPeek(node),
                tags
        );
    }

    private DiscoveryHitDto scoreMetric(
            SemanticMetricEntry metric,
            String connectionLabel,
            List<String> tokens,
            boolean browse
    ) {
        String name = metric.getName() != null ? metric.getName() : "";
        String database = metric.getDatabase() != null ? metric.getDatabase() : "";
        String qualified = database.isBlank() ? name : database + "." + name;
        List<String> tags = normalizeTags(metric.getTags());
        String searchText = joinLower(
                name,
                qualified,
                connectionLabel,
                database,
                "metric",
                metric.getDescription(),
                metric.getOwner(),
                metric.getExpression(),
                String.join(" ", tags)
        );
        int score;
        if (browse) {
            score = 1;
        } else {
            score = scoreTokens(name, qualified, searchText, tokens);
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
        }
        String subtitle = firstNonBlank(metric.getDescription(), metric.getExpression());
        if (metric.getOwner() != null && !metric.getOwner().isBlank()) {
            subtitle = subtitle == null || subtitle.isBlank()
                    ? "owner: " + metric.getOwner()
                    : subtitle + " · owner: " + metric.getOwner();
        }
        List<String> related = metric.getRelatedTables() == null
                ? List.of()
                : metric.getRelatedTables().stream()
                        .filter(item -> item != null && !item.isBlank())
                        .map(String::trim)
                        .toList();
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
                score,
                related,
                List.of(),
                tags
        );
    }

    static List<DiscoveryColumnPeekDto> extractColumnPeek(TreeNode tableOrViewNode) {
        if (tableOrViewNode == null || tableOrViewNode.getChildren() == null) {
            return List.of();
        }
        TreeNode columnsFolder = null;
        for (TreeNode child : tableOrViewNode.getChildren()) {
            if ("columns".equals(child.getType())) {
                columnsFolder = child;
                break;
            }
        }
        if (columnsFolder == null || columnsFolder.getChildren() == null || columnsFolder.getChildren().isEmpty()) {
            return List.of();
        }
        List<DiscoveryColumnPeekDto> out = new ArrayList<>();
        for (TreeNode columnNode : columnsFolder.getChildren()) {
            String columnType = columnNode.getType();
            if (!"column".equals(columnType) && !"primary_key".equals(columnType)) {
                continue;
            }
            String columnName = columnNode.getLabel();
            if (columnName == null || columnName.isBlank()) {
                continue;
            }
            out.add(new DiscoveryColumnPeekDto(columnName.trim(), normalizeColumnType(columnNode.getMeta())));
            if (out.size() >= MAX_COLUMN_PEEK) {
                break;
            }
        }
        return List.copyOf(out);
    }

    private static String normalizeColumnType(String meta) {
        if (meta == null || meta.isBlank()) {
            return null;
        }
        String trimmed = meta.trim();
        String lower = trimmed.toLowerCase(Locale.ROOT);
        if (lower.endsWith(" · pk")) {
            trimmed = trimmed.substring(0, trimmed.length() - 4).trim();
        } else if ("pk".equals(lower)) {
            return null;
        }
        return trimmed.isEmpty() ? null : trimmed;
    }

    static List<String> extractHashtags(String comment) {
        if (comment == null || comment.isBlank()) {
            return List.of();
        }
        LinkedHashSet<String> tags = new LinkedHashSet<>();
        Matcher matcher = HASHTAG.matcher(comment);
        while (matcher.find()) {
            String tag = matcher.group(1).toLowerCase(Locale.ROOT);
            if (!tag.isBlank()) {
                tags.add(tag);
            }
        }
        return List.copyOf(tags);
    }

    static List<String> normalizeTags(List<String> tags) {
        if (tags == null || tags.isEmpty()) {
            return List.of();
        }
        LinkedHashSet<String> out = new LinkedHashSet<>();
        for (String tag : tags) {
            if (tag == null) {
                continue;
            }
            String trimmed = tag.trim();
            if (trimmed.startsWith("#")) {
                trimmed = trimmed.substring(1).trim();
            }
            if (trimmed.isEmpty()) {
                continue;
            }
            out.add(trimmed.toLowerCase(Locale.ROOT));
        }
        return List.copyOf(out);
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
