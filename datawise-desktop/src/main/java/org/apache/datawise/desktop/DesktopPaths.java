package org.apache.datawise.desktop;

import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;

/**
 * Resolve install / user-data / resource paths for the JCEF desktop host.
 */
public final class DesktopPaths {
    private static final String APP_DIR_NAME = "DataWiseCLI";

    private DesktopPaths() {
    }

    public static Path userDataDir() {
        String override = System.getenv("DATAWISE_USER_DATA");
        if (override != null && !override.isBlank()) {
            return Paths.get(override.trim());
        }
        String portable = System.getenv("PORTABLE_EXECUTABLE_DIR");
        if (portable != null && !portable.isBlank()) {
            return Paths.get(portable.trim(), "user-data");
        }
        String os = System.getProperty("os.name", "").toLowerCase();
        if (os.contains("win")) {
            String appData = System.getenv("APPDATA");
            if (appData != null && !appData.isBlank()) {
                return Paths.get(appData, APP_DIR_NAME);
            }
        }
        if (os.contains("mac")) {
            return Paths.get(System.getProperty("user.home"), "Library", "Application Support", APP_DIR_NAME);
        }
        String xdg = System.getenv("XDG_CONFIG_HOME");
        if (xdg != null && !xdg.isBlank()) {
            return Paths.get(xdg, APP_DIR_NAME);
        }
        return Paths.get(System.getProperty("user.home"), ".config", APP_DIR_NAME);
    }

    public static Path documentsWorkspacesParent() {
        return Paths.get(System.getProperty("user.home"), "Documents", "DataWise", "workspaces");
    }

    /** Install root: directory containing host jar / resources (backend, frontend-dist). */
    public static Path installRoot() {
        String override = System.getenv("DATAWISE_INSTALL_ROOT");
        if (override != null && !override.isBlank()) {
            return Paths.get(override.trim());
        }
        String coded = System.getProperty("datawise.install.root");
        if (coded != null && !coded.isBlank()) {
            return Paths.get(coded.trim());
        }
        try {
            Path codeSource = Paths.get(
                    DesktopPaths.class.getProtectionDomain().getCodeSource().getLocation().toURI());
            Path parent = codeSource.getParent();
            if (parent != null) {
                // jpackage app-image: <root>/app/*.jar
                if ("app".equalsIgnoreCase(String.valueOf(parent.getFileName()))) {
                    Path root = parent.getParent();
                    if (root != null) {
                        return root;
                    }
                }
                if (Files.isDirectory(parent.resolve("backend"))
                        || Files.isDirectory(parent.resolve("frontend-dist"))
                        || Files.isDirectory(parent.resolve("resources").resolve("backend"))) {
                    return parent;
                }
                Path moduleRoot = parent.getParent();
                if (moduleRoot != null
                        && "datawise-desktop".equals(String.valueOf(moduleRoot.getFileName()))) {
                    Path repo = moduleRoot.getParent();
                    return repo != null ? repo : moduleRoot;
                }
                return parent;
            }
        } catch (Exception ignored) {
            // fall through
        }
        return Paths.get("").toAbsolutePath();
    }

    /** Preferred Windows launcher (.exe), else .cmd, else jar. */
    public static Path resolveWindowsLauncher() {
        Path install = installRoot();
        Path exe = install.resolve("DataWiseCLI.exe");
        if (Files.isRegularFile(exe)) {
            return exe;
        }
        Path cmd = install.resolve("DataWiseCLI.cmd");
        if (Files.isRegularFile(cmd)) {
            return cmd;
        }
        try {
            return Paths.get(
                    DesktopPaths.class.getProtectionDomain().getCodeSource().getLocation().toURI());
        } catch (Exception e) {
            return install.resolve("datawise-desktop.jar");
        }
    }

    public static Path backendRoot(boolean packaged) {
        Path install = installRoot();
        if (packaged) {
            Path nested = install.resolve("resources").resolve("backend");
            if (Files.isDirectory(nested)) {
                return nested;
            }
            return install.resolve("backend");
        }
        return install.resolve("datawise-backend").resolve("datawise-server").resolve("target");
    }

    public static Path configBundleRoot(boolean packaged) {
        Path install = installRoot();
        if (packaged) {
            Path nested = install.resolve("resources").resolve("config-bundle");
            if (Files.isDirectory(nested)) {
                return nested;
            }
            return install.resolve("config-bundle");
        }
        return install.resolve("datawise-frontend").resolve("resources").resolve("bundle-config");
    }

    public static Path frontendDistRoot() {
        Path install = installRoot();
        Path packaged = install.resolve("resources").resolve("frontend-dist");
        if (Files.isRegularFile(packaged.resolve("index.html"))) {
            return packaged;
        }
        Path sibling = install.resolve("frontend-dist");
        if (Files.isRegularFile(sibling.resolve("index.html"))) {
            return sibling;
        }
        return install.resolve("datawise-frontend").resolve("dist");
    }

    public static Path jcefBundleDir() {
        return userDataDir().resolve("jcef-bundle");
    }

    public static Path singleInstanceLockFile() {
        return userDataDir().resolve("single-instance.lock");
    }
}
