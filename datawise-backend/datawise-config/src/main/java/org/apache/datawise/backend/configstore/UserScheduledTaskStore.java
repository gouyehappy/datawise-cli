package org.apache.datawise.backend.configstore;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.apache.datawise.backend.model.ScheduledTaskEntry;
import org.springframework.stereotype.Service;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.List;
import java.util.Objects;
import java.util.concurrent.ConcurrentHashMap;
import java.util.stream.Stream;

@Service
public class UserScheduledTaskStore {

    public record OwnedScheduledTask(long userId, ScheduledTaskEntry entry) {
    }

    private final ConfigDirectoryService configDirectory;
    private final ObjectMapper objectMapper;
    private final ConcurrentHashMap<Long, JsonListFile<ScheduledTaskEntry>> cache = new ConcurrentHashMap<>();

    public UserScheduledTaskStore(ConfigDirectoryService configDirectory, ObjectMapper objectMapper) {
        this.configDirectory = configDirectory;
        this.objectMapper = objectMapper;
    }

    public List<ScheduledTaskEntry> listAll(long userId) {
        return fileFor(userId).snapshot();
    }

    public ScheduledTaskEntry findById(long userId, String id) {
        return fileFor(userId).stream()
                .filter(entry -> id.equals(entry.getId()))
                .findFirst()
                .orElse(null);
    }

    public synchronized ScheduledTaskEntry upsert(long userId, ScheduledTaskEntry entry) {
        Objects.requireNonNull(entry.getId(), "id is required");
        return fileFor(userId).upsert(entry, existing -> existing.getId().equals(entry.getId()));
    }

    public synchronized void removeById(long userId, String id) {
        fileFor(userId).removeIf(entry -> id.equals(entry.getId()));
    }

    /**
     * 调度器专用：遍历所有注册用户的定时任务（不依赖 HTTP 会话）。
     */
    public List<OwnedScheduledTask> listAllAcrossUsers() {
        Path usersDir = configDirectory.resolve(ConfigPaths.USERS_DIR);
        if (!Files.isDirectory(usersDir)) {
            return List.of();
        }
        List<OwnedScheduledTask> result = new ArrayList<>();
        try (Stream<Path> dirs = Files.list(usersDir)) {
            for (Path userDir : dirs.filter(Files::isDirectory).toList()) {
                long userId = parseUserId(userDir.getFileName().toString());
                if (userId < 0) {
                    continue;
                }
                for (ScheduledTaskEntry entry : listAll(userId)) {
                    result.add(new OwnedScheduledTask(userId, entry));
                }
            }
        } catch (IOException ex) {
            return List.of();
        }
        return result;
    }

    private static long parseUserId(String dirName) {
        try {
            return Long.parseLong(dirName);
        } catch (NumberFormatException ex) {
            return -1L;
        }
    }

    private JsonListFile<ScheduledTaskEntry> fileFor(long userId) {
        return cache.computeIfAbsent(userId, uid -> new JsonListFile<>(
                configDirectory,
                objectMapper,
                ConfigPaths.userScheduledTasks(uid),
                new TypeReference<>() {
                }
        ));
    }
}
