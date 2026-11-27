package com.oracle.aiworld.voice.config;

import static org.assertj.core.api.Assertions.assertThat;

import java.nio.file.Files;
import java.nio.file.Path;
import java.util.HashMap;
import java.util.HashSet;
import java.util.Map;
import java.util.Set;
import java.util.regex.Pattern;
import org.junit.jupiter.api.Test;
import org.springframework.boot.env.YamlPropertySourceLoader;
import org.springframework.core.env.ConfigurableEnvironment;
import org.springframework.core.env.StandardEnvironment;
import org.springframework.core.env.SystemEnvironmentPropertySource;
import org.springframework.core.io.ClassPathResource;

class EnvironmentConfigurationTest {
    @Test
    void everyDocumentedEnvironmentSettingOverridesItsApplicationProperty() throws Exception {
        var source = new YamlPropertySourceLoader()
                .load("app", new ClassPathResource("application.yml")).getFirst();
        var variables = Pattern.compile("\\$\\{(VOICE_BIOMETRIC_[A-Z0-9_]+)");
        Map<String, Object> overrides = new HashMap<>();
        Map<String, String> mappings = new HashMap<>();
        var enumerable = (org.springframework.core.env.EnumerablePropertySource<?>) source;
        for (String property : enumerable.getPropertyNames()) {
            var matcher = variables.matcher(String.valueOf(source.getProperty(property)));
            if (matcher.find()) {
                String variable = matcher.group(1);
                mappings.put(property, variable);
                overrides.put(variable, "test-value-" + variable);
            }
        }
        ConfigurableEnvironment environment = new StandardEnvironment();
        environment.getPropertySources().addFirst(source);
        environment.getPropertySources().addFirst(new SystemEnvironmentPropertySource("test-env", overrides));
        for (var mapping : mappings.entrySet()) {
            assertThat(environment.getProperty(mapping.getKey()))
                    .as(mapping.getValue()).isEqualTo(overrides.get(mapping.getValue()));
        }
        Path template = Path.of("../.env.example");
        if (!Files.exists(template)) template = Path.of(".env.example");
        var assignment = Pattern.compile("^(VOICE_BIOMETRIC_[A-Z0-9_]+)=");
        Set<String> documented = new HashSet<>();
        for (String line : Files.readAllLines(template)) {
            var matcher = assignment.matcher(line);
            if (matcher.find()) documented.add(matcher.group(1));
        }
        assertThat(documented).isNotEmpty().containsExactlyInAnyOrderElementsOf(overrides.keySet());
    }
}
