package com.oracle.aiworld.voice.domain;

public record DoctorIdentity(
        String subject,
        String username,
        String displayName,
        String organization,
        String userGuid) {
}
