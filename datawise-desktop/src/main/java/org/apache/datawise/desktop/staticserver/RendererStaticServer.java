package org.apache.datawise.desktop.staticserver;

import com.sun.net.httpserver.Headers;
import com.sun.net.httpserver.HttpExchange;
import com.sun.net.httpserver.HttpServer;

import java.io.IOException;
import java.io.OutputStream;
import java.net.InetSocketAddress;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.Map;
import java.util.concurrent.Executors;

/**
 * Serves packaged Vue {@code dist/} over {@code http://127.0.0.1} so Monaco workers
 * are not blocked by {@code file://} restrictions (same motivation as Electron app://).
 */
public final class RendererStaticServer implements AutoCloseable {
    private volatile String bridgeScript = "";

    private static final Map<String, String> CONTENT_TYPES = Map.ofEntries(
            Map.entry(".html", "text/html; charset=utf-8"),
            Map.entry(".js", "text/javascript; charset=utf-8"),
            Map.entry(".mjs", "text/javascript; charset=utf-8"),
            Map.entry(".css", "text/css; charset=utf-8"),
            Map.entry(".json", "application/json; charset=utf-8"),
            Map.entry(".svg", "image/svg+xml"),
            Map.entry(".png", "image/png"),
            Map.entry(".ico", "image/x-icon"),
            Map.entry(".woff", "font/woff"),
            Map.entry(".woff2", "font/woff2"),
            Map.entry(".map", "application/json"),
            Map.entry(".wasm", "application/wasm")
    );

    private final Path distRoot;
    private HttpServer server;
    private int port;

    public RendererStaticServer(Path distRoot) {
        this.distRoot = distRoot.toAbsolutePath().normalize();
    }

    /** Optional early injection into {@code index.html} (before module scripts). */
    public void setBridgeScript(String bridgeScript) {
        this.bridgeScript = bridgeScript == null ? "" : bridgeScript;
    }

    public synchronized String start() throws IOException {
        return start(0);
    }

    /**
     * @param preferredPort preferred bind port; {@code 0} = ephemeral.
     *                      Packaged desktop should pass a stable port so the Chromium
     *                      origin (and thus localStorage) survives restarts.
     */
    public synchronized String start(int preferredPort) throws IOException {
        if (server != null) {
            return "http://127.0.0.1:" + port + "/";
        }
        if (!Files.isRegularFile(distRoot.resolve("index.html"))) {
            throw new IOException("frontend dist missing index.html under " + distRoot);
        }
        IOException lastError = null;
        int[] candidates = preferredPort > 0
                ? new int[]{preferredPort, 0}
                : new int[]{0};
        for (int candidate : candidates) {
            try {
                server = HttpServer.create(new InetSocketAddress("127.0.0.1", candidate), 0);
                port = server.getAddress().getPort();
                lastError = null;
                break;
            } catch (IOException e) {
                lastError = e;
                server = null;
            }
        }
        if (server == null) {
            throw lastError != null ? lastError : new IOException("failed to bind renderer static server");
        }
        server.createContext("/", this::handle);
        server.setExecutor(Executors.newCachedThreadPool(r -> {
            Thread t = new Thread(r, "datawise-renderer-static");
            t.setDaemon(true);
            return t;
        }));
        server.start();
        return "http://127.0.0.1:" + port + "/";
    }

    private void handle(HttpExchange exchange) throws IOException {
        try {
            String raw = exchange.getRequestURI().getPath();
            String path = raw == null || raw.isBlank() || "/".equals(raw) ? "/index.html" : raw;
            Path resolved = distRoot.resolve(path.startsWith("/") ? path.substring(1) : path).normalize();
            if (!resolved.startsWith(distRoot) || !Files.isRegularFile(resolved)) {
                // SPA fallback
                resolved = distRoot.resolve("index.html");
            }
            byte[] body = Files.readAllBytes(resolved);
            String name = resolved.getFileName().toString().toLowerCase();
            if (name.endsWith(".html")) {
                String html = new String(body, java.nio.charset.StandardCharsets.UTF_8);
                // Vite emits crossorigin= on modules; strip to avoid CORS edge cases in CEF.
                html = html.replace(" crossorigin", "");
                if (!bridgeScript.isBlank()) {
                    String safeScript = bridgeScript.replace("</", "<\\/");
                    String inject = "<script>" + safeScript + "</script>";
                    if (html.contains("<head>")) {
                        html = html.replaceFirst("<head>", "<head>" + inject);
                    } else {
                        html = inject + html;
                    }
                }
                body = html.getBytes(java.nio.charset.StandardCharsets.UTF_8);
            }
            Headers headers = exchange.getResponseHeaders();
            headers.set("Content-Type", contentType(resolved.getFileName().toString()));
            headers.set("Cache-Control", "no-cache");
            headers.set("Access-Control-Allow-Origin", "*");
            headers.set("Cross-Origin-Resource-Policy", "cross-origin");
            exchange.sendResponseHeaders(200, body.length);
            try (OutputStream out = exchange.getResponseBody()) {
                out.write(body);
            }
        } catch (Exception e) {
            byte[] msg = ("Not found: " + e.getMessage()).getBytes();
            exchange.sendResponseHeaders(404, msg.length);
            try (OutputStream out = exchange.getResponseBody()) {
                out.write(msg);
            }
        }
    }

    private static String contentType(String fileName) {
        int dot = fileName.lastIndexOf('.');
        if (dot < 0) {
            return "application/octet-stream";
        }
        return CONTENT_TYPES.getOrDefault(fileName.substring(dot).toLowerCase(), "application/octet-stream");
    }

    public int getPort() {
        return port;
    }

    @Override
    public synchronized void close() {
        if (server != null) {
            server.stop(0);
            server = null;
        }
    }
}
