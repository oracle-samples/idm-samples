package com.oracle.aiworld.voice.config;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.security.config.web.server.ServerHttpSecurity;
import org.springframework.security.web.server.SecurityWebFilterChain;
import org.springframework.security.core.userdetails.ReactiveUserDetailsService;
import reactor.core.publisher.Mono;

@Configuration
public class WebSecurityConfiguration {
    @Bean
    SecurityWebFilterChain applicationSecurity(ServerHttpSecurity http) {
        return http
                .csrf(ServerHttpSecurity.CsrfSpec::disable)
                .httpBasic(ServerHttpSecurity.HttpBasicSpec::disable)
                .formLogin(ServerHttpSecurity.FormLoginSpec::disable)
                .logout(ServerHttpSecurity.LogoutSpec::disable)
                .authorizeExchange(exchange -> exchange.anyExchange().permitAll())
                .build();
    }

    @Bean
    ReactiveUserDetailsService noFrameworkCredentialStore() {
        // All authentication is handled by the explicit IDCS adapter and opaque application sessions.
        // Supplying an empty service also prevents Spring Boot from generating and logging a demo password.
        return username -> Mono.empty();
    }
}
