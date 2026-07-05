package org.apache.datawise.backend.service;

import org.apache.datawise.backend.service.instancesql.InstanceSqlWorkspaceSupport;
import org.apache.datawise.backend.service.viewmodel.ViewModelCatalogService;
import org.apache.datawise.backend.service.viewmodel.ViewModelFileService;
import org.apache.datawise.backend.service.viewmodel.ViewModelWorkspaceSupport;

import java.nio.file.Path;

/** Wires view model services for unit tests without Spring. */
public final class ViewModelAssembly {

    private ViewModelAssembly() {
    }

    public static ViewModelService forTest(Path baseDir) {
        WorkspaceScriptsRootService scriptsRoot = new WorkspaceScriptsRootService(baseDir);
        InstanceSqlWorkspaceSupport instanceSupport = new InstanceSqlWorkspaceSupport(scriptsRoot);
        ViewModelWorkspaceSupport workspaceSupport = new ViewModelWorkspaceSupport(instanceSupport);
        ViewModelFileService fileService = new ViewModelFileService(workspaceSupport, null);
        ViewModelCatalogService catalogService = new ViewModelCatalogService(workspaceSupport);
        return new ViewModelService(fileService, catalogService);
    }
}
