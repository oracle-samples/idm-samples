package com.oracle.aiworld.voice.security;

import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.util.HexFormat;

/** Creates non-reversible identifiers for correlating secret material in local demo logs. */
public final class SafeDiagnosticFingerprint {
    private SafeDiagnosticFingerprint() {
    }

    public static String of(CharSequence value) {
        if (value == null || value.isEmpty()) return "missing";
        MessageDigest digest = sha256();
        for (int index = 0; index < value.length(); index++) {
            char character = value.charAt(index);
            digest.update((byte) (character >>> 8));
            digest.update((byte) character);
        }
        return HexFormat.of().formatHex(digest.digest(), 0, 8);
    }

    public static String of(char[] value) {
        if (value == null || value.length == 0) return "missing";
        MessageDigest digest = sha256();
        for (char character : value) {
            digest.update((byte) (character >>> 8));
            digest.update((byte) character);
        }
        return HexFormat.of().formatHex(digest.digest(), 0, 8);
    }

    public static int dotSeparatedSegments(CharSequence value) {
        if (value == null || value.isEmpty()) return 0;
        int segments = 1;
        for (int index = 0; index < value.length(); index++) {
            if (value.charAt(index) == '.') segments++;
        }
        return segments;
    }

    public static int dotSeparatedSegments(char[] value) {
        if (value == null || value.length == 0) return 0;
        int segments = 1;
        for (char character : value) {
            if (character == '.') segments++;
        }
        return segments;
    }

    private static MessageDigest sha256() {
        try {
            return MessageDigest.getInstance("SHA-256");
        } catch (NoSuchAlgorithmException impossible) {
            throw new IllegalStateException(impossible);
        }
    }
}
