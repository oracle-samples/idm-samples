package fingerprint.bridge.model;

/** In-memory capture result; raw pixels are cleared by the bridge after extraction. */
public final class Capture {
  public int quality;
  public boolean livenessPassed;
  public byte[] rawImage;
  public int imageWidth;
  public int imageHeight;
  public int imageResolution;
  public String readerIdentity;
}
