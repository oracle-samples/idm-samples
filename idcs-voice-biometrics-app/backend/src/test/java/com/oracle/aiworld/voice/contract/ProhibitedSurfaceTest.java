package com.oracle.aiworld.voice.contract;

import static org.assertj.core.api.Assertions.assertThat;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.List;
import java.util.Locale;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import org.junit.jupiter.api.Test;

class ProhibitedSurfaceTest {
    private static final Pattern PATH = Pattern.compile("(?m)^  (/[^:]+):$");

    @Test
    void browserContractExposesOnlyTheNarrowCurrentUserVoiceDelete() throws IOException {
        String openApi = Files.readString(contractPath());
        Matcher matcher = PATH.matcher(openApi.substring(
                openApi.indexOf("\npaths:\n"),
                openApi.indexOf("\ncomponents:\n")));
        List<String> paths = matcher.results().map(result -> result.group(1)).toList();

        assertThat(paths).contains("/voice/enrollment");
        assertThat(paths.stream().filter(path -> path.toLowerCase(Locale.ROOT).contains("delete"))).isEmpty();
        assertThat(paths.stream().filter(path -> path.toLowerCase(Locale.ROOT).contains("reset"))).isEmpty();
        assertThat(paths.stream().filter(path -> path.toLowerCase(Locale.ROOT).contains("admin"))).isEmpty();
        assertThat(paths.stream().filter(path -> path.contains("{userId}") || path.contains("{factorId}"))).isEmpty();
    }

    @Test
    void noGeneralIdentityOrMfaAdministrationSurfaceIsDeclared() throws IOException {
        String openApi = Files.readString(contractPath());
        String paths = openApi.substring(openApi.indexOf("\npaths:\n"), openApi.indexOf("\ncomponents:\n"));

        assertThat(paths)
                .doesNotContain("/users/")
                .doesNotContain("/factors/")
                .doesNotContain("/mfa/")
                .doesNotContain("/identity/");
        assertThat(Pattern.compile("(?m)^    delete:$").matcher(paths).results()).hasSize(1);
    }

    private static Path contractPath() {
        Path current = Path.of("").toAbsolutePath();
        while (current != null) {
            Path candidate = current.resolve("specs/001-ai-world-voice-demo/contracts/openapi.yaml");
            if (Files.isRegularFile(candidate)) {
                return candidate;
            }
            current = current.getParent();
        }
        throw new IllegalStateException("Cannot locate OpenAPI contract");
    }
}
