package com.oracle.aiworld.voice.api.websocket;

import java.util.Map;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.web.reactive.HandlerMapping;
import org.springframework.web.reactive.handler.SimpleUrlHandlerMapping;
import org.springframework.web.reactive.socket.server.support.WebSocketHandlerAdapter;
import tools.jackson.databind.ObjectMapper;

@Configuration
public class VoiceWebSocketConfiguration {
    @Bean
    VoiceProtocolCodec voiceProtocolCodec(ObjectMapper mapper) {
        return new VoiceProtocolCodec(mapper);
    }

    @Bean
    HandlerMapping voiceWebSocketMapping(VoiceWebSocketHandler handler) {
        SimpleUrlHandlerMapping mapping = new SimpleUrlHandlerMapping();
        mapping.setOrder(-1);
        mapping.setUrlMap(Map.of("/ws/v1/voice", handler));
        return mapping;
    }

    @Bean
    WebSocketHandlerAdapter voiceWebSocketHandlerAdapter() {
        return new WebSocketHandlerAdapter();
    }
}
