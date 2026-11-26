package fingerprint.bridge.model;

/** Reader identifier and display label returned to the local UI. */
public final class ReaderInfo {
  public final String id;
  public final String label;
  public ReaderInfo(String id, String label) { this.id = id; this.label = label; }
}
