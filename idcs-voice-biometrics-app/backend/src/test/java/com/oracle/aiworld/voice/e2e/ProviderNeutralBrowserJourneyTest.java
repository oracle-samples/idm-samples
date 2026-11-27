package com.oracle.aiworld.voice.e2e;

import static org.assertj.core.api.Assertions.assertThat;
import static org.junit.jupiter.api.Assumptions.assumeTrue;

import com.oracle.aiworld.voice.VoiceIdentityDemoApplication;
import com.oracle.aiworld.voice.domain.DoctorIdentity;
import com.oracle.aiworld.voice.domain.EnrollmentObservation;
import com.oracle.aiworld.voice.domain.EnrollmentStatus;
import com.oracle.aiworld.voice.port.EnrollmentStatusPort;
import com.oracle.aiworld.voice.port.IdentityProviderPort;
import java.io.IOException;
import java.net.InetAddress;
import java.net.ServerSocket;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.net.http.WebSocket;
import java.nio.file.Files;
import java.nio.file.Path;
import java.time.Duration;
import java.time.Instant;
import java.util.Arrays;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.CompletionStage;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicInteger;
import java.util.function.BooleanSupplier;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.Timeout;
import org.junit.jupiter.api.io.TempDir;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.context.TestConfiguration;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Import;
import org.springframework.context.annotation.Primary;
import org.springframework.test.annotation.DirtiesContext;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import reactor.core.publisher.Mono;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;
import tools.jackson.databind.node.ObjectNode;

/**
 * Runs the packaged Oracle JET application in a real headless Chromium process while every
 * identity dependency remains a test-scope bean. No provider-double configuration is present in
 * the runtime artifact. Its ephemeral HTTP origin is test transport only: it is not the permanent
 * LOOPBACK_HTTP_TEST profile and proves none of that profile's boundary, JWE, cookie, or real-use
 * invariants.
 */
@SpringBootTest(
        classes = VoiceIdentityDemoApplication.class,
        webEnvironment = SpringBootTest.WebEnvironment.DEFINED_PORT)
@Import(ProviderNeutralBrowserJourneyTest.TestPorts.class)
@DirtiesContext
class ProviderNeutralBrowserJourneyTest {
    private static final int APPLICATION_PORT = availableLoopbackPort();
    private static final String APPLICATION_ORIGIN = "http://127.0.0.1:" + APPLICATION_PORT;

    @DynamicPropertySource
    static void applicationProperties(DynamicPropertyRegistry registry) {
        registry.add("server.address", () -> "127.0.0.1");
        registry.add("server.port", () -> APPLICATION_PORT);
        registry.add("server.ssl.enabled", () -> false);
        registry.add("ai-world.public-origin", () -> APPLICATION_ORIGIN);
        registry.add("ai-world.idcs.enabled", () -> false);
        registry.add("ai-world.iam.status-enabled", () -> false);
    }

    @Autowired
    TestIdentityProvider identityProvider;

    @Autowired
    TestEnrollmentStatus enrollmentStatus;

    @TempDir
    Path browserProfile;

    @Test
    @Timeout(30)
    void doctorSignsInSeesOnlyEnrollAndSignsOutInARealBrowser() throws Exception {
        Optional<Path> browser = chromiumBinary();
        assumeTrue(browser.isPresent(), "A Chromium browser is required for the browser journey");

        try (ChromeDevTools chrome = ChromeDevTools.start(browser.orElseThrow(), browserProfile)) {
            chrome.navigate(APPLICATION_ORIGIN + "/login");
            chrome.waitUntil("document.readyState === 'complete'", "document load");
            try {
                chrome.waitUntil(
                        "Boolean(document.querySelector('#voice-username'))",
                        "login form");
            } catch (AssertionError failure) {
                throw new AssertionError("Login form diagnostic: " + chrome.diagnostic(), failure);
            }

            chrome.evaluate("""
                    (() => {
                      const username = document.querySelector('#voice-username');
                      username.value = 'doctor@example.test';
                      username.dispatchEvent(new Event('input', { bubbles: true }));
                      const password = document.querySelector('#voice-password');
                      password.value = 'provider-neutral-test-value';
                      password.dispatchEvent(new Event('input', { bubbles: true }));
                      return true;
                    })()
                    """);
            chrome.waitUntil(
                    "Boolean(document.querySelector('button.sign-in-button:not([disabled])'))",
                    "enabled sign-in action");
            chrome.evaluate("document.querySelector('button.sign-in-button').click()");

            chrome.waitUntil(
                    "document.body.innerText.includes('Voice enrollment required')",
                    "authenticated enrollment status");
            assertThat(chrome.text()).contains("doctor@example.test");
            assertThat(chrome.text()).contains("Enroll voice");
            assertThat(chrome.text()).doesNotContain("Start verification");
            assertThat(chrome.location()).isEqualTo(APPLICATION_ORIGIN + "/");
            assertThat(identityProvider.calls()).isEqualTo(1);
            assertThat(identityProvider.expectedRequestObserved()).isTrue();
            assertThat(enrollmentStatus.calls()).isGreaterThanOrEqualTo(1);

            chrome.evaluate("document.querySelector('button.sign-out').click()");
            chrome.waitUntil(
                    "Boolean(document.querySelector('#voice-username')) && location.pathname === '/login'",
                    "signed-out login page");
            assertThat(chrome.text()).contains("Sign in");
            assertThat(chrome.text()).doesNotContain("doctor@example.test");
            assertThat(chrome.evaluate("""
                            fetch('/api/v1/me', {
                              method: 'GET',
                              credentials: 'same-origin',
                              cache: 'no-store'
                            }).then(response => response.status)
                            """).asInt())
                    .isEqualTo(401);

            chrome.navigate(APPLICATION_ORIGIN + "/");
            chrome.waitUntil(
                    "Boolean(document.querySelector('#voice-username')) && location.pathname === '/login'",
                    "anonymous route guard after sign-out");
            assertThat(chrome.text()).doesNotContain("doctor@example.test");
        }
    }

    private static Optional<Path> chromiumBinary() {
        String configured = System.getenv("AI_WORLD_CHROME_BINARY");
        List<Path> candidates = configured == null || configured.isBlank()
                ? List.of(
                        Path.of("/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"),
                        Path.of("/usr/bin/google-chrome"),
                        Path.of("/usr/bin/google-chrome-stable"),
                        Path.of("/usr/bin/chromium"),
                        Path.of("/usr/bin/chromium-browser"))
                : List.of(Path.of(configured));
        return candidates.stream().filter(Files::isExecutable).findFirst();
    }

    private static int availableLoopbackPort() {
        try (ServerSocket socket = new ServerSocket(0, 1, InetAddress.getByName("127.0.0.1"))) {
            return socket.getLocalPort();
        } catch (IOException failure) {
            throw new ExceptionInInitializerError(failure);
        }
    }

    @TestConfiguration(proxyBeanMethods = false)
    static class TestPorts {
        @Bean
        @Primary
        TestIdentityProvider testIdentityProvider() {
            return new TestIdentityProvider();
        }

        @Bean
        @Primary
        TestEnrollmentStatus testEnrollmentStatus() {
            return new TestEnrollmentStatus();
        }
    }

    static final class TestIdentityProvider implements IdentityProviderPort {
        private final AtomicInteger calls = new AtomicInteger();
        private volatile boolean expectedRequestObserved;

        @Override
        public Mono<AuthenticationResult> authenticate(String username, char[] password) {
            calls.incrementAndGet();
            char[] expectedPassword = "provider-neutral-test-value".toCharArray();
            try {
                expectedRequestObserved = "doctor@example.test".equals(username)
                        && Arrays.equals(expectedPassword, password);
            } finally {
                Arrays.fill(expectedPassword, '\0');
            }
            if (!expectedRequestObserved) {
                return Mono.error(new AuthenticationRejectedException());
            }
            return Mono.just(new AuthenticationResult(
                    new DoctorIdentity(
                            "test-subject",
                            "doctor@example.test",
                            "Dr. Alex Morgan",
                            "Northstar Health",
                            "test-user-guid"),
                    new SecretMaterial(
                            "test-scope-token".toCharArray(),
                            null,
                            Instant.now().plusSeconds(3600))));
        }

        int calls() {
            return calls.get();
        }

        boolean expectedRequestObserved() {
            return expectedRequestObserved;
        }
    }

    static final class TestEnrollmentStatus implements EnrollmentStatusPort {
        private final AtomicInteger calls = new AtomicInteger();

        @Override
        public Mono<EnrollmentObservation> lookup(String userGuid, String correlationId) {
            calls.incrementAndGet();
            return Mono.just(new EnrollmentObservation(EnrollmentStatus.NOT_ENROLLED, Instant.now()));
        }

        int calls() {
            return calls.get();
        }
    }

    private static final class ChromeDevTools implements AutoCloseable {
        private static final Duration COMMAND_TIMEOUT = Duration.ofSeconds(5);
        private static final Duration CONDITION_TIMEOUT = Duration.ofSeconds(10);

        private final ObjectMapper mapper = new ObjectMapper();
        private final AtomicInteger commandIds = new AtomicInteger();
        private final Map<Integer, CompletableFuture<JsonNode>> pending = new ConcurrentHashMap<>();
        private final Process process;
        private final WebSocket socket;

        private ChromeDevTools(Process process, URI debuggerUri) {
            this.process = process;
            this.socket = HttpClient.newHttpClient()
                    .newWebSocketBuilder()
                    .connectTimeout(COMMAND_TIMEOUT)
                    .buildAsync(debuggerUri, new DevToolsListener(mapper, pending))
                    .orTimeout(COMMAND_TIMEOUT.toMillis(), TimeUnit.MILLISECONDS)
                    .join();
            send("Page.enable", Map.of());
            send("Runtime.enable", Map.of());
        }

        static ChromeDevTools start(Path binary, Path profile) throws Exception {
            Process process = new ProcessBuilder(
                    binary.toString(),
                    "--headless=new",
                    "--disable-gpu",
                    "--disable-background-networking",
                    "--disable-component-update",
                    "--disable-extensions",
                    "--disable-sync",
                    "--metrics-recording-only",
                    "--no-first-run",
                    "--no-default-browser-check",
                    "--remote-allow-origins=*",
                    "--remote-debugging-address=127.0.0.1",
                    "--remote-debugging-port=0",
                    "--user-data-dir=" + profile.toAbsolutePath(),
                    "about:blank")
                    .redirectOutput(ProcessBuilder.Redirect.DISCARD)
                    .redirectError(ProcessBuilder.Redirect.DISCARD)
                    .start();
            try {
                int debuggerPort = waitForDebuggerPort(profile, process);
                URI debuggerUri = waitForDebugger(debuggerPort, process);
                return new ChromeDevTools(process, debuggerUri);
            } catch (Exception failure) {
                process.destroyForcibly();
                throw failure;
            }
        }

        private static int waitForDebuggerPort(Path profile, Process process) throws Exception {
            Path activePort = profile.resolve("DevToolsActivePort");
            Instant deadline = Instant.now().plusSeconds(5);
            Exception lastFailure = null;
            while (Instant.now().isBefore(deadline) && process.isAlive()) {
                try {
                    if (Files.isRegularFile(activePort)) {
                        List<String> lines = Files.readAllLines(activePort);
                        if (!lines.isEmpty()) {
                            return Integer.parseInt(lines.get(0));
                        }
                    }
                } catch (Exception failure) {
                    lastFailure = failure;
                }
                Thread.sleep(50);
            }
            throw new IllegalStateException("Chromium did not publish its DevTools port", lastFailure);
        }

        void navigate(String url) {
            send("Page.navigate", Map.of("url", url));
        }

        String text() {
            return evaluate("document.body.innerText").asText();
        }

        String location() {
            return evaluate("location.href").asText();
        }

        String diagnostic() {
            return evaluate("""
                    JSON.stringify({
                      location: location.href,
                      readyState: document.readyState,
                      rootDefined: Boolean(customElements.get('app-root')),
                      rootMarkup: document.querySelector('app-root')?.innerHTML ?? '',
                      bodyText: document.body.innerText
                    })
                    """).asText();
        }

        JsonNode evaluate(String expression) {
            JsonNode response = send("Runtime.evaluate", Map.of(
                    "expression", expression,
                    "returnByValue", true,
                    "awaitPromise", true));
            JsonNode exception = response.path("result").path("exceptionDetails");
            if (!exception.isMissingNode()) {
                throw new AssertionError("Browser expression failed: " + exception);
            }
            return response.path("result").path("result").path("value");
        }

        void waitUntil(String expression, String description) throws Exception {
            await(() -> evaluate(expression).asBoolean(false), description);
        }

        private void await(BooleanSupplier condition, String description) throws Exception {
            Instant deadline = Instant.now().plus(CONDITION_TIMEOUT);
            Throwable lastFailure = null;
            while (Instant.now().isBefore(deadline)) {
                try {
                    if (condition.getAsBoolean()) {
                        return;
                    }
                } catch (RuntimeException failure) {
                    lastFailure = failure;
                }
                Thread.sleep(50);
            }
            AssertionError timeout = new AssertionError("Timed out waiting for " + description);
            if (lastFailure != null) {
                timeout.initCause(lastFailure);
            }
            throw timeout;
        }

        private JsonNode send(String method, Map<String, ?> params) {
            int id = commandIds.incrementAndGet();
            CompletableFuture<JsonNode> response = new CompletableFuture<>();
            pending.put(id, response);
            try {
                ObjectNode command = mapper.createObjectNode();
                command.put("id", id);
                command.put("method", method);
                command.set("params", mapper.valueToTree(params));
                socket.sendText(mapper.writeValueAsString(command), true).join();
                JsonNode result = response.get(COMMAND_TIMEOUT.toMillis(), TimeUnit.MILLISECONDS);
                if (result.has("error")) {
                    throw new IllegalStateException("DevTools command failed: " + result.path("error"));
                }
                return result;
            } catch (Exception failure) {
                throw new IllegalStateException("DevTools command failed: " + method, failure);
            } finally {
                pending.remove(id);
            }
        }

        private static URI waitForDebugger(int port, Process process) throws Exception {
            ObjectMapper mapper = new ObjectMapper();
            HttpClient client = HttpClient.newBuilder().connectTimeout(Duration.ofSeconds(1)).build();
            URI targets = URI.create("http://127.0.0.1:" + port + "/json/list");
            Instant deadline = Instant.now().plusSeconds(5);
            Exception lastFailure = null;
            while (Instant.now().isBefore(deadline) && process.isAlive()) {
                try {
                    HttpResponse<String> response = client.send(
                            HttpRequest.newBuilder(targets).timeout(Duration.ofSeconds(1)).GET().build(),
                            HttpResponse.BodyHandlers.ofString());
                    JsonNode pages = mapper.readTree(response.body());
                    if (pages.isArray()) {
                        for (JsonNode page : pages) {
                            String type = page.path("type").asText();
                            String url = page.path("url").asText();
                            String debuggerUrl = page.path("webSocketDebuggerUrl").asText();
                            if ("page".equals(type)
                                    && "about:blank".equals(url)
                                    && !debuggerUrl.isBlank()) {
                                return URI.create(debuggerUrl);
                            }
                        }
                    }
                } catch (Exception failure) {
                    lastFailure = failure;
                }
                Thread.sleep(50);
            }
            throw new IllegalStateException("Chromium DevTools endpoint did not start", lastFailure);
        }

        @Override
        public void close() {
            try {
                socket.sendClose(WebSocket.NORMAL_CLOSURE, "test complete").join();
            } catch (RuntimeException ignored) {
                // The isolated browser process is still terminated below.
            }
            process.destroy();
            try {
                if (!process.waitFor(2, TimeUnit.SECONDS)) {
                    process.destroyForcibly();
                }
            } catch (InterruptedException interrupted) {
                Thread.currentThread().interrupt();
                process.destroyForcibly();
            }
        }
    }

    private static final class DevToolsListener implements WebSocket.Listener {
        private final ObjectMapper mapper;
        private final Map<Integer, CompletableFuture<JsonNode>> pending;
        private final StringBuilder fragments = new StringBuilder();

        private DevToolsListener(
                ObjectMapper mapper,
                Map<Integer, CompletableFuture<JsonNode>> pending) {
            this.mapper = mapper;
            this.pending = pending;
        }

        @Override
        public void onOpen(WebSocket webSocket) {
            webSocket.request(1);
        }

        @Override
        public CompletionStage<?> onText(WebSocket webSocket, CharSequence data, boolean last) {
            fragments.append(data);
            if (last) {
                try {
                    JsonNode message = mapper.readTree(fragments.toString());
                    if (message.has("id")) {
                        CompletableFuture<JsonNode> response = pending.get(message.path("id").asInt());
                        if (response != null) {
                            response.complete(message);
                        }
                    }
                } catch (Exception failure) {
                    pending.values().forEach(response -> response.completeExceptionally(failure));
                } finally {
                    fragments.setLength(0);
                }
            }
            webSocket.request(1);
            return CompletableFuture.completedFuture(null);
        }

        @Override
        public void onError(WebSocket webSocket, Throwable error) {
            pending.values().forEach(response -> response.completeExceptionally(error));
        }
    }
}
