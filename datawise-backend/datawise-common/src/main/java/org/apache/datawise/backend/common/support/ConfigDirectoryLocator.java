package org.apache.datawise.backend.common.support;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;

/**
 * 解析 {@code datawise.config.dir}：优先使用 cwd 下配置；若不存在则向上查找含 connections.xml 或 drivers/ 的 config/。
 */
public final class ConfigDirectoryLocator {

    private ConfigDirectoryLocator() {
    }

    public static Path resolve(String configuredDir) throws IOException {
        String raw = configuredDir != null && !configuredDir.isBlank() ? configuredDir.trim() : "config";
        Path primary = normalize(raw);
        if (isUsableConfigRoot(primary)) {
            return primary;
        }
        if (Paths.get(raw).isAbsolute()) {
            Files.createDirectories(primary.resolve("drivers"));
            Files.createDirectories(primary.resolve("plugins"));
            return primary;
        }
        Path walk = Paths.get("").toAbsolutePath().normalize();
        for (int depth = 0; depth < 8 && walk != null; depth++) {
            Path candidate = walk.resolve("config").normalize();
            if (isUsableConfigRoot(candidate)) {
                return candidate;
            }
            walk = walk.getParent();
        }
        Files.createDirectories(primary.resolve("drivers"));
        Files.createDirectories(primary.resolve("plugins"));
        return primary;
    }

    private static Path normalize(String configuredDir) {
        Path path = Paths.get(configuredDir != null && !configuredDir.isBlank() ? configuredDir.trim() : "config");
        if (!path.isAbsolute()) {
            path = Paths.get("").toAbsolutePath().normalize().resolve(path);
        }
        return path.normalize();
    }

    private static boolean isUsableConfigRoot(Path root) {
        if (root == null || !Files.isDirectory(root)) {
            return false;
        }
        if (Files.isRegularFile(root.resolve("connections.xml"))) {
            return true;
        }
        Path drivers = root.resolve("drivers");
        if (!Files.isDirectory(drivers)) {
            return false;
        }
        try (var stream = Files.list(drivers)) {
            return stream.anyMatch(path -> Files.isRegularFile(path)
                    && path.getFileName().toString().toLowerCase().endsWith(".jar"));
        } catch (IOException ex) {
            return false;
        }
    }
}
