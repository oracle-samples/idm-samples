package fingerprint.bridge.readers;

import fingerprint.bridge.model.Capture;
import fingerprint.bridge.model.ReaderInfo;
import java.nio.charset.StandardCharsets;

/** Public deterministic reader implementation for mock mode. */
public final class MockFingerprintReaderManager implements FingerprintReaderManager {
  @Override
  public Capture capture(int readerNumber)
      throws Exception {
    Capture capture = new Capture();
    capture.quality = 88;
    capture.livenessPassed = true;
    capture.rawImage = "RAW-IMAGE-PLACEHOLDER".getBytes(StandardCharsets.UTF_8);
    capture.imageWidth = capture.rawImage.length;
    capture.imageHeight = 1;
    capture.imageResolution = 500;
    capture.readerIdentity = "mock";
    return capture;
  }

  @Override
  public ReaderInfo[] listReaders() {
    return new ReaderInfo[] {new ReaderInfo("0", "Mock Reader 01")};
  }
  @Override public void prepare(int readerNumber) { }
  @Override public void close() { }
  @Override public boolean isConnected() { return true; }
}
