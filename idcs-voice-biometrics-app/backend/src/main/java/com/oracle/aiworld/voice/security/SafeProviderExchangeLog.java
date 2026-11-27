package com.oracle.aiworld.voice.security;

import java.lang.reflect.Array;
import java.net.URI;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;

/** Produces bounded, single-line provider request/response diagnostics without exposing secrets. */
public final class SafeProviderExchangeLog {
    private static final int MAX_DEPTH = 6;
    private static final int MAX_ITEMS = 40;
    private static final int MAX_TEXT = 256;
    private static final Set<String> PASSWORD_FIELDS = Set.of("password", "passphrase");
    private static final Set<String> SECRET_FIELDS = Set.of(
            "accesstoken", "refreshtoken", "securitytoken", "secret", "clientsecret",
            "authorization", "cookie", "credential", "privatekey", "certificate", "requeststate");
    private static final Set<String> IDENTITY_FIELDS = Set.of(
            "username", "userguid", "subject", "ocid", "id", "factorid", "value", "email", "emails",
            "displayname", "name", "preferredfactorid");

    private SafeProviderExchangeLog() {
    }

    public static Object body(Object value) {
        return sanitize(null, value, 0);
    }

    public static String endpoint(String baseUrl, String path) {
        try {
            URI base = URI.create(baseUrl);
            // URI rejects RFC 6570-style braces. Replace template variables with a fixed,
            // non-identifier marker so provider routes remain useful in diagnostics without
            // ever logging the current user or factor identifier.
            String safeTemplatePath = path == null
                    ? ""
                    : path.replaceAll("\\{[A-Za-z][A-Za-z0-9]*}", "_");
            URI resolved = base.resolve(safeTemplatePath);
            String port = resolved.getPort() < 0 ? "" : ":" + resolved.getPort();
            String safePath = resolved.getRawPath() == null || resolved.getRawPath().isBlank()
                    ? "/" : resolved.getRawPath();
            return resolved.getScheme() + "://" + resolved.getHost() + port + safePath;
        } catch (RuntimeException invalid) {
            return "invalid_endpoint";
        }
    }

    public static String headerValue(Object value) {
        if (!(value instanceof CharSequence text) || text.isEmpty()) {
            return "not_provided";
        }
        String safe = singleLine(text.toString());
        return safe.length() <= MAX_TEXT ? safe : safe.substring(0, MAX_TEXT) + "…";
    }

    private static Object sanitize(String field, Object value, int depth) {
        if (value == null) return null;
        if (depth >= MAX_DEPTH) return "<max-depth>";
        String normalizedField = normalize(field);
        if (PASSWORD_FIELDS.contains(normalizedField)) return "<redacted>";
        if (SECRET_FIELDS.contains(normalizedField)) return secretSummary(value);
        if (IDENTITY_FIELDS.contains(normalizedField)) return identitySummary(value);
        if (value instanceof Map<?, ?> map) return sanitizeMap(map, depth + 1);
        if (value instanceof Iterable<?> iterable) return sanitizeIterable(iterable, depth + 1);
        if (value.getClass().isArray()) return sanitizeArray(value, depth + 1);
        if (value instanceof CharSequence text) return safeText(text.toString());
        if (value instanceof Number || value instanceof Boolean || value instanceof Enum<?>) return value;
        return "<" + value.getClass().getSimpleName() + ">";
    }

    private static Map<String, Object> sanitizeMap(Map<?, ?> map, int depth) {
        Map<String, Object> safe = new LinkedHashMap<>();
        int count = 0;
        for (Map.Entry<?, ?> entry : map.entrySet()) {
            if (count++ >= MAX_ITEMS) {
                safe.put("…", "<additional-fields-omitted>");
                break;
            }
            String key = safeText(String.valueOf(entry.getKey()));
            safe.put(key, sanitize(key, entry.getValue(), depth));
        }
        return safe;
    }

    private static List<Object> sanitizeIterable(Iterable<?> iterable, int depth) {
        List<Object> safe = new ArrayList<>();
        for (Object item : iterable) {
            if (safe.size() >= MAX_ITEMS) {
                safe.add("<additional-items-omitted>");
                break;
            }
            safe.add(sanitize(null, item, depth));
        }
        return safe;
    }

    private static List<Object> sanitizeArray(Object array, int depth) {
        if (array instanceof byte[] || array instanceof char[]) return List.of("<redacted>");
        List<Object> safe = new ArrayList<>();
        int length = Math.min(Array.getLength(array), MAX_ITEMS);
        for (int index = 0; index < length; index++) {
            safe.add(sanitize(null, Array.get(array, index), depth));
        }
        if (Array.getLength(array) > MAX_ITEMS) safe.add("<additional-items-omitted>");
        return safe;
    }

    private static String secretSummary(Object value) {
        if (value instanceof CharSequence text && !text.isEmpty()) {
            return "<redacted fp=" + SafeDiagnosticFingerprint.of(text)
                    + " len=" + text.length() + ">";
        }
        if (value instanceof char[] characters && characters.length > 0) {
            return "<redacted fp=" + SafeDiagnosticFingerprint.of(characters)
                    + " len=" + characters.length + ">";
        }
        return "<redacted>";
    }

    private static Object identitySummary(Object value) {
        if (value instanceof CharSequence text && !text.isEmpty()) {
            return "<fp=" + SafeDiagnosticFingerprint.of(text) + ">";
        }
        if (value instanceof Map<?, ?> map) return sanitizeMap(map, 1);
        if (value instanceof Iterable<?> iterable) return sanitizeIterable(iterable, 1);
        return "<redacted>";
    }

    private static String normalize(String value) {
        if (value == null) return "";
        return value.replaceAll("[^A-Za-z0-9]", "").toLowerCase(Locale.ROOT);
    }

    private static String safeText(String value) {
        String safe = singleLine(value);
        return safe.length() <= MAX_TEXT ? safe : safe.substring(0, MAX_TEXT) + "…";
    }

    private static String singleLine(String value) {
        return value.replaceAll("[\\p{Cntrl}&&[^\\t]]", " ").replace('\t', ' ').trim();
    }
}
