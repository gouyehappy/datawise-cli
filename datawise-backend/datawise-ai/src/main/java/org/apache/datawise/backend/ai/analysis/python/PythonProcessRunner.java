package org.apache.datawise.backend.ai.analysis.python;

import org.apache.datawise.backend.ai.domain.PythonExecutionResult;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Path;
import java.util.List;
import java.util.Map;
import java.util.concurrent.TimeUnit;

/** 运行外部进程并收集 stdout/stderr。 */
public final class PythonProcessRunner {

    private PythonProcessRunner() {
    }

    public static PythonExecutionResult run(List<String> command, int timeoutSeconds) {
        return run(command, Map.of(), null, timeoutSeconds);
    }

    public static PythonExecutionResult run(
            List<String> command,
            Map<String, String> environment,
            Path workingDirectory,
            int timeoutSeconds
    ) {
        try {
            ProcessBuilder builder = new ProcessBuilder(command);
            if (workingDirectory != null) {
                builder.directory(workingDirectory.toFile());
            }
            if (environment != null && !environment.isEmpty()) {
                builder.environment().clear();
                builder.environment().putAll(environment);
            }
            Process process = builder.start();
            boolean finished = process.waitFor(Math.max(5, timeoutSeconds), TimeUnit.SECONDS);
            if (!finished) {
                process.destroyForcibly();
                return PythonExecutionResult.failure("Process timed out", "");
            }
            String stdout = new String(process.getInputStream().readAllBytes(), StandardCharsets.UTF_8);
            String stderr = new String(process.getErrorStream().readAllBytes(), StandardCharsets.UTF_8);
            if (process.exitValue() != 0) {
                return PythonExecutionResult.failure("Process exited with code " + process.exitValue(), stderr);
            }
            return PythonExecutionResult.success(stdout.trim());
        } catch (IOException | InterruptedException ex) {
            Thread.currentThread().interrupt();
            return PythonExecutionResult.failure(ex.getMessage(), "");
        }
    }
}
