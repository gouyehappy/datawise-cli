package org.apache.datawise.desktop.bridge;

import com.google.gson.Gson;
import com.google.gson.JsonArray;
import com.google.gson.JsonElement;
import com.google.gson.JsonObject;
import com.google.gson.JsonParser;
import org.apache.datawise.desktop.backend.BackendProcessService;
import org.apache.datawise.desktop.deeplink.DeepLinkParser;
import org.apache.datawise.desktop.deeplink.SingleInstanceGuard;
import org.apache.datawise.desktop.prefs.DesktopPreferencesStore;
import org.apache.datawise.desktop.prefs.RendererUiStore;
import org.apache.datawise.desktop.prefs.WindowStateStore;
import org.apache.datawise.desktop.prefs.WorkspacePreferences;
import org.apache.datawise.desktop.process.ProcessRelauncher;
import org.apache.datawise.desktop.updater.DesktopUpdaterService;
import org.apache.datawise.desktop.ui.WindowChromeController;
import org.cef.browser.CefBrowser;
import org.cef.browser.CefFrame;
import org.cef.callback.CefQueryCallback;
import org.cef.handler.CefMessageRouterHandlerAdapter;

import javax.swing.JFileChooser;
import javax.swing.JFrame;
import javax.swing.SwingUtilities;
import java.awt.Desktop;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.List;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicReference;

/**
 * Handles {@code cefQuery} requests that mirror Electron IPC channels from preload.ts.
 */
public final class DesktopBridgeRouter extends CefMessageRouterHandlerAdapter {
    private final Gson gson = new Gson();
    private final JFrame frame;
    private final BackendProcessService backend;
    private final DesktopUpdaterService updater;
    private final SingleInstanceGuard singleInstance;
    private final AtomicReference<CefBrowser> browserRef = new AtomicReference<>();
    private final WindowChromeController chrome;
    private volatile boolean quitting;

    public DesktopBridgeRouter(
            JFrame frame,
            BackendProcessService backend,
            DesktopUpdaterService updater,
            SingleInstanceGuard singleInstance
    ) {
        this.frame = frame;
        this.backend = backend;
        this.updater = updater;
        this.singleInstance = singleInstance;
        this.chrome = new WindowChromeController(frame, maximized ->
                push("datawise:window:maximize-changed", maximized));
        this.backend.addListener(event -> push("datawise:backend:startup-progress", gson.toJsonTree(event).getAsJsonObject()));
        this.updater.addListener(event -> push("datawise:updater:status", event));
    }

    public void bindBrowser(CefBrowser browser) {
        browserRef.set(browser);
    }

    public WindowChromeController chrome() {
        return chrome;
    }

    public void setQuitting(boolean quitting) {
        this.quitting = quitting;
    }

    public boolean isQuitting() {
        return quitting;
    }

    @Override
    public boolean onQuery(
            CefBrowser browser,
            CefFrame frame,
            long queryId,
            String request,
            boolean persistent,
            CefQueryCallback callback
    ) {
        try {
            JsonObject body = JsonParser.parseString(request).getAsJsonObject();
            String channel = body.get("channel").getAsString();
            JsonArray args = body.has("args") && body.get("args").isJsonArray()
                    ? body.getAsJsonArray("args")
                    : new JsonArray();

            // Folder picker must NOT block the CEF thread (modal + latch deadlocks / never returns).
            if ("config:pickDirectory".equals(channel)) {
                pickDirectoryAsync(callback);
                return true;
            }

            Object result = dispatch(channel, args);
            callback.success(gson.toJson(result));
        } catch (Exception e) {
            JsonObject err = new JsonObject();
            err.addProperty("__error", e.getMessage() == null ? e.getClass().getSimpleName() : e.getMessage());
            callback.success(gson.toJson(err));
        }
        return true;
    }

    private Object dispatch(String channel, JsonArray args) throws Exception {
        return switch (channel) {
            case "window:getState" -> chrome.snapshotState();
            case "window:setState" -> {
                if (args.size() > 0 && args.get(0).isJsonObject()) {
                    JsonObject state = args.get(0).getAsJsonObject().deepCopy();
                    chrome.applyState(state);
                    WindowStateStore.write(state);
                    push("datawise:window:state-changed", state);
                }
                yield true;
            }
            case "window:minimize" -> {
                chrome.minimize();
                yield true;
            }
            case "window:toggleMaximize" -> {
                chrome.toggleMaximize();
                yield true;
            }
            case "window:close" -> {
                chrome.close();
                yield true;
            }
            case "window:isMaximized" -> chrome.isMaximized();
            case "window:startDrag" -> chrome.startDrag(argInt(args, 0, 0), argInt(args, 1, 0));
            case "window:dragTo" -> true; // legacy no-op; drag is polled on EDT
            case "window:endDrag" -> {
                chrome.endDrag();
                yield true;
            }
            case "updater:checkForUpdates" -> updater.checkForUpdates();
            case "updater:downloadUpdate" -> updater.downloadUpdate();
            case "updater:quitAndInstall" -> {
                boolean ok = updater.quitAndInstall();
                if (ok) {
                    SwingUtilities.invokeLater(() -> {
                        quitting = true;
                        try {
                            backend.stop();
                        } catch (Exception ignored) {
                        }
                        System.exit(0);
                    });
                }
                yield ok;
            }
            case "updater:setPreferences" -> {
                if (args.size() > 0 && args.get(0).isJsonObject()) {
                    JsonObject prefs = args.get(0).getAsJsonObject();
                    updater.setPreferences(
                            !prefs.has("notifyOnUpdate") || prefs.get("notifyOnUpdate").getAsBoolean(),
                            prefs.has("autoDownload") && prefs.get("autoDownload").getAsBoolean());
                }
                yield true;
            }
            case "updater:getStatus" -> updater.getStatus();
            case "config:getSettings" -> configGetSettings();
            case "config:pickDirectory" -> throw new IllegalStateException("handled async");
            case "config:applyAndRestart" -> {
                String configDir = argString(args, 0);
                applyConfigDir(configDir);
                restartHost();
                yield true;
            }
            case "config:switchWorkspace" -> {
                String path = argString(args, 0);
                applyConfigDir(path);
                restartHost();
                yield true;
            }
            case "config:removeRecentWorkspace" -> {
                String path = argString(args, 0);
                DesktopPreferencesStore.removeRecent(path);
                yield WorkspacePreferences.buildWorkspaceList(
                        backend.resolveRuntimeConfigDir().toString(),
                        backend.resolveDefaultConfigDir().toString());
            }
            case "config:createWorkspace" -> WorkspacePreferences.prepareNewWorkspace(argString(args, 0));
            case "config:resolvePath" -> backend.resolveConfiguredConfigPath(argString(args, 0)).toString();
            case "deep-link:flushPending" -> flushDeepLink();
            case "logs:openRuntime" -> openRuntimeLog();
            case "backend:getStartupState" -> gson.toJsonTree(backend.getStartupState()).getAsJsonObject();
            case "uiStore:persist" -> {
                if (args.size() > 0 && args.get(0).isJsonObject()) {
                    RendererUiStore.write(args.get(0).getAsJsonObject());
                }
                yield true;
            }
            case "uiStore:clearSession" -> {
                RendererUiStore.clearSessionKeys();
                yield true;
            }
            default -> throw new IllegalArgumentException("Unknown bridge channel: " + channel);
        };
    }

    private JsonObject configGetSettings() {
        Path resolved = backend.resolveRuntimeConfigDir();
        Path defaultPath = backend.resolveDefaultConfigDir();
        String configured = DesktopPreferencesStore.configDirOrNull();
        JsonObject out = new JsonObject();
        out.addProperty("configured", configured);
        out.addProperty("resolved", resolved.toString());
        out.addProperty("defaultPath", defaultPath.toString());
        out.addProperty("canChange", true);
        out.add("recentWorkspaces", gson.toJsonTree(
                WorkspacePreferences.buildWorkspaceList(resolved.toString(), defaultPath.toString())));
        return out;
    }

    private void pickDirectoryAsync(CefQueryCallback callback) {
        SwingUtilities.invokeLater(() -> {
            try {
                String os = System.getProperty("os.name", "").toLowerCase();
                String path;
                if (os.contains("mac")) {
                    path = pickDirectoryNative();
                    if (path == null) {
                        path = pickDirectorySwing();
                    }
                } else {
                    // Windows/Linux: directory-mode JFileChooser (async; never block CEF thread).
                    path = pickDirectorySwing();
                }
                callback.success(gson.toJson(path));
            } catch (Exception e) {
                JsonObject err = new JsonObject();
                err.addProperty("__error", e.getMessage() == null ? e.getClass().getSimpleName() : e.getMessage());
                callback.success(gson.toJson(err));
            }
        });
    }

    /** Windows/macOS: java.awt.FileDialog is peer-native and does not freeze CEF as often. */
    private String pickDirectoryNative() {
        try {
            // macOS directory mode; ignored elsewhere
            System.setProperty("apple.awt.fileDialogForDirectories", "true");
            java.awt.FileDialog dialog = new java.awt.FileDialog(frame, "Select DataWise workspace", java.awt.FileDialog.LOAD);
            Path start = Path.of(System.getProperty("user.home"), "Documents");
            if (Files.isDirectory(start)) {
                dialog.setDirectory(start.toString());
            }
            dialog.setVisible(true);
            String dir = dialog.getDirectory();
            String file = dialog.getFile();
            if (dir == null) {
                return null;
            }
            Path chosen = file == null || file.isBlank() ? Path.of(dir) : Path.of(dir, file);
            // On Windows FileDialog selects a file; if user picks inside a folder, use parent if needed.
            if (Files.isDirectory(chosen)) {
                return chosen.toAbsolutePath().normalize().toString();
            }
            if (Files.isRegularFile(chosen) && chosen.getParent() != null) {
                return chosen.getParent().toAbsolutePath().normalize().toString();
            }
            if (Files.isDirectory(Path.of(dir))) {
                return Path.of(dir).toAbsolutePath().normalize().toString();
            }
            return null;
        } catch (Exception e) {
            return null;
        }
    }

    private String pickDirectorySwing() {
        JFileChooser chooser = new JFileChooser();
        chooser.setFileSelectionMode(JFileChooser.DIRECTORIES_ONLY);
        chooser.setDialogTitle("Select DataWise workspace");
        Path start = Path.of(System.getProperty("user.home"), "Documents");
        if (Files.isDirectory(start)) {
            chooser.setCurrentDirectory(start.toFile());
        }
        // Parent null avoids CEF modality deadlocks with undecorated frames.
        int result = chooser.showOpenDialog(null);
        if (result != JFileChooser.APPROVE_OPTION || chooser.getSelectedFile() == null) {
            return null;
        }
        return chooser.getSelectedFile().toPath().toAbsolutePath().normalize().toString();
    }

    private void applyConfigDir(String configDir) {
        JsonObject patch = new JsonObject();
        if (configDir == null || configDir.isBlank()) {
            patch.add("configDir", null);
        } else {
            Path resolved = backend.resolveConfiguredConfigPath(configDir);
            patch.addProperty("configDir", resolved.toString());
            DesktopPreferencesStore.touchRecent(resolved.toString());
        }
        DesktopPreferencesStore.write(patch);
    }

    private void restartHost() {
        SwingUtilities.invokeLater(() -> {
            quitting = true;
            ProcessRelauncher.relaunch(backend);
        });
    }

    private JsonObject flushDeepLink() {
        List<String> pending = singleInstance.drainPending();
        if (pending.isEmpty()) {
            return null;
        }
        return DeepLinkParser.parse(pending.get(0));
    }

    private JsonObject openRuntimeLog() {
        JsonObject out = new JsonObject();
        Path path = backend.runtimeLogPath();
        out.addProperty("path", path.toString());
        if (!Files.isRegularFile(path)) {
            out.addProperty("ok", false);
            out.addProperty("error", "missing");
            return out;
        }
        try {
            if (Desktop.isDesktopSupported()) {
                Desktop.getDesktop().open(path.toFile());
                out.addProperty("ok", true);
            } else {
                out.addProperty("ok", false);
                out.addProperty("error", "open_failed");
            }
        } catch (Exception e) {
            out.addProperty("ok", false);
            out.addProperty("error", "open_failed");
        }
        return out;
    }

    public void pushDeepLink(String url) {
        JsonObject payload = DeepLinkParser.parse(url);
        if (payload != null) {
            // Renderer expects {connectionId, database, sql}
            JsonObject slim = new JsonObject();
            if (payload.has("connectionId")) {
                slim.add("connectionId", payload.get("connectionId"));
            }
            if (payload.has("database")) {
                slim.add("database", payload.get("database"));
            }
            if (payload.has("sql")) {
                slim.add("sql", payload.get("sql"));
            }
            push("datawise:deep-link:open", slim);
        }
    }

    public void push(String eventName, Object detail) {
        CefBrowser browser = browserRef.get();
        if (browser == null) {
            return;
        }
        String json = detail instanceof JsonElement el ? gson.toJson(el) : gson.toJson(detail);
        String script = "window.dispatchEvent(new CustomEvent("
                + jsonString(eventName) + ",{detail:" + json + "}));";
        browser.executeJavaScript(script, browser.getURL(), 0);
    }

    private static String jsonString(String value) {
        return "\"" + value.replace("\\", "\\\\").replace("\"", "\\\"") + "\"";
    }

    private static String argString(JsonArray args, int index) {
        if (args.size() <= index || args.get(index).isJsonNull()) {
            return null;
        }
        return args.get(index).getAsString();
    }

    private static int argInt(JsonArray args, int index, int fallback) {
        if (args.size() <= index || args.get(index).isJsonNull()) {
            return fallback;
        }
        try {
            return args.get(index).getAsInt();
        } catch (Exception e) {
            return fallback;
        }
    }

    private <T> T runOnEdt(EdtCallable<T> callable) throws Exception {
        if (SwingUtilities.isEventDispatchThread()) {
            return callable.call();
        }
        AtomicReference<T> result = new AtomicReference<>();
        AtomicReference<Exception> error = new AtomicReference<>();
        CountDownLatch latch = new CountDownLatch(1);
        SwingUtilities.invokeLater(() -> {
            try {
                result.set(callable.call());
            } catch (Exception e) {
                error.set(e);
            } finally {
                latch.countDown();
            }
        });
        if (!latch.await(15, TimeUnit.SECONDS)) {
            throw new IllegalStateException("EDT call timed out");
        }
        if (error.get() != null) {
            throw error.get();
        }
        return result.get();
    }

    @FunctionalInterface
    private interface EdtCallable<T> {
        T call() throws Exception;
    }
}
