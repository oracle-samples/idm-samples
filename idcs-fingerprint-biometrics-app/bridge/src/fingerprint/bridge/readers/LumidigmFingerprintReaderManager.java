package fingerprint.bridge.readers;

import fingerprint.bridge.model.Capture;
import fingerprint.bridge.model.ReaderInfo;
import java.util.Arrays;
import vcomexample.IStatusCallbackListener;
import vcomexample.V100_DEVICE_TRANSPORT_INFO;
import vcomexample.V100_Types;
import vcomexample.VCOMExample;

/** Lumidigm vCOM Java/JNI implementation of the local reader boundary. */
public final class LumidigmFingerprintReaderManager implements FingerprintReaderManager {
  private static final int MAX_TEMPLATE_SIZE = 2048;
  private static final int LIVE_FINGER_SPOOF_SCORE = 5;
  private static final Object LIBRARY_LOCK = new Object();
  private static volatile boolean librariesLoaded;

  private final VCOMExample vcom;
  private final V100_Types types = new V100_Types();
  private final V100_DEVICE_TRANSPORT_INFO device = new V100_DEVICE_TRANSPORT_INFO();
  private final V100_Types._V100_INTERFACE_CONFIGURATION_TYPE configuration;
  private final int readerNumber;
  private int sensorType = V100_Types.UNKNOWN_LUMI_DEVICE;
  private String readerIdentity;
  private boolean open;
  private volatile boolean connected = true;

  public LumidigmFingerprintReaderManager(boolean diagnostics, int requestedReaderNumber) throws Exception {
    vcom = VCOMExample.getInstance();
    loadLibraries(vcom);
    readerNumber = requestedReaderNumber >= 0 ? requestedReaderNumber : 0;
    if (readerNumber >= readerCount(vcom)) {
      throw new IllegalStateException("Configured Lumidigm vCOM reader is not connected.");
    }
    device.DeviceNumber = readerNumber;
    configuration = types.new _V100_INTERFACE_CONFIGURATION_TYPE();
    open();
    try {
      int configCode = vcom.V100GetConfig(device, configuration);
      logConfiguration(readerNumber, configCode, configuration);
      requireOk(configCode, "V100_Get_Config");
      readerIdentity = "vendorId=" + Integer.toUnsignedString(configuration.Vendor_Id)
          + ";productId=" + Integer.toUnsignedString(configuration.Product_Id)
          + ";serial=" + Integer.toUnsignedString(configuration.Device_Serial_Number);
      int[] detectedSensorType = {V100_Types.UNKNOWN_LUMI_DEVICE};
      int sensorTypeCode = vcom.V100GetSensorType(device, detectedSensorType);
      logSensorType(readerNumber, sensorTypeCode, detectedSensorType[0]);
      requireOk(sensorTypeCode, "V100_Get_Sensor_Type");
      sensorType = detectedSensorType[0];
      ensureSpoofDetectionEnabled();
      if (diagnostics) System.err.println("[safe diagnostic] selected Lumidigm vCOM reader #"
          + readerNumber + ": " + summary(sensorType));
    } catch (Exception error) {
      close();
      throw error;
    }
  }

  @Override
  public synchronized Capture capture(int ignoredReaderNumber) throws Exception {
    try {
      open();
      int width = configuration.Composite_Image_Size_X;
      int height = configuration.Composite_Image_Size_Y;
      int resolution = configuration.Composite_DPI;
      if (width <= 0 || height <= 0 || resolution <= 0) {
        throw new IllegalStateException("Lumidigm reader returned invalid composite-image metadata.");
      }
      byte[] image = new byte[Math.multiplyExact(width, height)];
      byte[] unusedTemplate = new byte[MAX_TEMPLATE_SIZE];
      int[] returnedWidth = {width};
      int[] returnedHeight = {height};
      int[] templateSize = {0};
      int[] spoof = {-1};
      int[] lastStatus = {-1};
      int[] failedStatus = {-1};
      try {
        System.err.println("[safe diagnostic] Place your finger on the Lumidigm scanner.");
        IStatusCallbackListener callback = status -> {
          lastStatus[0] = status;
          if (status == V100_Types.ACQ_TIMEOUT
              || status == V100_Types.ACQ_CANCELLED_BY_USER
              || status == V100_Types.ACQ_LATENT_DETECTED
              || (status >= V100_Types.ACQ_SPOOF_DETECTED
                  && status <= V100_Types.ACQ_ERROR_PARAMETER)) {
            failedStatus[0] = status;
          }
          return 0;
        };
        int code = vcom.V100CaptureCb(device, image, returnedWidth, returnedHeight,
            unusedTemplate, templateSize, spoof, 1, 0, callback);
        System.err.println("[safe diagnostic] Lumidigm vCOM capture returned: "
            + V100_Types.getGeneralErrorCodeString(code) + "; lastStatus="
            + acquisitionStatus(lastStatus[0]) + "; failedStatus="
            + acquisitionStatus(failedStatus[0]) + "; spoofScore=" + spoof[0]);
        Capture capture = new Capture();
        if (failedStatus[0] == V100_Types.ACQ_LATENT_DETECTED
            || failedStatus[0] == V100_Types.ACQ_SPOOF_DETECTED
            || code == V100_Types.GEN_ERROR_SPOOF_DETECTED
            || code == V100_Types.GEN_ERROR_TIMEOUT_LATENT) {
          capture.livenessPassed = false;
          capture.quality = 0;
          return capture;
        }
        if (failedStatus[0] == V100_Types.ACQ_CANCELLED_BY_USER
            || code == V100_Types.GEN_ERROR_CAPTURE_CANCELLED) {
          throw new IllegalStateException("Fingerprint capture was cancelled.");
        }
        if (failedStatus[0] == V100_Types.ACQ_TIMEOUT
            || code == V100_Types.GEN_ERROR_TIMEOUT) {
          throw new IllegalStateException("Timed out waiting for fingerprint input.");
        }
        requireOk(code, "V100_Capture_Cb");
        if (failedStatus[0] >= 0 || lastStatus[0] != V100_Types.ACQ_DONE) {
          throw new IllegalStateException("Lumidigm did not complete fingerprint acquisition.");
        }
        // PLT-05491 B.3 p.14:
        // The HID Global V31x-01-01 and V52x-01-01 sensors include very strong ISO 30107-3 Level 2 compliant presentation
        // attack detection for unsupervised applications or applications where there is a high threat of fake fingers being used.
        // The sensors will return one of two scores: 5 for real fingers or 5050 for fake fingers.
        if (spoof[0] != LIVE_FINGER_SPOOF_SCORE) {
          System.err.println("[safe diagnostic] Lumidigm vCOM spoof check rejected capture; score="
              + spoof[0] + ".");
          capture.livenessPassed = false;
          capture.quality = 0;
          return capture;
        }
        if (returnedWidth[0] <= 0 || returnedHeight[0] <= 0
            || returnedWidth[0] > width || returnedHeight[0] > height) {
          throw new IllegalStateException("Lumidigm reader returned invalid capture dimensions.");
        }
        int imageSize = Math.multiplyExact(returnedWidth[0], returnedHeight[0]);
        capture.quality = 100;
        capture.livenessPassed = true;
        capture.rawImage = imageSize == image.length ? image : Arrays.copyOf(image, imageSize);
        image = null; // The bridge owns and clears this copy after template extraction.
        capture.imageWidth = returnedWidth[0];
        capture.imageHeight = returnedHeight[0];
        capture.imageResolution = resolution;
        capture.readerIdentity = readerIdentity;
        System.err.println("[safe diagnostic] Lumidigm vCOM image metadata: width="
            + capture.imageWidth + "; height=" + capture.imageHeight + "; resolution="
            + capture.imageResolution + "; bytes=" + capture.rawImage.length);
        return capture;
      } finally {
        if (image != null) Arrays.fill(image, (byte) 0);
        Arrays.fill(unusedTemplate, (byte) 0);
      }
    } catch (Exception error) {
      connected = false;
      throw error;
    }
  }

  private static String acquisitionStatus(int status) {
    return status < 0 ? "none" : V100_Types.getAcqStatusString(status) + " (" + status + ")";
  }

  @Override
  public synchronized ReaderInfo[] listReaders() throws Exception {
    int count = readerCount(vcom);
    ReaderInfo[] readers = new ReaderInfo[count];
    for (int index = 0; index < count; index++) {
      String label = index == readerNumber
          ? summary(sensorType)
          : readerSummary(vcom, index);
      readers[index] = new ReaderInfo(String.valueOf(index), label);
    }
    return readers;
  }

  public static ReaderInfo[] discoverReaders() throws Exception {
    VCOMExample api = VCOMExample.getInstance();
    loadLibraries(api);
    int count = readerCount(api);
    ReaderInfo[] readers = new ReaderInfo[count];
    for (int index = 0; index < count; index++) {
      readers[index] = new ReaderInfo(String.valueOf(index), readerSummary(api, index));
    }
    return readers;
  }

  @Override public synchronized void prepare(int ignoredReaderNumber) throws Exception { open(); }

  @Override
  public synchronized boolean isConnected() {
    try {
      return connected = readerCount(vcom) > readerNumber;
    } catch (Exception error) {
      connected = false;
      return false;
    }
  }

  @Override
  public synchronized void close() {
    if (!open) return;
    try { vcom.V100Close(device); } catch (Exception ignored) { connected = false; }
    finally { open = false; }
  }

  private void open() throws Exception {
    if (open) return;
    // Use the extended open for the selected V52X reader so vCOM establishes
    // the session key used for encrypted communication with the device.
    requireOk(vcom.V100OpenEx(device), "V100_Open_Ex");
    open = true;
    connected = true;
  }

  /**
   * Fail closed unless the reader confirms presence triggering, preprocessing,
   * and PAD are enabled. V100_Set_Cmd writes the complete command structure, so
   * always populate it with V100_Get_Cmd before changing these fields.
   */
  private void ensureSpoofDetectionEnabled() throws Exception {
    if (configuration.Spoof_Available == 0 || configuration.PreProc_Available == 0) {
      throw new IllegalStateException(
          "Lumidigm spoof detection and image preprocessing must be available.");
    }

    V100_Types._V100_INTERFACE_COMMAND_TYPE command =
        types.new _V100_INTERFACE_COMMAND_TYPE();
    requireOk(vcom.V100GetCmd(device, command), "V100_Get_Cmd");
    command.Override_Trigger = 0;
    command.Select_PreProc = 1;
    command.Select_Spoof_Model = 1;
    requireOk(vcom.V100SetCmd(device, command), "V100_Set_Cmd (enable capture checks)");

    V100_Types._V100_INTERFACE_COMMAND_TYPE verified =
        types.new _V100_INTERFACE_COMMAND_TYPE();
    requireOk(vcom.V100GetCmd(device, verified), "V100_Get_Cmd (verify capture checks)");
    if (verified.Override_Trigger != 0 || verified.Select_PreProc != 1
        || verified.Select_Spoof_Model != 1) {
      throw new IllegalStateException("Lumidigm capture checks could not be enabled.");
    }
    System.err.println("[safe diagnostic] Lumidigm vCOM capture checks enabled and verified"
        + "; preProcessorCapability=" + configuration.PreProc_Available
        + "; spoofCapability=" + configuration.Spoof_Available
        + "; overrideTrigger=" + verified.Override_Trigger
        + "; selectedPreProcessor=" + verified.Select_PreProc
        + "; selectedSpoofModel=" + verified.Select_Spoof_Model + ".");
  }

  private static int readerCount(VCOMExample api) throws Exception {
    int[] count = {0};
    requireOk(api.V100GetNumUSBDevices(count), "V100_Get_Num_USB_Devices");
    return Math.max(count[0], 0);
  }

  private static String readerSummary(VCOMExample api, int index) throws Exception {
    V100_DEVICE_TRANSPORT_INFO info = new V100_DEVICE_TRANSPORT_INFO();
    info.DeviceNumber = index;
    requireOk(api.V100OpenEx(info), "V100_Open_Ex");
    try {
      V100_Types types = new V100_Types();
      V100_Types._V100_INTERFACE_CONFIGURATION_TYPE config =
          types.new _V100_INTERFACE_CONFIGURATION_TYPE();
      int configCode = api.V100GetConfig(info, config);
      logConfiguration(index, configCode, config);
      requireOk(configCode, "V100_Get_Config");
      int[] sensorType = {V100_Types.UNKNOWN_LUMI_DEVICE};
      int sensorTypeCode = api.V100GetSensorType(info, sensorType);
      logSensorType(index, sensorTypeCode, sensorType[0]);
      requireOk(sensorTypeCode, "V100_Get_Sensor_Type");
      return summary(sensorType[0]);
    } finally { api.V100Close(info); }
  }

  private static String summary(int sensorType) {
    return "Lumidigm " + V100_Types.GetSensorTypeStr(sensorType);
  }

  private static void logConfiguration(int index, int code,
      V100_Types._V100_INTERFACE_CONFIGURATION_TYPE config) {
    System.err.println("[safe diagnostic] Lumidigm vCOM V100GetConfig reader #" + index
        + ": result=" + resultCode(code)
        + "; vendorId=" + config.Vendor_Id
        + "; productId=" + config.Product_Id
        + "; deviceSerial=" + Integer.toUnsignedString(config.Device_Serial_Number)
        + "; extendedSerial=" + Integer.toUnsignedString(config.Device_Serial_Number_Ex)
        + "; hardwareRev=" + config.Hardware_Rev
        + "; firmwareRev=" + config.Firmware_Rev
        + "; spoofRev=" + config.Spoof_Rev
        + "; preProcessorRev=" + config.PreProc_Rev
        + "; featureExtractorRev=" + config.Feature_Extractor_Rev
        + "; matcherRev=" + config.Matcher_Rev
        + "; identifierRev=" + config.ID_Rev
        + "; imagerChipVersion=" + config.Imager_Chip_Version
        + "; imagePlanes=" + config.Number_Image_Planes
        + "; nativeImage=" + config.Native_Image_Size_X + "x" + config.Native_Image_Size_Y
        + "@" + config.Native_DPI
        + "; compositeImage=" + config.Composite_Image_Size_X + "x"
        + config.Composite_Image_Size_Y + "@" + config.Composite_DPI
        + "; imageFormat=" + config.Image_Format
        + "; physicalInterfaces=" + config.Phy_Interface_Available
        + "; preProcessors=" + config.PreProc_Available
        + "; featureExtractors=" + config.Feature_Extract_Available
        + "; templateMatchers=" + config.Template_Match_Available
        + "; templateFormats=" + config.Template_Format_Available
        + "; templateIdentification=" + config.Template_ID_Available
        + "; presenceDetection=" + config.Presence_Detect_Available
        + "; firmwareFlash=" + config.FW_Flash_Available
        + "; spoofCapability=" + config.Spoof_Available
        + "; configurationType=" + config.Device_Cfg_Type
        + "; structSize=" + config.Struct_Size + ".");
  }

  private static void logSensorType(int index, int code, int sensorType) {
    System.err.println("[safe diagnostic] Lumidigm vCOM V100GetSensorType reader #" + index
        + ": result=" + resultCode(code) + "; sensorType=" + sensorType
        + " (" + V100_Types.GetSensorTypeStr(sensorType) + ").");
  }

  private static String resultCode(int code) {
    return V100_Types.getGeneralErrorCodeString(code) + " (0x"
        + Integer.toHexString(code) + ")";
  }

  private static void loadLibraries(VCOMExample api) throws Exception {
    if (librariesLoaded) return;
    synchronized (LIBRARY_LOCK) {
      if (librariesLoaded) return;
      String directoryValue = System.getenv("VCOM_LIBRARY_DIR");
      if (directoryValue == null || directoryValue.isBlank()) {
        throw new IllegalStateException("VCOM_LIBRARY_DIR must name the directory containing VCOMExample.dll and VCOMExampleJNIWrapper.dll.");
      }
      java.nio.file.Path directory = java.nio.file.Path.of(directoryValue);
      java.nio.file.Path vcomLibrary = directory.resolve("VCOMExample.dll");
      java.nio.file.Path wrapperLibrary = directory.resolve("VCOMExampleJNIWrapper.dll");
      if (!java.nio.file.Files.isRegularFile(vcomLibrary) || !java.nio.file.Files.isRegularFile(wrapperLibrary)) {
        throw new IllegalStateException("VCOM_LIBRARY_DIR must contain VCOMExample.dll and VCOMExampleJNIWrapper.dll.");
      }
      int code = api.loadLibs(vcomLibrary.toString(), wrapperLibrary.toString());
      if (code != V100_Types.GEN_OK && code != V100_Types.ERROR_LIBS_ALREADY_LOADED) {
        throw new IllegalStateException("Unable to load Lumidigm vCOM native libraries: "
            + V100_Types.getGeneralErrorCodeString(code));
      }
      librariesLoaded = true;
    }
  }

  private static void requireOk(int code, String operation) throws Exception {
    if (code != V100_Types.GEN_OK) throw new IllegalStateException(operation + " failed: "
        + V100_Types.getGeneralErrorCodeString(code) + " (0x" + Integer.toHexString(code) + ")");
  }
}
