package com.oracle.aiworld.voice.adapter.iam;

import com.oracle.aiworld.voice.config.AiWorldProperties.Iam;
import com.oracle.aiworld.voice.domain.EnrollmentStatus;
import com.oracle.aiworld.voice.port.EnrollmentStatusPort.StatusUnavailableException;
import java.util.List;
import java.util.Map;

final class IamFactorResponseMapper {
    private final Iam config;

    IamFactorResponseMapper(Iam config) {
        this.config = config;
    }

    EnrollmentStatus map(Object payload) {
        if (!(payload instanceof Map<?, ?> root) || !"success".equals(root.get("status"))) {
            throw new StatusUnavailableException();
        }
        Object factorsValue = atJsonPointer(payload, config.factorsJsonPointer());
        if (!(factorsValue instanceof List<?> factors)) {
            throw new StatusUnavailableException();
        }
        int voiceFactorCount = 0;
        for (Object value : factors) {
            if (!(value instanceof Map<?, ?> factor)
                    || !(factor.get(config.factorMethodField()) instanceof List<?> methods)) {
                throw new StatusUnavailableException();
            }
            boolean containsVoice = methods.stream()
                    .anyMatch(method -> config.voiceMethodValue().equals(method));
            if (containsVoice) {
                voiceFactorCount++;
            }
        }
        if (voiceFactorCount == 0) {
            if ("NOT_ENROLLED".equals(config.absentVoiceStatus())) {
                return EnrollmentStatus.NOT_ENROLLED;
            }
            throw new StatusUnavailableException();
        }
        if (voiceFactorCount != 1) {
            throw new StatusUnavailableException();
        }
        return EnrollmentStatus.ENROLLED;
    }

    private static Object atJsonPointer(Object root, String pointer) {
        if (pointer == null || pointer.isBlank() || !pointer.startsWith("/")) {
            throw new StatusUnavailableException();
        }
        Object current = root;
        for (String encoded : pointer.substring(1).split("/", -1)) {
            String token = encoded.replace("~1", "/").replace("~0", "~");
            if (current instanceof Map<?, ?> map) {
                if (!map.containsKey(token)) {
                    throw new StatusUnavailableException();
                }
                current = map.get(token);
            } else if (current instanceof List<?> list) {
                try {
                    int index = Integer.parseInt(token);
                    current = list.get(index);
                } catch (NumberFormatException | IndexOutOfBoundsException invalid) {
                    throw new StatusUnavailableException();
                }
            } else {
                throw new StatusUnavailableException();
            }
        }
        return current;
    }
}
