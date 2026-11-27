package com.oracle.aiworld.voice.security;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;

import org.junit.jupiter.api.Test;

class SafeDiagnosticFingerprintTest {
    @Test
    void correlatesStringAndCharacterArrayWithoutExposingSecret() {
        String secret = "header.payload.signature";

        String fromString = SafeDiagnosticFingerprint.of(secret);
        String fromCharacters = SafeDiagnosticFingerprint.of(secret.toCharArray());

        assertEquals(fromString, fromCharacters);
        assertEquals(16, fromString.length());
        assertFalse(fromString.contains(secret));
        assertEquals(3, SafeDiagnosticFingerprint.dotSeparatedSegments(secret));
        assertEquals(3, SafeDiagnosticFingerprint.dotSeparatedSegments(secret.toCharArray()));
    }

    @Test
    void reportsMissingValuesSafely() {
        assertEquals("missing", SafeDiagnosticFingerprint.of((CharSequence) null));
        assertEquals("missing", SafeDiagnosticFingerprint.of(new char[0]));
        assertEquals(0, SafeDiagnosticFingerprint.dotSeparatedSegments((CharSequence) null));
        assertEquals(0, SafeDiagnosticFingerprint.dotSeparatedSegments(new char[0]));
    }
}
