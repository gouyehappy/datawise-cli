package org.apache.datawise.backend.controller.ai;

import org.apache.datawise.backend.ai.config.AiPythonProperties;
import org.apache.datawise.backend.common.ApiResponse;
import org.apache.datawise.backend.ai.domain.AiPythonRuntimeDto;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/ai/python")
public class AiPythonRuntimeController {

    private final AiPythonProperties pythonProperties;

    public AiPythonRuntimeController(AiPythonProperties pythonProperties) {
        this.pythonProperties = pythonProperties;
    }

    @GetMapping("/runtime")
    public ApiResponse<AiPythonRuntimeDto> runtime() {
        return ApiResponse.ok(new AiPythonRuntimeDto(
                pythonProperties.isEnabled(),
                pythonProperties.getExecutor(),
                pythonProperties.isSandboxEnabled(),
                pythonProperties.isDependencyInstallEnabled(),
                pythonProperties.getDockerImage(),
                pythonProperties.getK8sNamespace(),
                pythonProperties.getTimeoutSeconds(),
                pythonProperties.getDependencyInstallTimeoutSeconds(),
                pythonProperties.getMaxRetries()
        ));
    }
}
