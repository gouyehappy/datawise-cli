package org.apache.datawise.desktop;

import org.apache.datawise.desktop.backend.BackendProcessService;
import org.apache.datawise.desktop.bridge.DesktopBridgeScript;
import org.apache.datawise.desktop.deeplink.SingleInstanceGuard;
import org.apache.datawise.desktop.protocol.WindowsProtocolRegistrar;
import org.apache.datawise.desktop.staticserver.RendererStaticServer;
import org.apache.datawise.desktop.tray.SystemTrayService;
import org.apache.datawise.desktop.ui.DesktopMainFrame;
import org.apache.datawise.desktop.updater.DesktopUpdaterService;

import javax.swing.SwingUtilities;
import javax.swing.UIManager;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.Locale;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicReference;

/**
 * DataWise desktop host entry (JCEF). Replaces the Electron main process.
 *
 * <p>Dev (default): loads Vite at {@code http://127.0.0.1:28413}, spawns backend on
 * {@link DesktopRuntimePorts#devBackend()} when needed.
 *
 * <p>Packaged: set {@code -Ddatawise.packaged=true}, serves {@code frontend-dist/} via local HTTP,
 * backend on {@link DesktopRuntimePorts#desktopBackend()}.
 */
public final class DatawiseDesktopApp {
    private DatawiseDesktopApp() {
    }

    public static void main(String[] args) throws Exception {
        SingleInstanceGuard guard = new SingleInstanceGuard();
        if (!guard.tryAcquire()) {
            SingleInstanceGuard.notifyRunningInstance(args);
            System.err.println("[datawise-desktop] another instance is running; forwarded deep links if any");
            return;
        }
        for (String arg : args) {
            if (arg != null && arg.startsWith("datawise://")) {
                guard.enqueueDeepLink(arg);
            }
        }
        guard.startInboxPoller();

        boolean packaged = resolvePackaged();
        String platform = resolvePlatform();
        BackendProcessService backend = new BackendProcessService(packaged);
        DesktopUpdaterService updater = new DesktopUpdaterService();

        String apiBaseUrl = System.getenv("DATAWISE_API_BASE_URL");
        if (apiBaseUrl == null || apiBaseUrl.isBlank()) {
            apiBaseUrl = backend.getApiBaseUrl();
        }
        // Build once — reused by static HTML inject and CEF load handlers.
        String bridgeScript = DesktopBridgeScript.build(
                platform, apiBaseUrl, DesktopUpdaterService.CURRENT_VERSION, packaged);

        String rendererUrl = resolveRendererUrl(packaged);
        RendererStaticServer staticServer = null;
        if (rendererUrl == null) {
            Path dist = DesktopPaths.frontendDistRoot();
            staticServer = new RendererStaticServer(dist);
            staticServer.setBridgeScript(bridgeScript);
            rendererUrl = staticServer.start(DesktopRuntimePorts.desktopFrontend());
            System.out.println("[datawise-desktop] serving frontend from " + dist + " → " + rendererUrl);
        } else {
            System.out.println("[datawise-desktop] loading renderer " + rendererUrl);
        }
        System.out.println("[datawise-desktop] apiBaseUrl=" + apiBaseUrl + " packaged=" + packaged);

        try {
            WindowsProtocolRegistrar.registerIfWindows(DesktopPaths.resolveWindowsLauncher());
        } catch (Exception e) {
            System.err.println("[datawise-desktop] protocol register skipped: " + e.getMessage());
        }

        try {
            WindowsAppBranding.applyIfWindows(DesktopPaths.installRoot(), DesktopPaths.resolveWindowsLauncher());
        } catch (Exception e) {
            System.err.println("[datawise-desktop] branding skipped: " + e.getMessage());
        }

        UIManager.setLookAndFeel(UIManager.getSystemLookAndFeelClassName());
        DesktopAppIcons.appIconSizes();

        backend.startInBackground();

        RendererStaticServer staticServerFinal = staticServer;
        String rendererUrlFinal = rendererUrl;
        String bridgeScriptFinal = bridgeScript;

        CountDownLatch frameReady = new CountDownLatch(1);
        AtomicReference<Exception> frameError = new AtomicReference<>();

        SwingUtilities.invokeLater(() -> {
            try {
                SystemTrayService[] trayHolder = new SystemTrayService[1];
                DesktopMainFrame frame = new DesktopMainFrame(
                        rendererUrlFinal,
                        platform,
                        bridgeScriptFinal,
                        backend,
                        updater,
                        guard,
                        () -> trayHolder[0] != null && trayHolder[0].handleWindowClosing()
                );
                trayHolder[0] = new SystemTrayService(
                        frame,
                        () -> frame.bridge().isQuitting(),
                        frame::shutdown);
                trayHolder[0].install();
                guard.setSecondInstanceHandler(urls -> SwingUtilities.invokeLater(() -> {
                    trayHolder[0].showMain();
                    for (String url : urls) {
                        frame.bridge().pushDeepLink(url);
                    }
                }));
                frame.showMainWindow();
            } catch (Exception e) {
                frameError.set(e);
            } finally {
                frameReady.countDown();
            }
        });

        if (!frameReady.await(180, TimeUnit.SECONDS)) {
            throw new IllegalStateException("Main window initialization timed out");
        }
        if (frameError.get() != null) {
            throw frameError.get();
        }

        Runtime.getRuntime().addShutdownHook(new Thread(() -> {
            try {
                backend.stop();
            } catch (Exception ignored) {
            }
            if (staticServerFinal != null) {
                staticServerFinal.close();
            }
            guard.close();
        }, "datawise-desktop-shutdown"));
    }

    private static boolean resolvePackaged() {
        if (Boolean.parseBoolean(System.getProperty("datawise.packaged", "false"))) {
            return true;
        }
        String env = System.getenv("DATAWISE_PACKAGED");
        if (env != null && (env.equalsIgnoreCase("1") || env.equalsIgnoreCase("true"))) {
            return true;
        }
        Path install = DesktopPaths.installRoot();
        return Files.isDirectory(install.resolve("backend"))
                || Files.isDirectory(install.resolve("resources").resolve("backend"));
    }

    private static String resolveRendererUrl(boolean packaged) {
        String override = System.getenv("DATAWISE_RENDERER_URL");
        if (override != null && !override.isBlank()) {
            return override.trim();
        }
        if (!packaged) {
            return "http://127.0.0.1:" + DesktopRuntimePorts.devFrontend() + "/";
        }
        return null;
    }

    private static String resolvePlatform() {
        String os = System.getProperty("os.name", "").toLowerCase(Locale.ROOT);
        if (os.contains("win")) {
            return "win32";
        }
        if (os.contains("mac")) {
            return "darwin";
        }
        return "linux";
    }
}
