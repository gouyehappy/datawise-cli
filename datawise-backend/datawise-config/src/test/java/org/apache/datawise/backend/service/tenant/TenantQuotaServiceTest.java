package org.apache.datawise.backend.service.tenant;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.apache.datawise.backend.config.TenancyProperties;
import org.apache.datawise.backend.configstore.ConfigDirectoryService;
import org.apache.datawise.backend.configstore.ConnectionStore;
import org.apache.datawise.backend.configstore.FileTenantAiUsageStore;
import org.apache.datawise.backend.domain.TenantAiUsageDto;
import org.apache.datawise.backend.security.UserContext;
import org.apache.datawise.backend.service.outbound.OutboundNotifySupport;
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
import static org.mockito.ArgumentMatchers.anyInt;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;

class TenantQuotaServiceTest {

    @TempDir
    Path tempDir;

    private TenancyProperties properties;
    private TenantQuotaService quotaService;
    private OutboundNotifySupport outboundNotifySupport;

    @BeforeEach
    void setUp() {
        properties = new TenancyProperties();
        properties.setMaxAiCallsPerTenantPerDay(2);
        ConfigDirectoryService configDirectory = new ConfigDirectoryService(tempDir);
        outboundNotifySupport = mock(OutboundNotifySupport.class);
        quotaService = new TenantQuotaService(
                properties,
                mock(ConnectionStore.class),
                new FileTenantAiUsageStore(configDirectory, new ObjectMapper().findAndRegisterModules()),
                outboundNotifySupport
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

    @Test
    void requireAiCallQuota_emitsNearLimitAndExhaustedOnce() {
        properties.setMaxAiCallsPerTenantPerDay(10);
        for (int i = 0; i < 5; i++) {
            assertDoesNotThrow(() -> quotaService.requireAiCallQuota());
        }
        // 5th call leaves remaining=5 → enters near-limit band
        verify(outboundNotifySupport, times(1))
                .aiQuotaNearLimit(eq("default"), eq(5), eq(10), eq(5), eq(1L));
        for (int i = 0; i < 5; i++) {
            assertDoesNotThrow(() -> quotaService.requireAiCallQuota());
        }
        verify(outboundNotifySupport, times(1))
                .aiQuotaExhausted(eq("default"), eq(10), eq(10), eq(1L));
        assertThrows(IllegalArgumentException.class, quotaService::requireAiCallQuota);
        verify(outboundNotifySupport, times(1))
                .aiQuotaExhausted(eq("default"), eq(10), eq(10), eq(1L));
        verify(outboundNotifySupport, times(1))
                .aiQuotaNearLimit(anyString(), anyInt(), anyInt(), anyInt(), anyLong());
    }

    @Test
    void isNearLimit_matchesFrontendBand() {
        assertTrue(TenantQuotaService.isNearLimit(5, 100));
        assertTrue(TenantQuotaService.isNearLimit(10, 100));
        assertFalse(TenantQuotaService.isNearLimit(11, 100));
        assertFalse(TenantQuotaService.isNearLimit(0, 100));
    }
}
