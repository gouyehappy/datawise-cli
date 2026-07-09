package org.apache.datawise.taskconcurrency.spring;

import io.micrometer.core.instrument.MeterRegistry;
import org.apache.datawise.taskconcurrency.TaskConcurrencyControllerBuilder;
import org.apache.datawise.taskconcurrency.TaskConcurrencyControllers;
import org.apache.datawise.taskconcurrency.api.InstanceIdentity;
import org.apache.datawise.taskconcurrency.api.TaskConcurrencyController;
import org.apache.datawise.taskconcurrency.api.TaskConcurrencyListener;
import org.apache.datawise.taskconcurrency.api.TaskConcurrencyStore;
import org.apache.datawise.taskconcurrency.api.TaskHandler;
import org.apache.datawise.taskconcurrency.config.TaskConcurrencyProperties;
import org.apache.datawise.taskconcurrency.runtime.TaskConcurrencyRuntime;
import org.apache.datawise.taskconcurrency.store.InMemoryTaskConcurrencyStore;
import org.apache.datawise.taskconcurrency.store.JdbcTaskConcurrencyStore;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.beans.factory.SmartInitializingSingleton;
import org.springframework.boot.autoconfigure.AutoConfiguration;
import org.springframework.boot.autoconfigure.condition.ConditionalOnBean;
import org.springframework.boot.autoconfigure.condition.ConditionalOnClass;
import org.springframework.boot.autoconfigure.condition.ConditionalOnMissingBean;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.core.env.Environment;

import javax.sql.DataSource;

/**
 * Spring Boot 自动装配：Store、Controller、Metrics Listener、Runtime。
 */
@AutoConfiguration
@ConditionalOnClass(TaskConcurrencyController.class)
@ConditionalOnProperty(prefix = "datawise.task-concurrency", name = "enabled", havingValue = "true", matchIfMissing = true)
@EnableConfigurationProperties(TaskConcurrencySpringProperties.class)
public class TaskConcurrencyAutoConfiguration
{
    @Bean
    @ConditionalOnMissingBean
    public TaskConcurrencyProperties taskConcurrencyProperties(TaskConcurrencySpringProperties springProperties)
    {
        return springProperties.toRuntimeProperties();
    }

    @Bean
    @ConditionalOnMissingBean(InstanceIdentity.class)
    public InstanceIdentity taskConcurrencyInstanceIdentity(Environment environment)
    {
        return new SpringInstanceIdentity(environment);
    }

    @Bean
    @ConditionalOnMissingBean(TaskConcurrencyStore.class)
    public TaskConcurrencyStore taskConcurrencyStore(
            TaskConcurrencySpringProperties springProperties,
            ObjectProvider<DataSource> dataSourceProvider)
    {
        TaskConcurrencySpringProperties.StoreType storeType = resolveStoreType(
                springProperties.getStoreType(), dataSourceProvider.getIfAvailable());
        if (storeType == TaskConcurrencySpringProperties.StoreType.JDBC) {
            DataSource dataSource = dataSourceProvider.getIfAvailable();
            if (dataSource == null) {
                throw new IllegalStateException(
                        "datawise.task-concurrency.store-type=jdbc requires a DataSource bean");
            }
            return new JdbcTaskConcurrencyStore(dataSource);
        }
        return new InMemoryTaskConcurrencyStore()
                .configureGlobal(springProperties.getGlobalMaxConcurrent());
    }

    @Bean
    @ConditionalOnClass(MeterRegistry.class)
    @ConditionalOnBean(MeterRegistry.class)
    @ConditionalOnProperty(prefix = "datawise.task-concurrency.metrics", name = "enabled", havingValue = "true", matchIfMissing = true)
    @ConditionalOnMissingBean
    public TaskConcurrencyMetricsListener taskConcurrencyMetricsListener(
            MeterRegistry meterRegistry,
            TaskConcurrencySpringProperties springProperties,
            ObjectProvider<TaskConcurrencyController> controllerProvider)
    {
        return new TaskConcurrencyMetricsListener(
                meterRegistry,
                springProperties.getMetrics().getPrefix(),
                controllerProvider);
    }

    @Bean
    @ConditionalOnMissingBean
    public TaskConcurrencyController taskConcurrencyController(
            TaskConcurrencyStore store,
            TaskConcurrencyProperties properties,
            InstanceIdentity instanceIdentity,
            TaskConcurrencySpringProperties springProperties,
            ObjectProvider<TaskConcurrencyListener> listenerProvider,
            ObjectProvider<TaskConcurrencyMetricsListener> metricsListenerProvider)
    {
        TaskConcurrencyControllerBuilder builder = TaskConcurrencyControllers.builder()
                .store(store)
                .properties(properties)
                .instanceIdentity(instanceIdentity);
        metricsListenerProvider.ifAvailable(builder::addListener);
        listenerProvider.orderedStream()
                .filter(listener -> !(listener instanceof TaskConcurrencyMetricsListener))
                .forEach(builder::addListener);
        TaskConcurrencyController controller = builder.build();
        if (store instanceof InMemoryTaskConcurrencyStore) {
            controller.updateGlobalMaxConcurrent(springProperties.getGlobalMaxConcurrent());
        }
        return controller;
    }

    @Configuration(proxyBeanMethods = false)
    @ConditionalOnProperty(prefix = "datawise.task-concurrency", name = "runtime-enabled", havingValue = "true", matchIfMissing = true)
    @ConditionalOnBean({TaskConcurrencyController.class, TaskHandler.class})
    static class RuntimeConfiguration
    {
        @Bean(destroyMethod = "close")
        @ConditionalOnMissingBean
        public TaskConcurrencyRuntime taskConcurrencyRuntime(
                TaskConcurrencyController controller,
                TaskHandler handler,
                TaskConcurrencyProperties properties)
        {
            return TaskConcurrencyRuntime.create(controller, handler, properties);
        }

        @Bean
        public SmartInitializingSingleton taskConcurrencyRuntimeStarter(TaskConcurrencyRuntime runtime)
        {
            return runtime::start;
        }
    }

    private static TaskConcurrencySpringProperties.StoreType resolveStoreType(
            TaskConcurrencySpringProperties.StoreType configured,
            DataSource dataSource)
    {
        if (configured == TaskConcurrencySpringProperties.StoreType.AUTO) {
            return dataSource != null
                    ? TaskConcurrencySpringProperties.StoreType.JDBC
                    : TaskConcurrencySpringProperties.StoreType.IN_MEMORY;
        }
        return configured;
    }
}
