package fingerprint.bridge.extractors;

/** Public boundary for local fingerprint-template extraction and protection. */
public interface TemplateExtractor {
  String extract(byte[] rawImage, int width, int height, int resolution, String pinNumber) throws Exception;
}
