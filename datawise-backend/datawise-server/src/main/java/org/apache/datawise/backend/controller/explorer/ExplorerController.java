package org.apache.datawise.backend.controller.explorer;

import org.apache.datawise.backend.common.ApiResponse;
import org.apache.datawise.backend.common.support.PerfLogger;
import org.apache.datawise.backend.database.explorer.ExplorerConnectionAdminService;
import org.apache.datawise.backend.database.explorer.ExplorerConnectionLifecycleService;
import org.apache.datawise.backend.database.explorer.ExplorerKafkaService;
import org.apache.datawise.backend.database.explorer.ExplorerRedisService;
import org.apache.datawise.backend.database.explorer.ExplorerYarnService;
import org.apache.datawise.backend.database.explorer.ExplorerLoadOptions;
import org.apache.datawise.backend.database.explorer.ExplorerSchemaService;
import org.apache.datawise.backend.database.explorer.ExplorerChildLoadOutcome;
import org.apache.datawise.backend.database.explorer.ExplorerLoadMetrics;
import org.apache.datawise.backend.database.explorer.ExplorerTreeEtag;
import org.apache.datawise.backend.domain.ConnectionConfig;
import org.apache.datawise.backend.domain.ConnectionResult;
import org.apache.datawise.backend.domain.ConnectionTestResult;
import org.apache.datawise.backend.domain.CreateConnectionRequest;
import org.apache.datawise.backend.domain.GroupResult;
import org.apache.datawise.backend.domain.ImportConnectionsRequest;
import org.apache.datawise.backend.domain.ImportConnectionsResult;
import org.apache.datawise.backend.domain.KafkaConsumerGroupMetricsDto;
import org.apache.datawise.backend.domain.KafkaConsumerGroupsResultDto;
import org.apache.datawise.backend.domain.KafkaMessagesResultDto;
import org.apache.datawise.backend.domain.KafkaProduceResultDto;
import org.apache.datawise.backend.domain.KafkaTopicDetailDto;
import org.apache.datawise.backend.domain.KafkaTopicsResultDto;
import org.apache.datawise.backend.domain.ProduceKafkaMessageRequest;
import org.apache.datawise.backend.domain.PublishTableToKafkaRequest;
import org.apache.datawise.backend.domain.PublishTableToKafkaResult;
import org.apache.datawise.backend.domain.ExecuteRedisCommandRequest;
import org.apache.datawise.backend.domain.RedisCommandResultDto;
import org.apache.datawise.backend.domain.RedisKeyDetailDto;
import org.apache.datawise.backend.domain.RedisKeysScanResultDto;
import org.apache.datawise.backend.domain.YarnAppDetailDto;
import org.apache.datawise.backend.domain.YarnKillApplicationRequest;
import org.apache.datawise.backend.domain.YarnMoveApplicationQueueRequest;
import org.apache.datawise.backend.domain.YarnMutationResultDto;
import org.apache.datawise.backend.domain.YarnRemoveQueueRequest;
import org.apache.datawise.backend.domain.YarnUpdateQueueRequest;
import org.apache.datawise.backend.domain.YarnAppsResultDto;
import org.apache.datawise.backend.domain.YarnClusterInfoDto;
import org.apache.datawise.backend.domain.YarnNodesResultDto;
import org.apache.datawise.backend.domain.YarnQueuesResultDto;
import org.apache.datawise.backend.domain.TreeNode;
import org.apache.datawise.backend.domain.TreePayload;
import org.apache.datawise.backend.security.HeadlessSqlAuth;
import org.apache.datawise.backend.service.FeaturePermissionAccess;
import org.springframework.http.HttpHeaders;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/explorer")
public class ExplorerController {

    private static final Logger log = LoggerFactory.getLogger(ExplorerController.class);

    private final ExplorerSchemaService schemaService;
    private final ExplorerLoadMetrics explorerLoadMetrics;
    private final ExplorerRedisService redisService;
    private final ExplorerKafkaService kafkaService;
    private final ExplorerYarnService yarnService;
    private final ExplorerConnectionAdminService connectionAdminService;
    private final ExplorerConnectionLifecycleService connectionLifecycleService;
    private final FeaturePermissionAccess featurePermissionAccess;

    public ExplorerController(
            ExplorerSchemaService schemaService,
            ExplorerLoadMetrics explorerLoadMetrics,
            ExplorerRedisService redisService,
            ExplorerKafkaService kafkaService,
            ExplorerYarnService yarnService,
            ExplorerConnectionAdminService connectionAdminService,
            ExplorerConnectionLifecycleService connectionLifecycleService,
            FeaturePermissionAccess featurePermissionAccess
    ) {
        this.schemaService = schemaService;
        this.explorerLoadMetrics = explorerLoadMetrics;
        this.redisService = redisService;
        this.kafkaService = kafkaService;
        this.yarnService = yarnService;
        this.connectionAdminService = connectionAdminService;
        this.connectionLifecycleService = connectionLifecycleService;
        this.featurePermissionAccess = featurePermissionAccess;
    }

    @GetMapping("/tree")
    public ApiResponse<TreePayload> fetchTree(@RequestParam(required = false) Boolean refresh) {
        List<TreeNode> tree = schemaService.fetchTree(Boolean.TRUE.equals(refresh));
        return ApiResponse.ok(new TreePayload(tree));
    }

    @GetMapping("/connections/{connectionId}")
    public ApiResponse<ConnectionConfig> fetchConnection(@PathVariable String connectionId) {
        return ApiResponse.ok(schemaService.getConnection(connectionId));
    }

    @PostMapping("/connections/{connectionId}/connect")
    public ApiResponse<ConnectionTestResult> connectConnection(@PathVariable String connectionId) {
        featurePermissionAccess.requireExplorerContextConnection();
        return ApiResponse.ok(connectionLifecycleService.connect(connectionId));
    }

    @GetMapping("/connections/{connectionId}/ping")
    public ApiResponse<ConnectionTestResult> pingConnection(@PathVariable String connectionId) {
        return ApiResponse.ok(connectionLifecycleService.ping(connectionId));
    }

    @PostMapping("/connections/{connectionId}/disconnect")
    public ApiResponse<Void> disconnectConnection(@PathVariable String connectionId) {
        featurePermissionAccess.requireExplorerContextConnection();
        connectionLifecycleService.disconnect(connectionId);
        return ApiResponse.ok(null);
    }

    @GetMapping("/connections/pooled")
    public ApiResponse<List<String>> listPooledConnections() {
        return ApiResponse.ok(connectionLifecycleService.listPooledConnectionIds());
    }

    @PostMapping("/connections/{connectionId}/reconnect")
    public ApiResponse<ConnectionTestResult> reconnectConnection(@PathVariable String connectionId) {
        featurePermissionAccess.requireExplorerContextConnection();
        return ApiResponse.ok(connectionLifecycleService.reconnect(connectionId));
    }

    @GetMapping("/connections/{connectionId}/nodes/{nodeId}/children")
    public ResponseEntity<ApiResponse<TreePayload>> loadChildren(
            @PathVariable String connectionId,
            @PathVariable String nodeId,
            @RequestParam(required = false) String pattern,
            @RequestParam(required = false, defaultValue = "false") boolean refresh,
            @RequestParam(required = false) Integer offset,
            @RequestParam(required = false) Integer limit,
            @RequestParam(required = false, defaultValue = "true") boolean skeleton,
            @RequestHeader(value = HttpHeaders.IF_NONE_MATCH, required = false) String ifNoneMatch
    ) {
        long startedAt = System.currentTimeMillis();
        ExplorerLoadOptions options = ExplorerLoadOptions.of(pattern, refresh, offset, limit, skeleton);
        ExplorerChildLoadOutcome outcome = schemaService.loadChildrenWithCaching(
                connectionId,
                nodeId,
                options,
                ifNoneMatch
        );
        explorerLoadMetrics.record(outcome);
        if (outcome.notModified()) {
            return ResponseEntity.status(304)
                    .eTag(ExplorerTreeEtag.stripQuotes(outcome.etag()))
                    .build();
        }
        PerfLogger.log(
                log,
                "explorer.loadChildren",
                startedAt,
                "connectionId", connectionId,
                "nodeId", nodeId,
                "etag", ExplorerTreeEtag.stripQuotes(outcome.etag()),
                "fromCache", false,
                "shortCircuit", false
        );
        return ResponseEntity.ok()
                .eTag(ExplorerTreeEtag.stripQuotes(outcome.etag()))
                .body(ApiResponse.ok(outcome.result().payload()));
    }

    @GetMapping("/connections/{connectionId}/redis/key")
    public ApiResponse<RedisKeyDetailDto> fetchRedisKey(
            @PathVariable String connectionId,
            @RequestParam String key,
            @RequestParam(required = false) Integer database
    ) {
        return ApiResponse.ok(redisService.getRedisKeyDetail(connectionId, key, database));
    }

    @GetMapping("/connections/{connectionId}/redis/keys")
    public ApiResponse<RedisKeysScanResultDto> scanRedisKeys(
            @PathVariable String connectionId,
            @RequestParam(required = false) String pattern,
            @RequestParam(required = false) String cursor,
            @RequestParam(required = false) Integer count,
            @RequestParam(required = false) Integer database
    ) {
        return ApiResponse.ok(redisService.scanRedisKeys(connectionId, pattern, cursor, count, database));
    }

    @PostMapping("/connections/{connectionId}/redis/command")
    public ApiResponse<RedisCommandResultDto> executeRedisCommand(
            @PathVariable String connectionId,
            @RequestBody ExecuteRedisCommandRequest request,
            @RequestParam(required = false) Integer database
    ) {
        HeadlessSqlAuth.requireSqlAccess();
        featurePermissionAccess.requireRedisCommand(request.command());
        return ApiResponse.ok(redisService.executeRedisCommand(connectionId, request.command(), database));
    }

    @GetMapping("/connections/{connectionId}/kafka/topics")
    public ApiResponse<KafkaTopicsResultDto> listKafkaTopics(
            @PathVariable String connectionId,
            @RequestParam(required = false) String pattern,
            @RequestParam(required = false) Integer limit
    ) {
        return ApiResponse.ok(kafkaService.listTopics(connectionId, pattern, limit));
    }

    @GetMapping("/connections/{connectionId}/kafka/topics/{topic}")
    public ApiResponse<KafkaTopicDetailDto> describeKafkaTopic(
            @PathVariable String connectionId,
            @PathVariable String topic
    ) {
        return ApiResponse.ok(kafkaService.describeTopic(connectionId, topic));
    }

    @GetMapping("/connections/{connectionId}/kafka/topics/{topic}/messages")
    public ApiResponse<KafkaMessagesResultDto> consumeKafkaMessages(
            @PathVariable String connectionId,
            @PathVariable String topic,
            @RequestParam(required = false) Integer partition,
            @RequestParam(required = false) Long offset,
            @RequestParam(required = false) Integer limit,
            @RequestParam(required = false) Boolean fromBeginning
    ) {
        return ApiResponse.ok(kafkaService.consumeMessages(
                connectionId, topic, partition, offset, limit, fromBeginning
        ));
    }

    @PostMapping("/connections/{connectionId}/kafka/topics/{topic}/messages")
    public ApiResponse<KafkaProduceResultDto> produceKafkaMessage(
            @PathVariable String connectionId,
            @PathVariable String topic,
            @RequestBody ProduceKafkaMessageRequest request
    ) {
        featurePermissionAccess.requireExplorerContextExport();
        return ApiResponse.ok(kafkaService.produceMessage(
                connectionId,
                topic,
                request.key(),
                request.value(),
                request.partition()
        ));
    }

    @PostMapping("/connections/{connectionId}/kafka/publish-table")
    public ApiResponse<PublishTableToKafkaResult> publishTableToKafka(
            @PathVariable String connectionId,
            @RequestBody PublishTableToKafkaRequest request
    ) {
        featurePermissionAccess.requireExplorerContextExport();
        return ApiResponse.ok(kafkaService.publishTable(connectionId, request));
    }

    @GetMapping("/connections/{connectionId}/kafka/consumer-groups")
    public ApiResponse<KafkaConsumerGroupsResultDto> listKafkaConsumerGroups(
            @PathVariable String connectionId,
            @RequestParam(required = false) String pattern,
            @RequestParam(required = false) Integer limit
    ) {
        return ApiResponse.ok(kafkaService.listConsumerGroups(connectionId, pattern, limit));
    }

    @GetMapping("/connections/{connectionId}/kafka/consumer-groups/{groupId}/metrics")
    public ApiResponse<KafkaConsumerGroupMetricsDto> describeKafkaConsumerGroupMetrics(
            @PathVariable String connectionId,
            @PathVariable String groupId,
            @RequestParam(required = false) String topic
    ) {
        return ApiResponse.ok(kafkaService.describeConsumerGroupMetrics(connectionId, groupId, topic));
    }

    @GetMapping("/connections/{connectionId}/yarn/info")
    public ApiResponse<YarnClusterInfoDto> yarnClusterInfo(@PathVariable String connectionId) {
        return ApiResponse.ok(yarnService.clusterInfo(connectionId));
    }

    @GetMapping("/connections/{connectionId}/yarn/apps")
    public ApiResponse<YarnAppsResultDto> listYarnApplications(
            @PathVariable String connectionId,
            @RequestParam(required = false) String state,
            @RequestParam(required = false) String user,
            @RequestParam(required = false) String queue,
            @RequestParam(required = false) Integer limit
    ) {
        return ApiResponse.ok(yarnService.listApplications(connectionId, state, user, queue, limit));
    }

    @GetMapping("/connections/{connectionId}/yarn/apps/{appId}")
    public ApiResponse<YarnAppDetailDto> describeYarnApplication(
            @PathVariable String connectionId,
            @PathVariable String appId
    ) {
        return ApiResponse.ok(yarnService.describeApplication(connectionId, appId));
    }

    @GetMapping("/connections/{connectionId}/yarn/nodes")
    public ApiResponse<YarnNodesResultDto> listYarnNodes(
            @PathVariable String connectionId,
            @RequestParam(required = false) Integer limit
    ) {
        return ApiResponse.ok(yarnService.listNodes(connectionId, limit));
    }

    @GetMapping("/connections/{connectionId}/yarn/queues")
    public ApiResponse<YarnQueuesResultDto> listYarnQueues(@PathVariable String connectionId) {
        return ApiResponse.ok(yarnService.listQueues(connectionId));
    }

    @PutMapping("/connections/{connectionId}/yarn/apps/{appId}/state")
    public ApiResponse<YarnMutationResultDto> killYarnApplication(
            @PathVariable String connectionId,
            @PathVariable String appId,
            @RequestBody(required = false) YarnKillApplicationRequest request
    ) {
        featurePermissionAccess.requireExplorerContextExport();
        return ApiResponse.ok(yarnService.killApplication(connectionId, appId, request));
    }

    @PutMapping("/connections/{connectionId}/yarn/apps/{appId}/queue")
    public ApiResponse<YarnMutationResultDto> moveYarnApplicationQueue(
            @PathVariable String connectionId,
            @PathVariable String appId,
            @RequestBody YarnMoveApplicationQueueRequest request
    ) {
        featurePermissionAccess.requireExplorerContextExport();
        return ApiResponse.ok(yarnService.moveApplicationQueue(connectionId, appId, request));
    }

    @PutMapping("/connections/{connectionId}/yarn/queues")
    public ApiResponse<YarnMutationResultDto> updateYarnQueue(
            @PathVariable String connectionId,
            @RequestBody YarnUpdateQueueRequest request
    ) {
        featurePermissionAccess.requireExplorerContextExport();
        return ApiResponse.ok(yarnService.updateQueue(connectionId, request));
    }

    @PostMapping("/connections/{connectionId}/yarn/queues/remove")
    public ApiResponse<YarnMutationResultDto> removeYarnQueue(
            @PathVariable String connectionId,
            @RequestBody YarnRemoveQueueRequest request
    ) {
        featurePermissionAccess.requireExplorerContextExport();
        return ApiResponse.ok(yarnService.removeQueue(connectionId, request));
    }

    @PostMapping("/groups")
    public ApiResponse<GroupResult> createGroup(@RequestBody Map<String, String> body) {
        featurePermissionAccess.requireExplorerCatalogMutation();
        String label = body.getOrDefault("label", "New group");
        String parentId = body.get("parentId");
        return ApiResponse.ok(connectionAdminService.createGroup(label, parentId));
    }

    @PutMapping("/groups/{groupId}")
    public ApiResponse<TreePayload> updateGroup(
            @PathVariable String groupId,
            @RequestBody Map<String, String> body
    ) {
        featurePermissionAccess.requireExplorerCatalogMutation();
        String label = body.getOrDefault("label", "");
        return ApiResponse.ok(new TreePayload(connectionAdminService.updateGroup(groupId, label)));
    }

    @PostMapping("/connections")
    public ApiResponse<ConnectionResult> createConnection(@RequestBody CreateConnectionRequest request) {
        featurePermissionAccess.requireExplorerCatalogMutation();
        return ApiResponse.ok(connectionAdminService.createConnection(request.config(), request.groupId()));
    }

    @PutMapping("/connections/{connectionId}")
    public ApiResponse<TreePayload> updateConnection(
            @PathVariable String connectionId,
            @RequestBody ConnectionConfig config
    ) {
        featurePermissionAccess.requireExplorerCatalogMutation();
        return ApiResponse.ok(new TreePayload(connectionAdminService.updateConnection(connectionId, config)));
    }

    @PutMapping("/connections/{connectionId}/group")
    public ApiResponse<TreePayload> moveConnection(
            @PathVariable String connectionId,
            @RequestBody Map<String, String> body
    ) {
        featurePermissionAccess.requireExplorerCatalogMutation();
        String groupId = body.get("groupId");
        if (groupId == null || groupId.isBlank()) {
            throw new IllegalArgumentException("groupId is required");
        }
        return ApiResponse.ok(new TreePayload(connectionAdminService.moveConnection(connectionId, groupId)));
    }

    @DeleteMapping("/nodes/{nodeId}")
    public ApiResponse<TreePayload> deleteNode(@PathVariable String nodeId) {
        featurePermissionAccess.requireExplorerNodeDelete(connectionAdminService.isCatalogStructureNode(nodeId));
        return ApiResponse.ok(new TreePayload(connectionAdminService.deleteNode(nodeId)));
    }

    @PostMapping("/connections/import")
    public ApiResponse<ImportConnectionsResult> importConnections(@RequestBody ImportConnectionsRequest request) {
        featurePermissionAccess.requireExplorerContextExport();
        return ApiResponse.ok(connectionAdminService.importConnections(request.configs()));
    }
}
