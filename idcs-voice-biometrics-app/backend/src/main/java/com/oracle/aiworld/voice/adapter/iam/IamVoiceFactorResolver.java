package com.oracle.aiworld.voice.adapter.iam;

import com.oracle.aiworld.voice.config.AiWorldProperties.Iam;
import com.oracle.aiworld.voice.port.IamVoiceUnenrollmentPort.FailureKind;
import com.oracle.aiworld.voice.port.IamVoiceUnenrollmentPort.VoiceUnenrollmentException;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.regex.Pattern;

final class IamVoiceFactorResolver {
    private static final Pattern SAFE_PROVIDER_IDENTIFIER =
            Pattern.compile("^[A-Za-z0-9._:-]{1,512}$");

    sealed interface Resolution permits Absent, Resolved {
    }

    record Absent() implements Resolution {
    }

    record Resolved(VoiceFactorHandle handle) implements Resolution {
        Resolved {
            Objects.requireNonNull(handle, "handle");
        }
    }

    static final class VoiceFactorHandle implements AutoCloseable {
        private final char[] value;

        private VoiceFactorHandle(String value) {
            this.value = value.toCharArray();
        }

        char[] copyValue() {
            return value.clone();
        }

        @Override
        public void close() {
            Arrays.fill(value, '\0');
        }

        @Override
        public String toString() {
            return "VoiceFactorHandle[redacted]";
        }
    }

    private final Iam config;

    IamVoiceFactorResolver(Iam config) {
        this.config = Objects.requireNonNull(config, "config");
    }

    Resolution resolve(Object payload, String expectedUserGuid) {
        if (!(payload instanceof Map<?, ?> root) || !"success".equals(root.get("status"))) {
            throw failure(FailureKind.MALFORMED_FACTOR);
        }
        requireCurrentUser(root.get(config.factorUserGuidField()), expectedUserGuid);
        Object factorsValue = atJsonPointer(payload, config.factorsJsonPointer());
        if (!(factorsValue instanceof List<?> factors)) {
            throw failure(FailureKind.MALFORMED_FACTOR);
        }

        List<VoiceFactorHandle> matches = new ArrayList<>(1);
        try {
            for (Object value : factors) {
                if (!(value instanceof Map<?, ?> factor)) {
                    throw failure(FailureKind.MALFORMED_FACTOR);
                }
                Object methodsValue = factor.get(config.factorMethodField());
                if (!(methodsValue instanceof List<?> methods)
                        || methods.stream().anyMatch(method -> !(method instanceof String))) {
                    throw failure(FailureKind.MALFORMED_FACTOR);
                }
                boolean voice = methods.stream().anyMatch(config.voiceMethodValue()::equals);
                if (!voice) {
                    continue;
                }
                Object factorUser = factor.get(config.factorUserGuidField());
                if (factorUser != null) {
                    requireCurrentUser(factorUser, expectedUserGuid);
                }
                Object identifier = factor.get(config.factorIdField());
                if (!(identifier instanceof String factorId)
                        || !SAFE_PROVIDER_IDENTIFIER.matcher(factorId).matches()) {
                    throw failure(FailureKind.MALFORMED_FACTOR);
                }
                matches.add(new VoiceFactorHandle(factorId));
            }
            if (matches.isEmpty()) {
                return new Absent();
            }
            if (matches.size() != 1) {
                throw failure(FailureKind.AMBIGUOUS_FACTOR);
            }
            return new Resolved(matches.removeFirst());
        } finally {
            matches.forEach(VoiceFactorHandle::close);
        }
    }

    private static void requireCurrentUser(Object actual, String expected) {
        if (!(actual instanceof String userGuid)
                || expected == null
                || !SAFE_PROVIDER_IDENTIFIER.matcher(expected).matches()
                || !userGuid.equals(expected)) {
            throw failure(FailureKind.CROSS_USER_FACTOR);
        }
    }

    private static Object atJsonPointer(Object root, String pointer) {
        if (pointer == null || pointer.isBlank() || !pointer.startsWith("/")) {
            throw failure(FailureKind.MALFORMED_FACTOR);
        }
        Object current = root;
        for (String encoded : pointer.substring(1).split("/", -1)) {
            String token = encoded.replace("~1", "/").replace("~0", "~");
            if (current instanceof Map<?, ?> map && map.containsKey(token)) {
                current = map.get(token);
            } else {
                throw failure(FailureKind.MALFORMED_FACTOR);
            }
        }
        return current;
    }

    private static VoiceUnenrollmentException failure(FailureKind kind) {
        return new VoiceUnenrollmentException(kind);
    }
}
