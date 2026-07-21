package org.apache.datawise.backend.server.deployment;

import org.apache.datawise.backend.ai.config.AiAnalysisProperties;
import org.apache.datawise.backend.ai.config.AiPythonProperties;
import org.apache.datawise.backend.ai.config.AiRagProperties;
import org.apache.datawise.backend.config.AuthSecurityProperties;
import org.apache.datawise.backend.config.ConnectionProbeProperties;
import org.apache.datawise.backend.config.DatawiseQueryProperties;
import org.apache.datawise.backend.config.StorageProperties;
import org.apache.datawise.backend.domain.DeploymentProfileDto;
import org.apache.datawise.backend.domain.DeploymentProfileDto.DeploymentCheckDto;
import org.apache.datawise.taskconcurrency.spring.TaskConcurrencySpringProperties;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.env.Environment;
import org.springframework.stereotype.Service;

import java.util.ArrayList;
import java.util.Arrays;
import java.util.List;
import java.util.Locale;

/**
 * Compares live config against team-server recommendations in {@code docs/DEPLOYMENT.md}.
 */
@Service
public class DeploymentProfileService {

    private final Environment environment;
    private final StorageProperties storageProperties;
    private final AuthSecurityProperties authSecurityProperties;
    private final ConnectionProbeProperties connectionProbeProperties;
    private final DatawiseQueryProperties queryProperties;
    private final AiRagProperties ragProperties;
    private final AiAnalysisProperties analysisProperties;
    private final AiPythonProperties pythonProperties;
    private final TaskConcurrencySpringProperties taskConcurrencyProperties;
    private final boolean requireManifestIntegrity;

    public DeploymentProfileService(
            Environment environment,
            StorageProperties storageProperties,
            AuthSecurityProperties authSecurityProperties,
            ConnectionProbeProperties connectionProbeProperties,
            DatawiseQueryProperties queryProperties,
            AiRagProperties ragProperties,
            AiAnalysisProperties analysisProperties,
            AiPythonProperties pythonProperties,
            TaskConcurrencySpringProperties taskConcurrencyProperties,
            @Value("${datawise.connectors.require-manifest-integrity:false}") boolean requireManifestIntegrity
    ) {
        this.environment = environment;
        this.storageProperties = storageProperties;
        this.authSecurityProperties = authSecurityProperties;
        this.connectionProbeProperties = connectionProbeProperties;
        this.queryProperties = queryProperties;
        this.ragProperties = ragProperties;
        this.analysisProperties = analysisProperties;
        this.pythonProperties = pythonProperties;
        this.taskConcurrencyProperties = taskConcurrencyProperties;
        this.requireManifestIntegrity = requireManifestIntegrity;
    }

    public DeploymentProfileDto collect() {
        List<String> profiles = Arrays.stream(environment.getActiveProfiles())
                .map(p -> p == null ? "" : p.trim().toLowerCase(Locale.ROOT))
                .filter(p -> !p.isEmpty())
                .toList();
        String mode = resolveMode(profiles);
        boolean localMode = "dev".equals(mode) || "desktop".equals(mode);

        List<DeploymentCheckDto> checks = new ArrayList<>();
        checks.add(check(
                "storage.backend",
                storageProperties.getBackend(),
                "jdbc",
                storageProperties.isJdbc(),
                localMode,
                "DEPLOYMENT.md#jdbc"
        ));
        checks.add(check(
                "ai.rag.vector-store",
                nullToEmpty(ragProperties.getVectorStore()),
                "pgvector",
                "pgvector".equalsIgnoreCase(ragProperties.getVectorStore()),
                localMode,
                "AI_PRODUCTION.md"
        ));
        checks.add(check(
                "ai.analysis.semantic-check",
                nullToEmpty(analysisProperties.getSemanticCheck()),
                "strict",
                analysisProperties.isSemanticCheckStrict(),
                localMode,
                "AI_PRODUCTION.md"
        ));
        boolean pythonSimulated = "simulated".equalsIgnoreCase(pythonProperties.getExecutor());
        checks.add(check(
                "ai.python.executor",
                nullToEmpty(pythonProperties.getExecutor()),
                "docker",
                !pythonSimulated && (pythonProperties.isDockerExecutor() || pythonProperties.isK8sExecutor()),
                localMode,
                "AI_PRODUCTION.md"
        ));
        checks.add(check(
                "security.auth.require-authentication",
                String.valueOf(authSecurityProperties.isRequireAuthentication()),
                "true",
                authSecurityProperties.isRequireAuthentication(),
                false,
                "DEPLOYMENT.md#auth"
        ));
        checks.add(check(
                "security.connection-probe.allow-private-networks",
                String.valueOf(connectionProbeProperties.isAllowPrivateNetworks()),
                "false (public SaaS) / true (private LAN)",
                !connectionProbeProperties.isAllowPrivateNetworks() || localMode,
                localMode,
                "DEPLOYMENT.md"
        ));
        checks.add(check(
                "connectors.require-manifest-integrity",
                String.valueOf(requireManifestIntegrity),
                "true",
                requireManifestIntegrity,
                localMode,
                "DEPLOYMENT.md"
        ));
        int maxRows = queryProperties.getMaxResultRows();
        checks.add(check(
                "query.max-result-rows",
                String.valueOf(maxRows),
                "10000 (or stricter; not 0)",
                maxRows > 0,
                false,
                "DEPLOYMENT.md"
        ));
        String storeType = taskConcurrencyProperties.getStoreType() != null
                ? taskConcurrencyProperties.getStoreType().name().toLowerCase(Locale.ROOT)
                : "auto";
        boolean storeOk = taskConcurrencyProperties.getStoreType() == TaskConcurrencySpringProperties.StoreType.JDBC
                || (taskConcurrencyProperties.getStoreType() == TaskConcurrencySpringProperties.StoreType.AUTO
                && storageProperties.isJdbc());
        checks.add(check(
                "task-concurrency.store-type",
                storeType,
                "jdbc (or auto + storage.jdbc)",
                storeOk,
                localMode,
                "DEPLOYMENT.md"
        ));

        int ok = 0;
        int warn = 0;
        int info = 0;
        for (DeploymentCheckDto check : checks) {
            switch (check.status()) {
                case "ok" -> ok++;
                case "warn" -> warn++;
                default -> info++;
            }
        }
        return new DeploymentProfileDto(profiles, mode, checks, ok, warn, info, pythonSimulated);
    }

    private static String resolveMode(List<String> profiles) {
        if (profiles.stream().anyMatch(p -> p.equals("desktop"))) {
            return "desktop";
        }
        if (profiles.stream().anyMatch(p -> p.equals("dev"))) {
            return "dev";
        }
        if (profiles.isEmpty()) {
            return "default";
        }
        return "server";
    }

    private static DeploymentCheckDto check(
            String id,
            String current,
            String recommended,
            boolean matchesRecommended,
            boolean localMode,
            String docsHint
    ) {
        String status;
        if (matchesRecommended) {
            status = "ok";
        } else if (localMode) {
            status = "info";
        } else {
            status = "warn";
        }
        return new DeploymentCheckDto(id, current, recommended, status, docsHint);
    }

    private static String nullToEmpty(String value) {
        return value == null || value.isBlank() ? "" : value.trim();
    }
}
