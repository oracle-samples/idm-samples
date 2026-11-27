package com.oracle.aiworld.voice;

import com.oracle.aiworld.voice.config.AiWorldProperties;
import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.boot.context.properties.EnableConfigurationProperties;

@SpringBootApplication
@EnableConfigurationProperties(AiWorldProperties.class)
public class VoiceIdentityDemoApplication {
    public static void main(String[] args) {
        SpringApplication.run(VoiceIdentityDemoApplication.class, args);
    }
}
