package com.oracle.aiworld.voice.security;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.security.SecureRandom;
import java.util.Base64;

public final class OpaqueTokens {
    private OpaqueTokens() {
    }

    public static String random(SecureRandom random) {
        byte[] value = new byte[32];
        random.nextBytes(value);
        try {
            return Base64.getUrlEncoder().withoutPadding().encodeToString(value);
        } finally {
            java.util.Arrays.fill(value, (byte) 0);
        }
    }

    public static String digest(String value) {
        try {
            MessageDigest digest = MessageDigest.getInstance("SHA-256");
            byte[] hashed = digest.digest(value.getBytes(StandardCharsets.UTF_8));
            try {
                return Base64.getUrlEncoder().withoutPadding().encodeToString(hashed);
            } finally {
                java.util.Arrays.fill(hashed, (byte) 0);
            }
        } catch (NoSuchAlgorithmException impossible) {
            throw new IllegalStateException("SHA-256 is unavailable", impossible);
        }
    }
}
