package com.oracle.aiworld.voice.contract;

import static org.assertj.core.api.Assertions.assertThat;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.regex.Pattern;
import org.junit.jupiter.api.Test;

class ApplicationContractDocumentsTest {
    private static final Pattern PROVIDER_IDENTIFIER_PROPERTY =
            Pattern.compile("(?m)^\\s+(?:userId|factorId):\\s*$");

    @Test
    void voiceUnenrollmentIsAnIdentifierFreeNoBodyDelete() throws IOException {
        String openApi = contract("openapi.yaml");
        String operation = between(
                openApi,
                "  /voice/enrollment:\n",
                "  /voice/enrollment-attempt:\n");

        assertThat(operation)
                .contains("    delete:")
                .contains("operationId: deleteVoiceEnrollment")
                .contains("secureSessionCookie: []")
                .contains("loopbackSessionCookie: []")
                .contains("csrfToken: []")
                .contains("#/components/parameters/IdempotencyKey")
                .contains("#/components/schemas/VoiceUnenrollmentResponse")
                .contains("#/components/headers/NoStore")
                .doesNotContain("requestBody:");
        assertThat(PROVIDER_IDENTIFIER_PROPERTY.matcher(operation).find()).isFalse();
    }

    @Test
    void voiceUnenrollmentReturnsOnlyNormalizedAuthoritativeState() throws IOException {
        String openApi = contract("openapi.yaml");
        String response = between(
                openApi,
                "    VoiceUnenrollmentResponse:\n",
                "    CreateEnrollmentAttemptRequest:\n");

        assertThat(response)
                .contains("additionalProperties: false")
                .contains("enum: [DELETED, ALREADY_NOT_ENROLLED]")
                .contains("const: NOT_ENROLLED")
                .contains("const: AVAILABLE")
                .contains("const: ENROLL")
                .contains("const: SIGN_OUT");
        assertThat(PROVIDER_IDENTIFIER_PROPERTY.matcher(response).find()).isFalse();
    }

    @Test
    void contractCarriesTheSameOriginMutationBoundaryAndDeleteActionVocabulary() throws IOException {
        String openApi = contract("openapi.yaml");

        assertThat(openApi)
                .contains("exact Origin")
                .contains("Fetch Metadata")
                .contains("name: X-CSRF-Token")
                .contains("name: Idempotency-Key")
                .contains("enum: [ENROLL, VERIFY, DELETE_VOICE_ENROLLMENT, SIGN_OUT]");
    }

    @Test
    void websocketContractCarriesTheCanonicalVerifiedTranscriptLifecycle() throws IOException {
        String asyncApi = contract("asyncapi.yaml");

        assertThat(asyncApi)
                .contains("name: utterance.started")
                .contains("name: utterance.sealed")
                .contains("name: utterance.discarded")
                .contains("const: transcript.partial")
                .contains("const: transcript.final")
                .contains("const: assurance.result")
                .contains("required: [utteranceOrdinal, outcome, completedAt]")
                .contains("detectedSpeechMs:")
                .contains("minimum: 1")
                .contains("can contain zero complete speech-analysis frames and is still submitted");
    }

    @Test
    void websocketContractCarriesServerDirectedEnrollmentProgressAndWaitState()
            throws IOException {
        String asyncApi = contract("asyncapi.yaml");

        assertThat(asyncApi)
                .contains("name: enrollment.progress")
                .contains("name: enrollment.state")
                .contains("- utteranceOrdinal")
                .contains("- acceptedUtteranceCount")
                .contains("- capturedSampleMs")
                .contains("- minimumSampleMs")
                .contains("- maximumSampleMs")
                .doesNotContain("const: 8000")
                .contains("const: WAITING")
                .contains("const: WAIT")
                .contains("const: ABIS_PROCESSING");
    }

    private static String contract(String name) throws IOException {
        return Files.readString(repoRoot().resolve("specs/001-ai-world-voice-demo/contracts").resolve(name));
    }

    private static Path repoRoot() {
        Path current = Path.of("").toAbsolutePath();
        while (current != null) {
            if (Files.isDirectory(current.resolve("specs/001-ai-world-voice-demo/contracts"))) {
                return current;
            }
            current = current.getParent();
        }
        throw new IllegalStateException("Cannot locate repository contracts directory");
    }

    private static String between(String source, String start, String end) {
        int startIndex = source.indexOf(start);
        int endIndex = source.indexOf(end, startIndex + start.length());
        assertThat(startIndex).as("contract section start %s", start.trim()).isGreaterThanOrEqualTo(0);
        assertThat(endIndex).as("contract section end %s", end.trim()).isGreaterThan(startIndex);
        return source.substring(startIndex, endIndex);
    }
}
