package com.oracle.aiworld.voice.web;

import static org.assertj.core.api.Assertions.assertThat;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.context.ApplicationContext;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.test.web.reactive.server.WebTestClient;

@SpringBootTest
class FrontendServingIntegrationTest {
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
    void applicationEntrypointsServeTheNoStoreIndex() {
        for (String path : new String[] {"/", "/login", "/enroll", "/verify"}) {
            client.get().uri(path)
                    .exchange()
                    .expectStatus().isOk()
                    .expectHeader().contentTypeCompatibleWith(MediaType.TEXT_HTML)
                    .expectHeader().value(HttpHeaders.CACHE_CONTROL,
                            value -> assertThat(value).contains("no-store"))
                    .expectBody(String.class)
                    .value(body -> assertThat(body)
                            .contains("<title>Oracle Voice Identity</title>")
                            .contains("<app-root>"));
        }
    }

    @Test
    void frontendAssetIsServedFromTheClasspath() {
        client.get().uri("/styles/app.css")
                .exchange()
                .expectStatus().isOk()
                .expectHeader().contentTypeCompatibleWith(MediaType.valueOf("text/css"))
                .expectHeader().value(HttpHeaders.CACHE_CONTROL,
                        value -> assertThat(value).contains("no-cache").doesNotContain("no-store"))
                .expectBody(String.class)
                .value(body -> assertThat(body).contains(".app-frame"));
    }

    @Test
    void apiRouteIsHandledByTheApiBoundary() {
        client.get().uri("/api/v1/auth/login-context")
                .exchange()
                .expectStatus().isForbidden()
                .expectHeader().contentTypeCompatibleWith(MediaType.APPLICATION_PROBLEM_JSON)
                .expectBody()
                .jsonPath("$.code").isEqualTo("SAME_ORIGIN_REQUIRED");
    }
}
