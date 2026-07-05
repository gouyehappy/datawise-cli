package org.apache.datawise.backend.config;

import org.apache.datawise.backend.configstore.SessionStore;
import org.apache.datawise.backend.server.web.SessionAuthFilter;
import org.apache.datawise.backend.server.web.RequestLoggingFilter;
import org.apache.datawise.backend.service.ApiTokenService;
import org.springframework.boot.web.servlet.FilterRegistrationBean;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.core.Ordered;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;

@Configuration
public class AppConfig {

    @Bean
    public PasswordEncoder passwordEncoder() {
        return new BCryptPasswordEncoder();
    }

    @Bean
    public FilterRegistrationBean<SessionAuthFilter> sessionAuthFilterRegistration(
            SessionStore sessionStore,
            ApiTokenService apiTokenService
    ) {
        FilterRegistrationBean<SessionAuthFilter> registration = new FilterRegistrationBean<>();
        registration.setFilter(new SessionAuthFilter(sessionStore, apiTokenService));
        registration.addUrlPatterns("/*");
        registration.setOrder(Ordered.HIGHEST_PRECEDENCE + 10);
        return registration;
    }

    @Bean
    public FilterRegistrationBean<RequestLoggingFilter> requestLoggingFilterRegistration() {
        FilterRegistrationBean<RequestLoggingFilter> registration = new FilterRegistrationBean<>();
        registration.setFilter(new RequestLoggingFilter());
        registration.addUrlPatterns("/*");
        registration.setOrder(Ordered.HIGHEST_PRECEDENCE + 20);
        return registration;
    }
}
