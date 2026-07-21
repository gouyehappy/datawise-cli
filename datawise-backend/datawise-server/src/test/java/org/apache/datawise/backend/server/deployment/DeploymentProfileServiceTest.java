package org.apache.datawise.backend.server.deployment;

import org.apache.datawise.backend.ai.config.AiAnalysisProperties;
import org.apache.datawise.backend.ai.config.AiPythonProperties;
import org.apache.datawise.backend.ai.config.AiRagProperties;
import org.apache.datawise.backend.config.AuthSecurityProperties;
import org.apache.datawise.backend.config.ConnectionProbeProperties;
import org.apache.datawise.backend.config.DatawiseQueryProperties;
import org.apache.datawise.backend.config.StorageProperties;
import org.apache.datawise.backend.domain.DeploymentProfileDto;
import org.apache.datawise.taskconcurrency.spring.TaskConcurrencySpringProperties;
import org.junit.jupiter.api.Test;
import org.springframework.core.env.Environment;
import org.springframework.mock.env.MockEnvironment;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

class DeploymentProfileServiceTest {

    @Test
    void marksDesktopDefaultsAsInfoNotWarn() {
        MockEnvironment env = new MockEnvironment();
        env.setActiveProfiles("desktop");
        DeploymentProfileDto profile = service(env).collect();

        assertEquals("desktop", profile.mode());
        assertTrue(profile.pythonSimulated());
        assertTrue(profile.checks().stream().anyMatch(c ->
                "ai.python.executor".equals(c.id()) && "info".equals(c.status())));
        assertEquals(0, profile.warnCount());
    }

    @Test
    void marksServerGapsAsWarn() {
        StorageProperties storage = new StorageProperties();
        storage.setBackend("file");
        AiPythonProperties python = new AiPythonProperties();
        python.setExecutor("simulated");
        AiRagProperties rag = new AiRagProperties();
        rag.setVectorStore("none");
        AiAnalysisProperties analysis = new AiAnalysisProperties();
        analysis.setSemanticCheck("lenient");

        DeploymentProfileDto profile = new DeploymentProfileService(
                new MockEnvironment(),
                storage,
                new AuthSecurityProperties(),
                new ConnectionProbeProperties(),
                new DatawiseQueryProperties(),
                rag,
                analysis,
                python,
                new TaskConcurrencySpringProperties(),
                false
        ).collect();

        assertEquals("default", profile.mode());
        assertTrue(profile.warnCount() >= 3);
        assertTrue(profile.checks().stream().anyMatch(c ->
                "storage.backend".equals(c.id()) && "warn".equals(c.status())));
    }

    private static DeploymentProfileService service(Environment environment) {
        return new DeploymentProfileService(
                environment,
                new StorageProperties(),
                new AuthSecurityProperties(),
                new ConnectionProbeProperties(),
                new DatawiseQueryProperties(),
                new AiRagProperties(),
                new AiAnalysisProperties(),
                new AiPythonProperties(),
                new TaskConcurrencySpringProperties(),
                false
        );
    }
}
