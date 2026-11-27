package com.oracle.aiworld.voice.auth;

import com.oracle.aiworld.voice.api.ApiException;
import com.oracle.aiworld.voice.auth.SessionRegistry.SessionView;
import org.springframework.stereotype.Component;
import org.springframework.web.server.ServerWebExchange;

@Component
public class SessionAuthenticator {
    private final SessionRegistry sessions;
    private final SessionCookiePolicy cookiePolicy;

    public SessionAuthenticator(SessionRegistry sessions, SessionCookiePolicy cookiePolicy) {
        this.sessions = sessions;
        this.cookiePolicy = cookiePolicy;
    }

    public SessionView require(ServerWebExchange exchange) {
        var cookie = cookiePolicy.read(exchange);
        return sessions.find(cookie == null ? null : cookie.getValue()).orElseThrow(ApiException::unauthorized);
    }
}
