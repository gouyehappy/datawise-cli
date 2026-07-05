package org.apache.datawise.backend.terminal;

import com.pty4j.PtyProcess;
import com.pty4j.PtyProcessBuilder;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.io.IOException;
import java.io.InputStream;
import java.io.OutputStream;
import java.nio.charset.StandardCharsets;
import java.util.Map;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.atomic.AtomicBoolean;
import java.util.function.Consumer;

public final class TerminalPtySession {

    private static final Logger log = LoggerFactory.getLogger(TerminalPtySession.class);

    private final String sessionId;
    private final PtyProcess process;
    private final OutputStream stdin;
    private final ExecutorService pumpExecutor;
    private final AtomicBoolean closed = new AtomicBoolean(false);

    private TerminalPtySession(String sessionId, PtyProcess process) {
        this.sessionId = sessionId;
        this.process = process;
        this.stdin = process.getOutputStream();
        this.pumpExecutor = Executors.newSingleThreadExecutor(r -> {
            Thread thread = new Thread(r, "terminal-pty-" + sessionId);
            thread.setDaemon(true);
            return thread;
        });
    }

    public static TerminalPtySession start(String sessionId, int cols, int rows) throws IOException {
        String[] command = resolveShellCommand();
        String cwd = System.getProperty("user.home", ".");
        PtyProcess process = new PtyProcessBuilder()
                .setCommand(command)
                .setDirectory(cwd)
                .setEnvironment(Map.of())
                .setInitialColumns(Math.max(cols, 20))
                .setInitialRows(Math.max(rows, 8))
                .start();
        return new TerminalPtySession(sessionId, process);
    }

    public void pumpOutput(Consumer<String> onOutput, Consumer<Integer> onExit) {
        pumpExecutor.submit(() -> {
            try (InputStream stdout = process.getInputStream()) {
                byte[] buffer = new byte[4096];
                int read;
                while (!closed.get() && (read = stdout.read(buffer)) >= 0) {
                    if (read == 0) continue;
                    onOutput.accept(new String(buffer, 0, read, StandardCharsets.UTF_8));
                }
            } catch (IOException ex) {
                if (!closed.get()) {
                    log.debug("PTY output stream closed for {}", sessionId, ex);
                }
            } finally {
                int exitCode = 0;
                try {
                    exitCode = process.waitFor();
                } catch (InterruptedException ex) {
                    Thread.currentThread().interrupt();
                }
                onExit.accept(exitCode);
            }
        });
    }

    public void write(String data) throws IOException {
        if (closed.get()) return;
        stdin.write(data.getBytes(StandardCharsets.UTF_8));
        stdin.flush();
    }

    public void resize(int cols, int rows) {
        if (closed.get()) return;
        try {
            process.setWinSize(new com.pty4j.WinSize(Math.max(cols, 20), Math.max(rows, 8)));
        } catch (Exception ex) {
            log.debug("PTY resize failed for {}", sessionId, ex);
        }
    }

    public void destroy() {
        if (!closed.compareAndSet(false, true)) return;
        try {
            process.destroy();
        } catch (Exception ex) {
            log.debug("PTY destroy failed for {}", sessionId, ex);
        }
        pumpExecutor.shutdownNow();
    }

    public static boolean isPtyAvailable() {
        try {
            String os = System.getProperty("os.name", "").toLowerCase();
            if (os.contains("win")) {
                return new java.io.File(System.getenv("ComSpec") != null
                        ? System.getenv("ComSpec")
                        : "C:\\Windows\\System32\\cmd.exe").exists();
            }
            return new java.io.File("/bin/bash").exists() || new java.io.File("/bin/sh").exists();
        } catch (Exception ex) {
            return false;
        }
    }

    private static String[] resolveShellCommand() {
        String os = System.getProperty("os.name", "").toLowerCase();
        if (os.contains("win")) {
            String comspec = System.getenv("ComSpec");
            if (comspec != null && !comspec.isBlank()) {
                return new String[]{comspec};
            }
            return new String[]{"cmd.exe"};
        }
        if (new java.io.File("/bin/bash").exists()) {
            return new String[]{"/bin/bash", "-l"};
        }
        return new String[]{"/bin/sh", "-l"};
    }
}
