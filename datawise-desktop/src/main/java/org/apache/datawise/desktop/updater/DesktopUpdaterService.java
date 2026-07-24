package org.apache.datawise.desktop.updater;

import com.google.gson.JsonArray;
import com.google.gson.JsonElement;
import com.google.gson.JsonObject;
import com.google.gson.JsonParser;
import org.apache.datawise.desktop.DesktopPaths;

import java.awt.Desktop;
import java.io.InputStream;
import java.io.InputStreamReader;
import java.net.HttpURLConnection;
import java.net.URI;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.StandardCopyOption;
import java.util.List;
import java.util.Locale;
import java.util.concurrent.CopyOnWriteArrayList;
import java.util.concurrent.atomic.AtomicReference;
import java.util.function.Consumer;

/**
 * Desktop updater aligned with Electron about-panel flow:
 * check GitHub Releases → download installer asset → quitAndInstall opens/runs it.
 */
public final class DesktopUpdaterService {
    public static final String CURRENT_VERSION = "4.0.1";
    private static final String RELEASES_API =
            "https://api.github.com/repos/gouyehappy/datawise-cli/releases/latest";
    private static final String RELEASES_PAGE =
            "https://github.com/gouyehappy/datawise-cli/releases/latest";

    private final AtomicReference<JsonObject> lastStatus = new AtomicReference<>(baseStatus(false, false, null));
    private final AtomicReference<JsonObject> latestRelease = new AtomicReference<>();
    private final AtomicReference<Path> downloadedInstaller = new AtomicReference<>();
    private final List<Consumer<JsonObject>> listeners = new CopyOnWriteArrayList<>();
    private volatile boolean notifyOnUpdate = true;
    private volatile boolean autoDownload = false;

    public void addListener(Consumer<JsonObject> listener) {
        listeners.add(listener);
    }

    public JsonObject getStatus() {
        return lastStatus.get().deepCopy();
    }

    public void setPreferences(boolean notifyOnUpdate, boolean autoDownload) {
        this.notifyOnUpdate = notifyOnUpdate;
        this.autoDownload = autoDownload;
    }

    public JsonObject checkForUpdates() {
        try {
            HttpURLConnection conn = (HttpURLConnection) URI.create(RELEASES_API).toURL().openConnection();
            conn.setRequestProperty("Accept", "application/vnd.github+json");
            conn.setRequestProperty("User-Agent", "DataWiseCLI/" + CURRENT_VERSION);
            conn.setConnectTimeout(10_000);
            conn.setReadTimeout(15_000);
            int code = conn.getResponseCode();
            if (code < 200 || code >= 300) {
                return publishError("GitHub Releases returned HTTP " + code);
            }
            JsonObject release = JsonParser.parseReader(
                    new InputStreamReader(conn.getInputStream(), StandardCharsets.UTF_8)).getAsJsonObject();
            latestRelease.set(release);
            String tag = release.has("tag_name") ? release.get("tag_name").getAsString() : CURRENT_VERSION;
            String latest = tag.startsWith("v") ? tag.substring(1) : tag;
            boolean hasUpdate = compareSemver(latest, CURRENT_VERSION) > 0;
            JsonObject status = baseStatus(hasUpdate, false, null);
            status.addProperty("latestVersion", latest);
            status.addProperty("downloadReady", downloadedInstaller.get() != null);
            status.addProperty("downloading", false);
            lastStatus.set(status);
            emitPhase(hasUpdate ? "available" : "not-available", latest, null, null);
            if (hasUpdate && autoDownload) {
                return downloadUpdate();
            }
            return status.deepCopy();
        } catch (Exception e) {
            return publishError(e.getMessage());
        }
    }

    public JsonObject downloadUpdate() {
        JsonObject release = latestRelease.get();
        if (release == null) {
            checkForUpdates();
            release = latestRelease.get();
        }
        if (release == null) {
            return publishError("No release metadata; check for updates first");
        }
        String latest = lastStatus.get().has("latestVersion")
                ? lastStatus.get().get("latestVersion").getAsString()
                : CURRENT_VERSION;
        Asset asset = pickPlatformAsset(release);
        if (asset == null) {
            // Fall back to opening the release page when no installer asset exists yet.
            emitPhase("downloaded", latest, 100.0, null);
            openBrowser(RELEASES_PAGE);
            JsonObject status = lastStatus.get().deepCopy();
            status.addProperty("downloadReady", true);
            status.addProperty("downloading", false);
            status.addProperty("hasUpdate", true);
            lastStatus.set(status);
            return status.deepCopy();
        }

        JsonObject downloading = lastStatus.get().deepCopy();
        downloading.addProperty("downloading", true);
        downloading.addProperty("hasUpdate", true);
        lastStatus.set(downloading);
        emitPhase("downloading", latest, 0.0, null);

        try {
            Path dir = DesktopPaths.userDataDir().resolve("updates");
            Files.createDirectories(dir);
            Path target = dir.resolve(asset.name());
            downloadFile(asset.url(), target, latest);
            downloadedInstaller.set(target);
            JsonObject status = baseStatus(true, false, null);
            status.addProperty("latestVersion", latest);
            status.addProperty("downloadReady", true);
            status.addProperty("downloading", false);
            status.addProperty("installerPath", target.toString());
            lastStatus.set(status);
            emitPhase("downloaded", latest, 100.0, null);
            return status.deepCopy();
        } catch (Exception e) {
            return publishError("Download failed: " + e.getMessage());
        }
    }

    public boolean quitAndInstall() {
        Path installer = downloadedInstaller.get();
        try {
            if (installer != null && Files.isRegularFile(installer)) {
                String name = installer.getFileName().toString().toLowerCase(Locale.ROOT);
                if (name.endsWith(".zip")) {
                    openExplorer(installer.getParent());
                    return true;
                }
                new ProcessBuilder(installer.toAbsolutePath().toString()).start();
                return true;
            }
            openBrowser(RELEASES_PAGE);
            return true;
        } catch (Exception e) {
            return false;
        }
    }

    private static void openExplorer(Path dir) {
        try {
            if (dir == null) return;
            if (System.getProperty("os.name", "").toLowerCase(Locale.ROOT).contains("win")) {
                new ProcessBuilder("explorer.exe", dir.toAbsolutePath().toString()).start();
            } else if (Desktop.isDesktopSupported()) {
                Desktop.getDesktop().open(dir.toFile());
            }
        } catch (Exception ignored) {
        }
    }

    private void downloadFile(String url, Path target, String latest) throws Exception {
        HttpURLConnection conn = (HttpURLConnection) URI.create(url).toURL().openConnection();
        conn.setInstanceFollowRedirects(true);
        conn.setRequestProperty("User-Agent", "DataWiseCLI/" + CURRENT_VERSION);
        conn.setConnectTimeout(15_000);
        conn.setReadTimeout(120_000);
        long total = conn.getContentLengthLong();
        try (InputStream in = conn.getInputStream()) {
            byte[] buf = new byte[64 * 1024];
            long read = 0;
            Path tmp = target.resolveSibling(target.getFileName() + ".part");
            try (var out = Files.newOutputStream(tmp)) {
                int n;
                while ((n = in.read(buf)) >= 0) {
                    out.write(buf, 0, n);
                    read += n;
                    if (total > 0) {
                        double pct = Math.min(99.0, (read * 100.0) / total);
                        emitPhase("downloading", latest, pct, null);
                    }
                }
            }
            Files.move(tmp, target, StandardCopyOption.REPLACE_EXISTING);
        }
    }

    private static Asset pickPlatformAsset(JsonObject release) {
        if (!release.has("assets") || !release.get("assets").isJsonArray()) {
            return null;
        }
        String osToken = platformZipToken();
        JsonArray assets = release.getAsJsonArray("assets");
        Asset fallback = null;
        for (JsonElement el : assets) {
            if (!el.isJsonObject()) continue;
            JsonObject obj = el.getAsJsonObject();
            if (!obj.has("name") || !obj.has("browser_download_url")) continue;
            String name = obj.get("name").getAsString();
            String url = obj.get("browser_download_url").getAsString();
            String lower = name.toLowerCase(Locale.ROOT);
            if (lower.endsWith(".zip") && lower.contains(osToken)) {
                return new Asset(name, url);
            }
            if ("windows".equals(osToken) && (lower.endsWith(".exe") || lower.endsWith(".msi"))) {
                Asset asset = new Asset(name, url);
                if (lower.contains("setup") || lower.contains("installer")) {
                    return asset;
                }
                fallback = asset;
            }
        }
        return fallback;
    }

    private static String platformZipToken() {
        String os = System.getProperty("os.name", "").toLowerCase(Locale.ROOT);
        if (os.contains("win")) {
            return "windows";
        }
        if (os.contains("mac")) {
            return "macos";
        }
        return "linux";
    }

    private static void openBrowser(String url) {
        try {
            if (Desktop.isDesktopSupported()) {
                Desktop.getDesktop().browse(URI.create(url));
            }
        } catch (Exception ignored) {
        }
    }

    private JsonObject publishError(String message) {
        JsonObject status = baseStatus(false, false, message);
        lastStatus.set(status);
        emitPhase("error", CURRENT_VERSION, null, message);
        return status.deepCopy();
    }

    private void emitPhase(String phase, String latest, Double percent, String error) {
        JsonObject event = new JsonObject();
        event.addProperty("phase", phase);
        event.addProperty("currentVersion", CURRENT_VERSION);
        event.addProperty("latestVersion", latest == null ? CURRENT_VERSION : latest);
        if (percent != null) {
            event.addProperty("percent", percent);
        }
        if (error != null) {
            event.addProperty("error", error);
        }
        for (Consumer<JsonObject> listener : listeners) {
            try {
                listener.accept(event);
            } catch (Exception ignored) {
            }
        }
    }

    private static JsonObject baseStatus(boolean hasUpdate, boolean downloading, String error) {
        JsonObject status = new JsonObject();
        status.addProperty("currentVersion", CURRENT_VERSION);
        status.addProperty("latestVersion", CURRENT_VERSION);
        status.addProperty("hasUpdate", hasUpdate);
        status.addProperty("downloadReady", false);
        status.addProperty("downloading", downloading);
        if (error != null) {
            status.addProperty("error", error);
        }
        return status;
    }

    static int compareSemver(String a, String b) {
        int[] pa = parse(a);
        int[] pb = parse(b);
        for (int i = 0; i < 3; i++) {
            if (pa[i] != pb[i]) {
                return Integer.compare(pa[i], pb[i]);
            }
        }
        return 0;
    }

    private static int[] parse(String version) {
        String[] parts = version.split("[^0-9]+");
        int[] out = new int[3];
        for (int i = 0; i < Math.min(3, parts.length); i++) {
            if (!parts[i].isBlank()) {
                out[i] = Integer.parseInt(parts[i]);
            }
        }
        return out;
    }

    private record Asset(String name, String url) {
    }
}
