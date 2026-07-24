package org.apache.datawise.desktop.ui;

import com.google.gson.JsonObject;
import me.friwi.jcefmaven.CefAppBuilder;
import me.friwi.jcefmaven.CefInitializationException;
import me.friwi.jcefmaven.MavenCefAppHandlerAdapter;
import me.friwi.jcefmaven.UnsupportedPlatformException;
import org.apache.datawise.desktop.DesktopAppIcons;
import org.apache.datawise.desktop.DesktopPaths;
import org.apache.datawise.desktop.backend.BackendProcessService;
import org.apache.datawise.desktop.bridge.DesktopBridgeRouter;
import org.apache.datawise.desktop.cef.CefRuntimeConfig;
import org.apache.datawise.desktop.deeplink.SingleInstanceGuard;
import org.apache.datawise.desktop.prefs.WindowStateStore;
import org.apache.datawise.desktop.updater.DesktopUpdaterService;
import org.cef.CefApp;
import org.cef.CefClient;
import org.cef.browser.CefBrowser;
import org.cef.browser.CefFrame;
import org.cef.browser.CefMessageRouter;
import org.cef.handler.CefLoadHandler;
import org.cef.handler.CefLoadHandlerAdapter;
import org.cef.network.CefRequest;

import javax.swing.JComponent;
import javax.swing.JFrame;
import javax.swing.SwingUtilities;
import javax.swing.Timer;
import javax.swing.WindowConstants;
import java.awt.Dimension;
import java.awt.Rectangle;
import java.awt.event.ComponentAdapter;
import java.awt.event.ComponentEvent;
import java.awt.event.WindowAdapter;
import java.awt.event.WindowEvent;
import java.io.IOException;
import java.util.function.BooleanSupplier;

/**
 * Main JCEF window hosting the Vue renderer.
 */
public final class DesktopMainFrame extends JFrame {
    private final CefApp cefApp;
    private final CefClient client;
    private final CefBrowser browser;
    private final DesktopBridgeRouter bridge;
    private final BackendProcessService backend;
    private final String bridgeScript;
    private final BooleanSupplier closeToTray;
    private final boolean frameless;
    private Timer persistTimer;

    public DesktopMainFrame(
            String startUrl,
            String platform,
            String bridgeScript,
            BackendProcessService backend,
            DesktopUpdaterService updater,
            SingleInstanceGuard singleInstance,
            BooleanSupplier closeToTray
    ) throws UnsupportedPlatformException, CefInitializationException, IOException, InterruptedException {
        super("DataWise CLI");
        this.backend = backend;
        this.closeToTray = closeToTray;
        this.frameless = !"darwin".equals(platform);
        this.bridgeScript = bridgeScript;

        if (frameless) {
            setUndecorated(true);
        }
        DesktopAppIcons.applyToWindow(this);

        CefAppBuilder builder = new CefAppBuilder();
        builder.setInstallDir(DesktopPaths.jcefBundleDir().toFile());
        CefRuntimeConfig.apply(builder);
        builder.setAppHandler(new MavenCefAppHandlerAdapter() {
            @Override
            public void stateHasChanged(CefApp.CefAppState state) {
                if (state == CefApp.CefAppState.TERMINATED) {
                    System.exit(0);
                }
            }
        });
        this.cefApp = builder.build();
        this.client = cefApp.createClient();

        this.bridge = new DesktopBridgeRouter(this, backend, updater, singleInstance);
        CefMessageRouter messageRouter = CefMessageRouter.create();
        messageRouter.addHandler(bridge, true);
        client.addMessageRouter(messageRouter);

        client.addLoadHandler(new CefLoadHandlerAdapter() {
            @Override
            public void onLoadStart(CefBrowser browser, CefFrame frame, CefRequest.TransitionType transitionType) {
                if (frame != null && frame.isMain()) {
                    browser.executeJavaScript(bridgeScript, frame.getURL(), 0);
                }
            }

            @Override
            public void onLoadEnd(CefBrowser browser, CefFrame frame, int httpStatusCode) {
                if (frame != null && frame.isMain()) {
                    browser.executeJavaScript(bridgeScript, frame.getURL(), 0);
                }
            }

            @Override
            public void onLoadError(
                    CefBrowser browser,
                    CefFrame frame,
                    CefLoadHandler.ErrorCode errorCode,
                    String errorText,
                    String failedUrl
            ) {
                if (frame == null || !frame.isMain()) {
                    return;
                }
                System.err.println("[datawise-desktop] CEF load error "
                        + errorCode + " url=" + failedUrl + " " + errorText);
            }
        });

        this.browser = client.createBrowser(startUrl, false, false);
        bridge.bindBrowser(browser);

        setDefaultCloseOperation(WindowConstants.DO_NOTHING_ON_CLOSE);
        setMinimumSize(new Dimension(1100, 680));
        JComponent ui = (JComponent) browser.getUIComponent();
        if (frameless) {
            FramelessResizeSupport.install(this, ui, browser);
        } else {
            setLayout(new java.awt.BorderLayout());
            add(ui, java.awt.BorderLayout.CENTER);
        }

        applySavedBounds();
        bindPersistHooks();

        addWindowListener(new WindowAdapter() {
            @Override
            public void windowClosing(WindowEvent e) {
                persistWindowStateNow();
                if (closeToTray.getAsBoolean()) {
                    return;
                }
                shutdown();
            }

            @Override
            public void windowOpened(WindowEvent e) {
                FramelessResizeSupport.notifyBrowserResized(browser, DesktopMainFrame.this);
            }
        });
    }

    public DesktopBridgeRouter bridge() {
        return bridge;
    }

    private void applySavedBounds() {
        JsonObject state = WindowStateStore.read();
        int width = Math.max(800, WindowStateStore.intOr(state, "width", 1440));
        int height = Math.max(600, WindowStateStore.intOr(state, "height", 900));
        int x = WindowStateStore.intOr(state, "x", Integer.MIN_VALUE);
        int y = WindowStateStore.intOr(state, "y", Integer.MIN_VALUE);
        boolean maximized = WindowStateStore.boolOr(state, "maximized", false)
                || WindowStateStore.boolOr(state, "isMaximized", false);
        if (x != Integer.MIN_VALUE && y != Integer.MIN_VALUE) {
            setBounds(x, y, width, height);
        } else {
            setSize(width, height);
            setLocationRelativeTo(null);
        }
        if (maximized) {
            Rectangle normal = getBounds();
            Rectangle work = WindowChromeController.workArea(this);
            setBounds(work);
            bridge.chrome().markMaximized(true, normal);
        }
    }

    /** Open the main window immediately (in-app AppSplash covers boot). */
    public void showMainWindow() {
        getContentPane().setBackground(new java.awt.Color(0xF8, 0xFA, 0xFC));
        setBackground(new java.awt.Color(0xF8, 0xFA, 0xFC));
        setVisible(true);
        toFront();
        requestFocus();
        SwingUtilities.invokeLater(() -> {
            FramelessResizeSupport.notifyBrowserResized(browser, this);
            String url = browser.getURL();
            System.out.println("[datawise-desktop] show url=" + url);
            if (url == null || url.isBlank() || "about:blank".equalsIgnoreCase(url)) {
                browser.reload();
            }
        });
    }

    private void bindPersistHooks() {
        ComponentAdapter adapter = new ComponentAdapter() {
            @Override
            public void componentResized(ComponentEvent e) {
                schedulePersist();
            }

            @Override
            public void componentMoved(ComponentEvent e) {
                schedulePersist();
            }
        };
        addComponentListener(adapter);
    }

    private void schedulePersist() {
        if (persistTimer != null) {
            persistTimer.stop();
        }
        persistTimer = new Timer(400, e -> persistWindowStateNow());
        persistTimer.setRepeats(false);
        persistTimer.start();
    }

    private void persistWindowStateNow() {
        JsonObject state = bridge.chrome().snapshotState();
        WindowStateStore.write(state);
        bridge.push("datawise:window:state-changed", state);
    }

    public void shutdown() {
        if (bridge.isQuitting()) {
            return;
        }
        bridge.setQuitting(true);
        Runnable hideUi = () -> {
            try {
                setVisible(false);
            } catch (Exception ignored) {
            }
            Timer hardExit = new Timer(700, e -> System.exit(0));
            hardExit.setRepeats(false);
            hardExit.start();
        };
        if (SwingUtilities.isEventDispatchThread()) {
            hideUi.run();
        } else {
            SwingUtilities.invokeLater(hideUi);
        }
        Thread cleanup = new Thread(() -> {
            try {
                persistWindowStateNow();
            } catch (Exception ignored) {
            }
            try {
                backend.stopQuick();
            } catch (Exception ignored) {
            }
            try {
                System.exit(0);
            } catch (Exception ignored) {
            }
        }, "datawise-desktop-quit");
        cleanup.setDaemon(true);
        cleanup.start();
    }
}
