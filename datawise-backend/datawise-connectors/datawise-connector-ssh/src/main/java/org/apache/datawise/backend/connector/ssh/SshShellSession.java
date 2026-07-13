package org.apache.datawise.backend.connector.ssh;

import com.jcraft.jsch.ChannelShell;
import com.jcraft.jsch.JSchException;
import com.jcraft.jsch.Session;
import org.apache.datawise.backend.common.support.ExceptionLogging;
import org.apache.datawise.backend.model.ConnectionEntity;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.io.IOException;
import java.io.InputStream;
import java.io.OutputStream;
import java.nio.charset.StandardCharsets;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.atomic.AtomicBoolean;
import java.util.function.Consumer;

public final class SshShellSession {

    private static final Logger log = LoggerFactory.getLogger(SshShellSession.class);
    private static final String PTY_TYPE = "xterm-256color";

    private final String sessionId;
    private final Session session;
    private final ChannelShell channel;
    private final OutputStream stdin;
    private final ExecutorService pumpExecutor;
    private final AtomicBoolean closed = new AtomicBoolean(false);

    private SshShellSession(String sessionId, Session session, ChannelShell channel) throws IOException {
        this.sessionId = sessionId;
        this.session = session;
        this.channel = channel;
        this.stdin = channel.getOutputStream();
        this.pumpExecutor = Executors.newSingleThreadExecutor(r -> {
            Thread thread = new Thread(r, "ssh-shell-" + sessionId);
            thread.setDaemon(true);
            return thread;
        });
    }

    public static SshShellSession open(
            String sessionId,
            ConnectionEntity entity,
            int cols,
            int rows,
            SshClientProperties properties
    ) throws SshConnectionException {
        SshConnectionSupport.validate(entity);
        try {
            Session session = SshJschSessions.openSession(entity, properties);

            ChannelShell channel = (ChannelShell) session.openChannel("shell");
            channel.setPtyType(PTY_TYPE);
            applySize(channel, cols, rows);
            channel.connect(properties.getConnectTimeoutMs());
            return new SshShellSession(sessionId, session, channel);
        } catch (JSchException ex) {
            throw new SshConnectionException(SshConnectionSupport.toUserMessage(ex), ex);
        } catch (IOException ex) {
            throw new SshConnectionException("Failed to open SSH shell channel", ex);
        }
    }

    public void pumpOutput(Consumer<String> onOutput, Consumer<Integer> onExit) {
        pumpExecutor.submit(() -> {
            try (InputStream stdout = channel.getInputStream()) {
                byte[] buffer = new byte[4096];
                int read;
                while (!closed.get() && (read = stdout.read(buffer)) >= 0) {
                    if (read == 0) {
                        continue;
                    }
                    onOutput.accept(new String(buffer, 0, read, StandardCharsets.UTF_8));
                }
            } catch (IOException ex) {
                if (!closed.get()) {
                    log.debug("SSH shell output stream closed for {}", sessionId, ex);
                }
            } finally {
                int exitCode = channel.isClosed() ? channel.getExitStatus() : 0;
                if (exitCode < 0) {
                    exitCode = 0;
                }
                onExit.accept(exitCode);
            }
        });
    }

    public void write(String data) throws IOException {
        if (closed.get()) {
            return;
        }
        stdin.write(data.getBytes(StandardCharsets.UTF_8));
        stdin.flush();
    }

    public void resize(int cols, int rows) {
        if (closed.get()) {
            return;
        }
        try {
            applySize(channel, cols, rows);
        } catch (Exception ex) {
            log.debug("SSH shell resize failed for {}", sessionId, ex);
        }
    }

    public void destroy() {
        if (!closed.compareAndSet(false, true)) {
            return;
        }
        try {
            channel.disconnect();
        } catch (Exception ex) {
            ExceptionLogging.warn(log, "SSH shell channel disconnect failed", ex);
        }
        try {
            session.disconnect();
        } catch (Exception ex) {
            ExceptionLogging.warn(log, "SSH session disconnect failed", ex);
        }
        pumpExecutor.shutdownNow();
    }

    private static void applySize(ChannelShell channel, int cols, int rows) {
        int safeCols = Math.max(cols, 20);
        int safeRows = Math.max(rows, 8);
        channel.setPtySize(safeCols, safeRows, safeCols * 8, safeRows * 16);
    }
}
