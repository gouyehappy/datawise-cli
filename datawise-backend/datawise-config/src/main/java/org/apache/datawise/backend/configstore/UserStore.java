package org.apache.datawise.backend.configstore;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.apache.datawise.backend.model.UserEntity;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

import java.util.List;
import java.util.Objects;
import java.util.Optional;

@Service
public class UserStore {

    private final JsonListFile<UserEntity> users;

    @Autowired
    public UserStore(ConfigDirectoryService configDirectory, ObjectMapper objectMapper) {
        this.users = new JsonListFile<>(
                configDirectory,
                objectMapper,
                ConfigPaths.USERS,
                new TypeReference<List<UserEntity>>() {
                }
        );
    }

    public Optional<UserEntity> findById(Long id) {
        if (id == null) {
            return Optional.empty();
        }
        return users.stream()
                .filter(user -> id.equals(user.getId()))
                .findFirst();
    }

    public synchronized UserEntity saveUser(UserEntity user) {
        Objects.requireNonNull(user.getId(), "id is required");
        return users.upsert(user, existing -> existing.getId().equals(user.getId()));
    }

    public Optional<UserEntity> findByUsername(String username) {
        if (username == null || username.isBlank()) {
            return Optional.empty();
        }
        String normalized = username.trim();
        return users.stream()
                .filter(user -> normalized.equalsIgnoreCase(user.getUsername()))
                .findFirst();
    }

    public java.util.List<UserEntity> listRegisteredUsers() {
        return users.stream()
                .filter(user -> user != null && !user.isGuest())
                .toList();
    }

    public java.util.List<UserEntity> listAllUsers() {
        return users.stream()
                .filter(user -> user != null)
                .toList();
    }
}
