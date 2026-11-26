package fingerprint.bridge.extractors;

import java.security.MessageDigest;
import java.util.Base64;

/** Deterministic non-biometric extractor used only by mock-reader mode. */
public final class MockTemplateExtractor implements TemplateExtractor {
  @Override
  public String extract(byte[] rawImage, int width, int height, int resolution, String pinNumber)
      throws Exception {
    MessageDigest sha = MessageDigest.getInstance("SHA-256");
    sha.update("DEMO-ISO19794-2:".getBytes(java.nio.charset.StandardCharsets.UTF_8));
    return Base64.getEncoder().encodeToString(sha.digest(rawImage));
  }
}
