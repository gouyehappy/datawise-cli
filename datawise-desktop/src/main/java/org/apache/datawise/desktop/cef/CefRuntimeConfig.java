package org.apache.datawise.desktop.cef;

import me.friwi.jcefmaven.CefAppBuilder;
import org.apache.datawise.desktop.DesktopPaths;
import org.cef.CefSettings;

/**
 * Tunes CEF/Chromium so embedded desktop does not phone home or enable unused GPU/ML stacks.
 * The console noise (GCM, SSL to Google, Dawn/dxil, on_device_model) is Chromium internals —
 * not DataWise business traffic.
 */
public final class CefRuntimeConfig {
    private CefRuntimeConfig() {
    }

    public static void apply(CefAppBuilder builder) {
        try {
            java.nio.file.Files.createDirectories(DesktopPaths.userDataDir().resolve("logs"));
            java.nio.file.Files.createDirectories(DesktopPaths.userDataDir().resolve("cef-cache"));
        } catch (Exception ignored) {
        }

        CefSettings settings = builder.getCefSettings();
        settings.windowless_rendering_enabled = false;
        settings.persist_session_cookies = true;
        settings.cache_path = DesktopPaths.userDataDir().resolve("cef-cache").toString();
        settings.root_cache_path = DesktopPaths.userDataDir().resolve("cef-cache").toString();
        settings.log_severity = CefSettings.LogSeverity.LOGSEVERITY_ERROR;
        settings.log_file = DesktopPaths.userDataDir().resolve("logs").resolve("cef.log").toString();
        settings.user_agent_product = "DataWiseCLI/4.0.1";

        // Suppress Chromium cloud / push / update / ML / WebGPU side channels.
        builder.addJcefArgs(
                "--disable-background-networking",
                "--disable-background-timer-throttling",
                "--disable-backgrounding-occluded-windows",
                "--disable-breakpad",
                "--disable-client-side-phishing-detection",
                "--disable-component-update",
                "--disable-default-apps",
                "--disable-domain-reliability",
                "--disable-features="
                        + "AutofillServerCommunication,"
                        + "CalculateNativeWinOcclusion,"
                        + "InterestFeedContentSuggestions,"
                        + "MediaRouter,"
                        + "OptimizationHints,"
                        + "TranslateUI,"
                        + "WebGPU,"
                        + "Vulkan,"
                        + "OnDeviceModel,"
                        + "OnDeviceModelValidation,"
                        + "CrashReporting",
                "--disable-ipc-flooding-protection",
                "--disable-notifications",
                "--disable-renderer-backgrounding",
                "--disable-sync",
                "--disable-web-resources",
                "--metrics-recording-only",
                "--no-first-run",
                "--no-default-browser-check",
                "--no-pings",
                "--password-store=basic",
                "--use-mock-keychain"
        );

        // Optional escape hatch: DATAWISE_CEF_DISABLE_GPU=1 when GPU adapters misbehave.
        String disableGpu = System.getenv("DATAWISE_CEF_DISABLE_GPU");
        if (disableGpu != null && (disableGpu.equals("1") || disableGpu.equalsIgnoreCase("true"))) {
            builder.addJcefArgs("--disable-gpu", "--disable-gpu-compositing");
        }
    }
}
