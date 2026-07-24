package org.apache.datawise.desktop.prefs;

import com.google.gson.Gson;
import com.google.gson.GsonBuilder;
import com.google.gson.JsonObject;
import com.google.gson.JsonParser;
import org.apache.datawise.desktop.DesktopPaths;

import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;

/**
 * Host-side persistence for renderer UI keys that must survive Chromium origin changes
 * (e.g. packaged static-server port). Synced into {@code localStorage} on bridge inject.
 */
public final class RendererUiStore {
    private static final String FILE = "renderer-ui.json";
    private static final Gson GSON = new GsonBuilder().setPrettyPrinting().create();

    private RendererUiStore() {
    }

    public static Path file() {
        return DesktopPaths.userDataDir().resolve(FILE);
    }

    public static JsonObject read() {
        Path path = file();
        if (!Files.isRegularFile(path)) {
            return new JsonObject();
        }
        try {
            return JsonParser.parseString(Files.readString(path, StandardCharsets.UTF_8)).getAsJsonObject();
        } catch (Exception e) {
            return new JsonObject();
        }
    }

    public static void write(JsonObject patch) {
        JsonObject next = read();
        if (patch != null) {
            for (String key : patch.keySet()) {
                if (patch.get(key) == null || patch.get(key).isJsonNull()) {
                    next.remove(key);
                } else {
                    next.add(key, patch.get(key));
                }
            }
        }
        try {
            Files.createDirectories(DesktopPaths.userDataDir());
            Files.writeString(file(), GSON.toJson(next), StandardCharsets.UTF_8);
        } catch (Exception ignored) {
        }
    }

    public static void clearSessionKeys() {
        JsonObject next = read();
        next.remove("sessionId");
        next.remove("userName");
        next.remove("userId");
        next.remove("guest");
        next.remove("expiresAt");
        try {
            Files.createDirectories(DesktopPaths.userDataDir());
            Files.writeString(file(), GSON.toJson(next), StandardCharsets.UTF_8);
        } catch (Exception ignored) {
        }
    }

    /** JS snippet that restores keys into localStorage before Vue boots. */
    public static String localStorageBootstrapJs() {
        JsonObject data = read();
        StringBuilder js = new StringBuilder();
        js.append("(function(){try{");
        putLs(js, "dw-cli-session-id", str(data, "sessionId"));
        putLs(js, "dw-cli-username", str(data, "userName"));
        putLs(js, "dw-cli-user-id", str(data, "userId"));
        putLs(js, "dw-cli-is-guest", str(data, "guest"));
        putLs(js, "dw-cli-session-expires-at", str(data, "expiresAt"));
        putLs(js, "dw-cli-onboarding-completed", str(data, "onboardingCompleted"));
        putLs(js, "dw-cli-onboarding-first-insight-completed", str(data, "onboardingFirstInsightCompleted"));
        js.append("}catch(e){}})();");
        return js.toString();
    }

    private static String str(JsonObject data, String key) {
        if (data == null || !data.has(key) || data.get(key).isJsonNull()) {
            return null;
        }
        try {
            return data.get(key).getAsString();
        } catch (Exception e) {
            return null;
        }
    }

    private static void putLs(StringBuilder js, String key, String value) {
        if (value == null || value.isBlank()) {
            return;
        }
        js.append("localStorage.setItem(")
                .append(jsonQuote(key))
                .append(",")
                .append(jsonQuote(value))
                .append(");");
    }

    private static String jsonQuote(String value) {
        return "\"" + value
                .replace("\\", "\\\\")
                .replace("\"", "\\\"")
                .replace("\r", "")
                .replace("\n", "\\n")
                + "\"";
    }
}
