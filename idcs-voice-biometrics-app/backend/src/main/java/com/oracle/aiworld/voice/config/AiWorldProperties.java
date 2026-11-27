package com.oracle.aiworld.voice.config;

import org.springframework.boot.context.properties.ConfigurationProperties;

@ConfigurationProperties(prefix = "ai-world")
public record AiWorldProperties(
        String publicOrigin,
        Session session,
        Idcs idcs,
        Iam iam) {

    public record Session(Long idleSeconds, Long absoluteSeconds, Integer capacity) {
    }

    public record Idcs(
            boolean enabled,
            String authenticationMode,
            String domainUrl,
            String tokenPath,
            String profilePath,
            String clientId,
            String clientSecretFile,
            String scope,
            boolean tlsVerify,
            String issuer,
            String audience,
            String jwksUri,
            String identityDomainClaim,
            String identityDomainValue,
            String usernameClaim,
            String displayNameClaim,
            String organizationClaim,
            String userGuidClaim,
            Long clockSkewSeconds,
            Integer loginRateLimitAttempts,
            Integer loginRateLimitIpAttempts,
            Long loginRateLimitWindowSeconds,
            String approvedDoctorsFile,
            Integer connectTimeoutMs,
            Integer responseTimeoutMs) {
    }

    public record Iam(
            boolean statusEnabled,
            boolean enrollmentEnabled,
            String secureDomainUrl,
            String serviceTokenPath,
            String serviceClientId,
            String serviceScope,
            boolean tlsVerify,
            String mtlsKeystoreFile,
            String mtlsKeystorePasswordFile,
            String mtlsKeystoreType,
            String mtlsTruststoreFile,
            String mtlsTruststorePasswordFile,
            String mtlsTruststoreType,
            String factorStatusPath,
            String verificationRequestPath,
            String verificationRequestItemPath,
            Integer connectTimeoutMs,
            Integer responseTimeoutMs,
            boolean factorMappingApproved,
            String factorsJsonPointer,
            String factorMethodField,
            String factorStatusField,
            String voiceMethodValue,
            String enrolledStatusValue,
            String notEnrolledStatusValues,
            String absentVoiceStatus,
            boolean unenrollmentEnabled,
            String factorResourcePath,
            String factorIdField,
            String factorUserGuidField) {
    }
}
