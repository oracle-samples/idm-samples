package fingerprint.bridge.readers;

import fingerprint.bridge.model.Capture;
import fingerprint.bridge.model.ReaderInfo;

/** Public boundary for reader discovery, lifecycle management, and capture. */
public interface FingerprintReaderManager {
  Capture capture(int readerNumber) throws Exception;
  ReaderInfo[] listReaders() throws Exception;
  void prepare(int readerNumber) throws Exception;
  void close();
  boolean isConnected();
}
