package com.oracle.aiworld.voice.api;

import static org.assertj.core.api.Assertions.assertThat;

import com.jayway.jsonpath.JsonPath;
import com.oracle.aiworld.voice.auth.SessionCookiePolicy;
import java.nio.charset.StandardCharsets;
import java.util.Map;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.context.ApplicationContext;
import org.springframework.context.annotation.Import;
import org.springframework.http.HttpHeaders;
import org.springframework.test.web.reactive.server.EntityExchangeResult;
import org.springframework.test.web.reactive.server.WebTestClient;

@SpringBootTest(properties = {
        "ai-world.public-origin=http://localhost:8080",
        "ai-world.idcs.enabled=false",
        "ai-world.iam.status-enabled=false",
        "ai-world.session.idle-seconds=900",
        "ai-world.session.absolute-seconds=3600",
        "ai-world.session.capacity=100"
})
@Import(AuthFlowIntegrationTest.TestPorts.class)
class LocalHttpAuthFlowIntegrationTest {
    private static final String ORIGIN = "http://localhost:8080";

    @Autowired
    ApplicationContext applicationContext;

    private WebTestClient client;

    @BeforeEach
    void setUp() {
        client = WebTestClient.bindToApplicationContext(applicationContext)
                .configureClient()
                .build();
    }

    @Test
    void loginUsesLocalCookieAndThatCookieAuthenticatesMeAndSignOut() {
        EntityExchangeResult<byte[]> context = browserGet(client.get().uri("/api/v1/auth/login-context"))
                .exchange()
                .expectStatus().isOk()
                .expectBody()
                .returnResult();
        String csrf = JsonPath.read(
                new String(context.getResponseBody(), StandardCharsets.UTF_8),
                "$.loginContextToken");

        EntityExchangeResult<Void> login = sameOrigin(client.post().uri("/api/v1/auth/login"))
                .header("X-CSRF-Token", csrf)
                .bodyValue(Map.of("username", "doctor@example.test", "password", "secret"))
                .exchange()
                .expectStatus().isNoContent()
                .expectHeader().value(HttpHeaders.SET_COOKIE, value -> {
                    assertThat(value).startsWith(SessionCookiePolicy.LOOPBACK_COOKIE_NAME + "=");
                    assertThat(value).contains("HttpOnly").contains("SameSite=Strict").contains("Path=/");
                    assertThat(value).doesNotContain("Secure");
                })
                .expectBody().isEmpty();

        String cookie = cookieValue(login.getResponseHeaders().getFirst(HttpHeaders.SET_COOKIE));
        client.get().uri("/api/v1/me")
                .cookie(SessionCookiePolicy.LOOPBACK_COOKIE_NAME, cookie)
                .exchange()
                .expectStatus().isOk()
                .expectBody()
                .jsonPath("$.username").isEqualTo("doctor@example.test");

        client.get().uri("/api/v1/me")
                .cookie(SessionCookiePolicy.SECURE_COOKIE_NAME, cookie)
                .exchange()
                .expectStatus().isUnauthorized();

        sameOrigin(client.post().uri("/api/v1/auth/sign-out"))
                .cookie(SessionCookiePolicy.LOOPBACK_COOKIE_NAME, cookie)
                .exchange()
                .expectStatus().isNoContent()
                .expectHeader().value(HttpHeaders.SET_COOKIE, value -> {
                    assertThat(value).startsWith(SessionCookiePolicy.LOOPBACK_COOKIE_NAME + "=");
                    assertThat(value).contains("Max-Age=0").doesNotContain("Secure");
                });

        client.get().uri("/api/v1/me")
                .cookie(SessionCookiePolicy.LOOPBACK_COOKIE_NAME, cookie)
                .exchange()
                .expectStatus().isUnauthorized();
    }

    private static <S extends WebTestClient.RequestHeadersSpec<?>> S sameOrigin(S request) {
        request.header(HttpHeaders.ORIGIN, ORIGIN)
                .header("Sec-Fetch-Site", "same-origin")
                .header("Sec-Fetch-Mode", "cors")
                .header("Sec-Fetch-Dest", "empty");
        return request;
    }

    private static <S extends WebTestClient.RequestHeadersSpec<?>> S browserGet(S request) {
        request.header("Sec-Fetch-Site", "same-origin")
                .header("Sec-Fetch-Mode", "cors")
                .header("Sec-Fetch-Dest", "empty");
        return request;
    }

    private static String cookieValue(String setCookie) {
        assertThat(setCookie).isNotNull();
        String prefix = SessionCookiePolicy.LOOPBACK_COOKIE_NAME + "=";
        return setCookie.substring(prefix.length(), setCookie.indexOf(';'));
    }
}
