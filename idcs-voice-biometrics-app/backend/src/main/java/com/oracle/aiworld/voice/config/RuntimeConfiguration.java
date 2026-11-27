package com.oracle.aiworld.voice.config;

import java.security.SecureRandom;
import java.time.Clock;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

@Configuration
public class RuntimeConfiguration {
    @Bean
    Clock clock() {
        return Clock.systemUTC();
    }

    @Bean
    SecureRandom secureRandom() {
        return new SecureRandom();
    }
}
