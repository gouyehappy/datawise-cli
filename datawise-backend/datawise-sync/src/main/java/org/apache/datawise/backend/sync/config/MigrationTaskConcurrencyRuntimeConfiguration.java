package org.apache.datawise.backend.sync.config;

import org.apache.datawise.taskconcurrency.api.TaskConcurrencyController;
import org.apache.datawise.taskconcurrency.api.TaskHandler;
import org.apache.datawise.taskconcurrency.config.TaskConcurrencyProperties;
import org.apache.datawise.taskconcurrency.runtime.TaskConcurrencyRuntime;
import org.springframework.beans.factory.SmartInitializingSingleton;
import org.springframework.boot.autoconfigure.condition.ConditionalOnBean;
import org.springframework.boot.autoconfigure.condition.ConditionalOnClass;
import org.springframework.boot.autoconfigure.condition.ConditionalOnMissingBean;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

/**
 * Ensures task-concurrency runtime starts for migration jobs when a {@link TaskHandler} is present.
 */
@Configuration
@ConditionalOnClass(TaskConcurrencyRuntime.class)
@ConditionalOnBean({TaskConcurrencyController.class, TaskHandler.class})
@ConditionalOnProperty(prefix = "datawise.task-concurrency", name = "runtime-enabled", havingValue = "true", matchIfMissing = true)
public class MigrationTaskConcurrencyRuntimeConfiguration {

    @Bean(destroyMethod = "close")
    @ConditionalOnMissingBean
    public TaskConcurrencyRuntime migrationTaskConcurrencyRuntime(
            TaskConcurrencyController controller,
            TaskHandler handler,
            TaskConcurrencyProperties properties
    ) {
        return TaskConcurrencyRuntime.create(controller, handler, properties);
    }

    @Bean
    @ConditionalOnMissingBean(name = "taskConcurrencyRuntimeStarter")
    public SmartInitializingSingleton migrationTaskConcurrencyRuntimeStarter(TaskConcurrencyRuntime runtime) {
        return runtime::start;
    }
}
