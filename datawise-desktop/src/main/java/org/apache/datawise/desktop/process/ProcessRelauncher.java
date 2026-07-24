package org.apache.datawise.desktop.process;

import org.apache.datawise.desktop.backend.BackendProcessService;

import java.io.File;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.List;
import java.util.Optional;

/**
 * Relaunch the current JVM process (workspace switch / apply config), matching Electron {@code app.relaunch()}.
 */
public final class ProcessRelauncher {
    private ProcessRelauncher() {
    }

    public static void relaunch(BackendProcessService backend) {
        try {
            if (backend != null) {
                backend.stop();
            }
        } catch (Exception ignored) {
        }

        List<String> command = resolveCommand();
        try {
            new ProcessBuilder(command)
                    .directory(new File(System.getProperty("user.dir")))
                    .start();
        } catch (Exception e) {
            System.err.println("[datawise-desktop] relaunch failed: " + e.getMessage());
            System.err.println("[datawise-desktop] attempted: " + String.join(" ", command));
        }
        System.exit(0);
    }

    private static List<String> resolveCommand() {
        Optional<String> cmd = ProcessHandle.current().info().command();
        Optional<String[]> args = ProcessHandle.current().info().arguments();
        if (cmd.isPresent()) {
            List<String> full = new ArrayList<>();
            full.add(cmd.get());
            args.ifPresent(a -> full.addAll(Arrays.asList(a)));
            if (full.size() > 1) {
                return full;
            }
        }

        // Fallback: java -cp <classpath> mainClass
        String javaHome = System.getProperty("java.home");
        boolean win = System.getProperty("os.name", "").toLowerCase().contains("win");
        String java = javaHome + File.separator + "bin" + File.separator + (win ? "java.exe" : "java");
        List<String> fallback = new ArrayList<>();
        fallback.add(java);
        fallback.add("-cp");
        fallback.add(System.getProperty("java.class.path"));
        fallback.add("org.apache.datawise.desktop.DatawiseDesktopApp");
        return fallback;
    }
}
