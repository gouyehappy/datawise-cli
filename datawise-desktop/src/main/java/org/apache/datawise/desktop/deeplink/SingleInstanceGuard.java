package org.apache.datawise.desktop.deeplink;

import org.apache.datawise.desktop.DesktopPaths;

import java.io.RandomAccessFile;
import java.nio.channels.FileChannel;
import java.nio.channels.FileLock;
import java.nio.file.Files;
import java.util.ArrayList;
import java.util.List;
import java.util.concurrent.CopyOnWriteArrayList;
import java.util.function.Consumer;

public final class SingleInstanceGuard implements AutoCloseable {
    private RandomAccessFile raf;
    private FileChannel channel;
    private FileLock lock;
    private final List<String> pendingUrls = new CopyOnWriteArrayList<>();
    private Consumer<List<String>> secondInstanceHandler;

    public boolean tryAcquire() {
        try {
            Files.createDirectories(DesktopPaths.userDataDir());
            raf = new RandomAccessFile(DesktopPaths.singleInstanceLockFile().toFile(), "rw");
            channel = raf.getChannel();
            lock = channel.tryLock();
            return lock != null;
        } catch (Exception e) {
            return false;
        }
    }

    public void setSecondInstanceHandler(Consumer<List<String>> handler) {
        this.secondInstanceHandler = handler;
    }

    public void enqueueDeepLink(String url) {
        if (url != null && !url.isBlank()) {
            pendingUrls.add(url.trim());
        }
    }

    public List<String> drainPending() {
        List<String> copy = new ArrayList<>(pendingUrls);
        pendingUrls.clear();
        return copy;
    }

    /** Best-effort: write argv deep links into a sidecar file for the first instance to poll (Windows). */
    public static void notifyRunningInstance(String[] args) {
        try {
            Files.createDirectories(DesktopPaths.userDataDir());
            List<String> urls = new ArrayList<>();
            for (String arg : args) {
                if (arg != null && arg.startsWith("datawise://")) {
                    urls.add(arg.trim());
                }
            }
            if (urls.isEmpty()) {
                return;
            }
            PathInbox.write(urls);
        } catch (Exception ignored) {
        }
    }

    public void startInboxPoller() {
        Thread t = new Thread(() -> {
            while (!Thread.currentThread().isInterrupted()) {
                try {
                    List<String> urls = PathInbox.drain();
                    if (!urls.isEmpty() && secondInstanceHandler != null) {
                        secondInstanceHandler.accept(urls);
                    }
                    Thread.sleep(500);
                } catch (InterruptedException e) {
                    Thread.currentThread().interrupt();
                    return;
                } catch (Exception ignored) {
                }
            }
        }, "datawise-single-instance-inbox");
        t.setDaemon(true);
        t.start();
    }

    @Override
    public void close() {
        try {
            if (lock != null) {
                lock.release();
            }
        } catch (Exception ignored) {
        }
        try {
            if (channel != null) {
                channel.close();
            }
        } catch (Exception ignored) {
        }
        try {
            if (raf != null) {
                raf.close();
            }
        } catch (Exception ignored) {
        }
    }

    static final class PathInbox {
        private static final java.nio.file.Path FILE = DesktopPaths.userDataDir().resolve("deep-link-inbox.txt");

        static synchronized void write(List<String> urls) throws Exception {
            StringBuilder sb = new StringBuilder();
            for (String url : urls) {
                sb.append(url).append('\n');
            }
            Files.writeString(FILE, sb.toString(), java.nio.charset.StandardCharsets.UTF_8,
                    java.nio.file.StandardOpenOption.CREATE, java.nio.file.StandardOpenOption.APPEND);
        }

        static synchronized List<String> drain() throws Exception {
            if (!Files.isRegularFile(FILE)) {
                return List.of();
            }
            List<String> lines = Files.readAllLines(FILE, java.nio.charset.StandardCharsets.UTF_8);
            Files.deleteIfExists(FILE);
            return lines.stream().map(String::trim).filter(s -> !s.isEmpty()).toList();
        }
    }
}
