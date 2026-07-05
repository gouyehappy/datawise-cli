package org.apache.datawise.backend.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.apache.datawise.backend.configstore.ConfigDirectoryService;
import org.apache.datawise.backend.configstore.TeamStore;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;

final class TestTeamStoreFactory {

    private TestTeamStoreFactory() {
    }

    static TeamStore create(Path configRoot) throws IOException {
        Files.createDirectories(configRoot);
        ObjectMapper mapper = new ObjectMapper().findAndRegisterModules();
        return new TeamStore(new ConfigDirectoryService(configRoot), mapper);
    }
}
