package org.apache.datawise.backend.service.tenant;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.apache.datawise.backend.config.TenancyProperties;
import org.apache.datawise.backend.configstore.ConfigDirectoryService;
import org.apache.datawise.backend.configstore.ConnectionStore;
import org.apache.datawise.backend.configstore.FileTenantAiUsageStore;
import org.apache.datawise.backend.domain.TenantAiUsageDto;
import org.apache.datawise.backend.security.UserContext;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;

import java.nio.file.Path;

import static org.junit.jupiter.api.Assertions.assertDoesNotThrow;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.Mockito.mock;

class TenantQuotaServiceTest {

    @TempDir
    Path tempDir;

    private TenancyProperties properties;
    private TenantQuotaService quotaService;

    @BeforeEach
    void setUp() {
        properties = new TenancyProperties();
        properties.setMaxAiCallsPerTenantPerDay(2);
        ConfigDirectoryService configDirectory = new ConfigDirectoryService(tempDir);
        quotaService = new TenantQuotaService(
                properties,
                mock(ConnectionStore.class),
                new FileTenantAiUsageStore(configDirectory, new ObjectMapper().findAndRegisterModules())
        );
        UserContext.set(1L, false, "session-1", "default");
    }

    @AfterEach
    void tearDown() {
        UserContext.clear();
    }

    @Test
    void requireAiCallQuota_enforcesDailyCap() {
        assertDoesNotThrow(() -> quotaService.requireAiCallQuota());
        assertDoesNotThrow(() -> quotaService.requireAiCallQuota());
        IllegalArgumentException ex = assertThrows(IllegalArgumentException.class, quotaService::requireAiCallQuota);
        assertEquals("TENANT_AI_QUOTA_EXCEEDED", ex.getMessage());
    }

    @Test
    void requireAiCallQuota_noopWhenUnlimited() {
        properties.setMaxAiCallsPerTenantPerDay(0);
        assertDoesNotThrow(() -> quotaService.requireAiCallQuota());
        assertDoesNotThrow(() -> quotaService.requireAiCallQuota());
        assertDoesNotThrow(() -> quotaService.requireAiCallQuota());
    }

    @Test
    void currentAiUsage_reportsCallsAndRemaining() {
        assertDoesNotThrow(() -> quotaService.requireAiCallQuota());
        TenantAiUsageDto usage = quotaService.currentAiUsage();
        assertEquals("default", usage.tenantId());
        assertEquals(1, usage.calls());
        assertEquals(2, usage.limit());
        assertEquals(1, usage.remaining());
        assertFalse(usage.unlimited());
    }

    @Test
    void currentAiUsage_unlimitedWhenLimitZero() {
        properties.setMaxAiCallsPerTenantPerDay(0);
        TenantAiUsageDto usage = quotaService.currentAiUsage();
        assertEquals(0, usage.calls());
        assertEquals(0, usage.limit());
        assertTrue(usage.unlimited());
        assertEquals(Integer.MAX_VALUE, usage.remaining());
    }
}
