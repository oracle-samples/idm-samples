package fingerprint.bridge;

import com.sun.net.httpserver.HttpExchange;
import com.sun.net.httpserver.HttpServer;
import java.io.OutputStream;
import java.net.InetSocketAddress;
import java.nio.charset.StandardCharsets;
import java.lang.reflect.InvocationTargetException;
import java.util.concurrent.Executors;
import fingerprint.bridge.model.Capture;
import fingerprint.bridge.model.ReaderInfo;
import fingerprint.bridge.readers.FingerprintReaderManager;
import fingerprint.bridge.readers.MockFingerprintReaderManager;
import fingerprint.bridge.extractors.MockTemplateExtractor;
import fingerprint.bridge.extractors.TemplateExtractor;

/**
 * Local-only bridge between the web process and a reader Java SDK.
 * In production replace MockReaderSdk with the adapter for an accredited vendor SDK.
 * Raw pixels intentionally never leave this process and are zeroed after extraction.
 */
public final class FingerprintBridge {
  static {
    System.err.println("[safe diagnostic] configured reader manager: " + configuredReaderImplementation()
        + "; template extractor: " + configuredExtractorImplementation());
  }

  private static final Object EXTRACTOR_LOCK = new Object();
  private static volatile TemplateExtractor extractor;
  private static final FingerprintReaderManager READER = createReaderSafely();

  private static String configuredReaderImplementation() {
    String implementation = System.getenv("FINGERPRINT_READER");
    return implementation == null || implementation.isBlank() ? "mock" : implementation;
  }

  private static String configuredExtractorImplementation() {
    String implementation = System.getenv("FINGERPRINT_TEMPLATE_EXTRACTOR");
    return implementation == null || implementation.isBlank() ? "mock" : implementation;
  }

  private static FingerprintReaderManager createReader() {
    String implementation = System.getenv("FINGERPRINT_READER");
    if (implementation == null || implementation.isBlank() || "mock".equalsIgnoreCase(implementation)) {
      return new ReconnectingFingerprintReaderManager(
          (diagnostics, readerNumber) -> new MockFingerprintReaderManager(),
          () -> new MockFingerprintReaderManager().listReaders());
    }
    if ("lumidigm".equalsIgnoreCase(implementation)) {
      return new ReconnectingFingerprintReaderManager(
          FingerprintBridge::createLumidigmReader,
          FingerprintBridge::discoverLumidigmReaders);
    }
    throw new IllegalStateException("Unsupported FINGERPRINT_READER value: " + implementation);
  }

  private static FingerprintReaderManager createReaderSafely() {
    try {
      return createReader();
    } catch (RuntimeException | LinkageError error) {
      System.err.println("[safe diagnostic] reader manager configuration failed; bridge will remain available: "
          + sdkDiagnostic(error));
      return new UnavailableFingerprintReaderManager(error);
    }
  }

  private static TemplateExtractor createTemplateExtractor() {
    String implementation = System.getenv("FINGERPRINT_TEMPLATE_EXTRACTOR");
    if (implementation == null || implementation.isBlank()) implementation = "mock";
    if ("mock".equalsIgnoreCase(implementation)) return new MockTemplateExtractor();
    if ("tech5".equalsIgnoreCase(implementation)) {
      try {
        // Keep the proprietary Tech5 classes optional in mock-mode runtime classpaths.
        return (TemplateExtractor) Class.forName("fingerprint.bridge.extractors.Tech5TemplateExtractor")
            .getDeclaredConstructor().newInstance();
      } catch (ReflectiveOperationException error) {
        throw new IllegalStateException("Tech5 template extractor is not installed. Use run-bridge.", error);
      }
    }
    throw new IllegalStateException("Unsupported FINGERPRINT_TEMPLATE_EXTRACTOR value: " + implementation);
  }

  private static TemplateExtractor templateExtractor() {
    TemplateExtractor current = extractor;
    if (current != null) return current;
    synchronized (EXTRACTOR_LOCK) {
      if (extractor == null) extractor = createTemplateExtractor();
      return extractor;
    }
  }

  private static FingerprintReaderManager createLumidigmReader(boolean diagnostics, int readerNumber)
      throws Exception {
    try {
      // vCOM is proprietary; keep it optional when the bridge runs without the SDK.
      return (FingerprintReaderManager) Class.forName("fingerprint.bridge.readers.LumidigmFingerprintReaderManager")
          .getDeclaredConstructor(boolean.class, int.class).newInstance(diagnostics, readerNumber);
    } catch (ClassNotFoundException error) {
      throw new IllegalStateException("Lumidigm vCOM reader selected, but its manager is not installed. Use run-bridge.", error);
    } catch (InvocationTargetException error) {
      Throwable cause = error.getCause();
      if (cause instanceof Exception) throw (Exception) cause;
      throw new IllegalStateException("Lumidigm vCOM reader initialization failed.", cause == null ? error : cause);
    } catch (ReflectiveOperationException error) {
      throw new IllegalStateException("Lumidigm vCOM reader initialization failed.", error);
    }
  }

  private static ReaderInfo[] discoverLumidigmReaders() throws Exception {
    try {
      return (ReaderInfo[]) Class.forName("fingerprint.bridge.readers.LumidigmFingerprintReaderManager")
          .getDeclaredMethod("discoverReaders").invoke(null);
    } catch (InvocationTargetException error) {
      Throwable cause = error.getCause();
      if (cause instanceof Exception) throw (Exception) cause;
      throw new IllegalStateException("Lumidigm vCOM reader discovery failed.", cause == null ? error : cause);
    } catch (ReflectiveOperationException error) {
      throw new IllegalStateException("Lumidigm vCOM reader discovery failed.", error);
    }
  }

  public static void main(String[] args) throws Exception {
    int port = args.length > 0 ? Integer.parseInt(args[0]) : 7071;
    HttpServer server = HttpServer.create(new InetSocketAddress("127.0.0.1", port), 0);

    server.createContext("/health", FingerprintBridge::health);
    server.createContext("/status", FingerprintBridge::status);
    server.createContext("/readers", FingerprintBridge::readers);
    server.createContext("/select-reader", FingerprintBridge::selectReader);
    server.createContext("/capture", FingerprintBridge::capture);
    server.setExecutor(Executors.newCachedThreadPool());
    server.start();

    System.out.println("Fingerprint bridge listening locally on http://127.0.0.1:" + port);
    try {
      READER.prepare(0);
      System.err.println("[safe diagnostic] prepared first fingerprint reader at bridge startup.");
    } catch (Exception | LinkageError error) {
      // A reader can be connected later; startup must remain available.
      System.err.println("[safe diagnostic] no fingerprint reader prepared at bridge startup: " + sdkDiagnostic(error));
    }
    try {
      templateExtractor();
      System.err.println("[safe diagnostic] configured template extractor initialized.");
    } catch (Exception | LinkageError error) {
      // The bridge stays available for reader discovery and a later extraction retry.
      System.err.println("[safe diagnostic] template extractor initialization failed: " + sdkDiagnostic(error));
    }
  }

  static void health(HttpExchange exchange) {
    boolean connected = READER.isConnected();
    respond(exchange, 200, "{\"connected\":" + connected + "}");
  }

  static void status(HttpExchange exchange) {
    respond(exchange, 200, "{\"bridgeAvailable\":true}");
  }

  static void readers(HttpExchange exchange) {
    try {
      ReaderInfo[] readers = READER.listReaders();
      StringBuilder payload = new StringBuilder("{\"readers\":[");
      for (int index = 0; index < readers.length; index++) {
        if (index > 0) payload.append(',');
        payload.append("{\"id\":\"").append(jsonString(readers[index].id))
            .append("\",\"label\":\"").append(jsonString(readers[index].label)).append("\"}");
      }
      respond(exchange, 200, payload.append("]}").toString());
    } catch (Exception | LinkageError error) {
      System.err.println("[safe diagnostic] reader discovery failed; bridge remains available: "
          + sdkDiagnostic(error));
      respond(exchange, 503, "{\"error\":\"Reader discovery failed\"}");
    }
  }

  static void selectReader(HttpExchange exchange) {
    try (exchange) {
      if (!"POST".equals(exchange.getRequestMethod())) {
        exchange.sendResponseHeaders(405, -1);
        return;
      }
      String request = new String(exchange.getRequestBody().readAllBytes(), StandardCharsets.UTF_8);
      int readerNumber = Integer.parseInt(field(request, "reader", "-1"));
      if (readerNumber < 0) throw new IllegalArgumentException("A reader must be selected.");
      READER.prepare(readerNumber);
      respond(exchange, 200, "{\"prepared\":true}");
    } catch (Exception | LinkageError error) {
      System.err.println("[safe diagnostic] reader preparation failed; bridge remains available: "
          + sdkDiagnostic(error));
      respond(exchange, 503, "{\"error\":\"Reader preparation failed\"}");
    }
  }

  static void capture(HttpExchange exchange) {
    try (exchange) {
      try {
        if (!"POST".equals(exchange.getRequestMethod())) {
          exchange.sendResponseHeaders(405, -1);
          return;
        }

        String request = new String(exchange.getRequestBody().readAllBytes(), StandardCharsets.UTF_8);
        int readerNumber = Integer.parseInt(field(request, "reader", "-1"));
        if (readerNumber < 0) throw new IllegalArgumentException("A reader must be selected.");
        String seed2 = field(request, "seed2", "");
        Capture sample = READER.capture(readerNumber);

        try {
          int rawBytes = sample.rawImage == null ? 0 : sample.rawImage.length;

          if (!sample.livenessPassed || sample.quality < 60) {
            respond(
                exchange,
                200,
                json(sample, null).replace("\"rawImageBytes\":0", "\"rawImageBytes\":" + rawBytes));
            return;
          }

          String template = extractTemplate(sample, seed2);
          respond(
              exchange,
              200,
              json(sample, template).replace("\"rawImageBytes\":0", "\"rawImageBytes\":" + rawBytes));
        } finally {
          if (sample.rawImage != null) {
            // Discard on success and every rejection path.
            java.util.Arrays.fill(sample.rawImage, (byte) 0);
          }
          sample.rawImage = null;
        }
      } catch (Exception | LinkageError error) {
        // Diagnostic only: never include images, templates, or request content.
        System.err.println("[safe diagnostic] reader capture failed: " + sdkDiagnostic(error));
        respond(exchange, 500, "{\"error\":\"Local reader capture failed\"}");
      }
    }
  }

  private static String extractTemplate(Capture sample, String seed2) throws Exception {
    if (sample.rawImage == null || sample.imageWidth <= 0 || sample.imageHeight <= 0
        || sample.imageResolution <= 0) {
      throw new IllegalStateException("Reader returned no usable fingerprint image.");
    }
    long extractionStarted = System.nanoTime();
    System.err.println("[safe diagnostic] starting template extraction.");
    String template = templateExtractor().extract(
        sample.rawImage, sample.imageWidth, sample.imageHeight, sample.imageResolution, seed2);
    System.err.println("[safe diagnostic] template extraction completed in "
        + ((System.nanoTime() - extractionStarted) / 1_000_000L) + " ms.");
    return template;
  }

  static String json(Capture sample, String template) {
    return "{\"quality\":"
        + sample.quality
        + ",\"livenessPassed\":"
        + sample.livenessPassed
        + ",\"rawImageBytes\":0"
        + (sample.readerIdentity == null ? "" : ",\"readerIdentity\":\""
            + jsonString(sample.readerIdentity) + "\"")
        + (template == null ? "" : ",\"template\":\"" + template + "\"")
        + "}";
  }

  static String sdkDiagnostic(Throwable error) {
    try {
      Object code = error.getClass().getMethod("getCode").invoke(error);
      if (code instanceof Integer) {
        return error.toString() + " (0x" + Integer.toHexString((Integer) code) + ")";
      }
    } catch (ReflectiveOperationException ignored) {
      // Not a vendor exception with a numeric code.
    }
    StringBuilder diagnostic = new StringBuilder(error.toString());
    Throwable cause = error.getCause();
    int depth = 0;
    while (cause != null && depth++ < 3) {
      diagnostic.append("; caused by ").append(cause);
      cause = cause.getCause();
    }
    return diagnostic.toString();
  }

  static String field(String json, String name, String fallback) {
    java.util.regex.Matcher matcher =
        java.util.regex.Pattern.compile("\\\"" + name + "\\\"\\s*:\\s*\\\"([^\\\"]+)\\\"")
            .matcher(json);
    return matcher.find() ? matcher.group(1) : fallback;
  }

  static String jsonString(String value) {
    return value.replace("\\", "\\\\").replace("\"", "\\\"");
  }

  static void respond(HttpExchange exchange, int code, String payload) {
    try {
      byte[] bytes = payload.getBytes(StandardCharsets.UTF_8);
      exchange.getResponseHeaders().set("Content-Type", "application/json; charset=utf-8");
      exchange.getResponseHeaders().set("Cache-Control", "no-store");
      exchange.sendResponseHeaders(code, bytes.length);
      try (OutputStream responseBody = exchange.getResponseBody()) {
        responseBody.write(bytes);
      }
    } catch (Exception ignored) {
      // The client may already have disconnected.
    }
  }

  @FunctionalInterface
  private interface ReaderCreator {
    FingerprintReaderManager create(boolean diagnostics, int readerNumber) throws Exception;
  }

  /** Keeps health/status endpoints alive when reader configuration cannot be initialized. */
  static final class UnavailableFingerprintReaderManager implements FingerprintReaderManager {
    private final IllegalStateException unavailable;

    UnavailableFingerprintReaderManager(Throwable cause) {
      unavailable = new IllegalStateException("Fingerprint reader manager is unavailable: "
          + (cause.getMessage() == null ? cause.getClass().getSimpleName() : cause.getMessage()), cause);
    }

    public Capture capture(int readerNumber) { throw unavailable; }
    public ReaderInfo[] listReaders() { return new ReaderInfo[0]; }
    public void prepare(int readerNumber) { throw unavailable; }
    public void close() { }
    public boolean isConnected() { return false; }
  }

  @FunctionalInterface
  private interface ReaderDiscovery {
    ReaderInfo[] discover() throws Exception;
  }

  static final class ReconnectingFingerprintReaderManager implements FingerprintReaderManager {
    private final ReaderCreator creator;
    private final ReaderDiscovery discovery;
    private FingerprintReaderManager active;
    private int activeReaderNumber = -1;
    private String unavailableReason = "No matching fingerprint reader is connected.";
    private boolean discoveryLogged;

    ReconnectingFingerprintReaderManager(ReaderCreator creator, ReaderDiscovery discovery) {
      this.creator = creator;
      this.discovery = discovery;
    }

    public Capture capture(int readerNumber) throws Exception {
      FingerprintReaderManager reader = prepareActiveReader(readerNumber);
      try {
        return reader.capture(readerNumber);
      } catch (Exception error) {
        markUnavailable(error);
        throw error;
      }
    }

    public void prepare(int readerNumber) throws Exception {
      prepareActiveReader(readerNumber);
    }

    public synchronized void close() {
      if (active != null) active.close();
      active = null;
      activeReaderNumber = -1;
    }

    public synchronized ReaderInfo[] listReaders() throws Exception {
      // Some SDKs, including vCOM, do not permit a second handle to the selected
      // device merely to refresh its label. Reuse the active manager when present.
      return active != null ? active.listReaders() : discovery.discover();
    }

    public boolean isConnected() {
      try {
        FingerprintReaderManager reader = activeReader();
        if (reader.isConnected()) return true;
        markUnavailable(new IllegalStateException("Fingerprint reader is disconnected."));
      } catch (Exception error) {
        markUnavailable(error);
      }
      return false;
    }

    private synchronized FingerprintReaderManager activeReader() throws Exception {
      if (active != null) return active;
      try {
        active = creator.create(!discoveryLogged, -1);
        activeReaderNumber = -1;
        discoveryLogged = true;
        unavailableReason = "";
        System.err.println("[safe diagnostic] fingerprint reader connected.");
        return active;
      } catch (Exception error) {
        discoveryLogged = true;
        unavailableReason = message(error);
        throw new IllegalStateException("Fingerprint reader is not connected: " + unavailableReason, error);
      }
    }

    private synchronized FingerprintReaderManager prepareActiveReader(int readerNumber) throws Exception {
      if (active != null && activeReaderNumber == readerNumber) return active;
      if (active != null) active.close();
      active = creator.create(false, readerNumber);
      activeReaderNumber = readerNumber;
      unavailableReason = "";
      return active;
    }

    private synchronized void markUnavailable(Exception error) {
      boolean hadActiveReader = active != null;
      active = null;
      activeReaderNumber = -1;
      if (hadActiveReader) discoveryLogged = false;
      unavailableReason = message(error);
    }

    private static String message(Exception error) {
      String message = error.getMessage();
      return message == null || message.isBlank() ? error.getClass().getSimpleName() : message;
    }
  }

}
