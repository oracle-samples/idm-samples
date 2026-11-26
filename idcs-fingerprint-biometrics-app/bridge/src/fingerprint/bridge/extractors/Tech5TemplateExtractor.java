package fingerprint.bridge.extractors;

import Tech5.OmniMatch.JNI.CoreNative;
import Tech5.OmniMatch.JNI.OmniMatchException;
import Tech5.OmniMatch.JNI.TemplateCreator.TemplateCreatorInstance;
import Tech5.OmniMatch.JNI.TemplateCreator.TemplateCreatorNative;
import Tech5.OmniMatch.T5OmBioCommon.BioType;
import Tech5.OmniMatch.T5OmBioCommon.NnAlgorithm;
import Tech5.OmniMatch.T5OmBioCommon.TemplateType;
import Tech5.OmniMatch.T5OmCommon.BaseConfiguration;
import Tech5.OmniMatch.T5OmCommon.BatchConfiguration;
import Tech5.OmniMatch.T5OmCommon.Image;
import Tech5.OmniMatch.T5OmCommon.ImageFormat;
import Tech5.OmniMatch.T5OmCommon.License;
import Tech5.OmniMatch.T5OmCommon.PixelFormat;
import Tech5.OmniMatch.T5OmCommon.ResultCode;
import Tech5.OmniMatch.T5OmCommon.WorkingFolder;
import Tech5.OmniMatch.T5OmFingerCommon.FingerNnAlgorithm;
import Tech5.OmniMatch.T5OmTemplateCreator.CreateTemplateRequest;
import Tech5.OmniMatch.T5OmTemplateCreator.CreateTemplateResponse;
import Tech5.OmniMatch.T5OmTemplateCreator.TemplateCreatorConfiguration;
import com.google.protobuf.ByteString;
import java.io.ByteArrayOutputStream;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.Arrays;
import java.util.Base64;

/** Creates Tech5 ChiFinger_100Btp templates from grayscale fingerprint captures. */
public final class Tech5TemplateExtractor implements TemplateExtractor {
  private final TemplateCreatorNative nativeCreator;
  private final TemplateCreatorInstance instance;

  public Tech5TemplateExtractor() throws Exception {
    System.err.println("[safe diagnostic] initializing Tech5 BTP template creator.");
    System.err.println("[safe diagnostic] loading Tech5 JNI template creator.");
    nativeCreator = new TemplateCreatorNative();
    System.err.println("[safe diagnostic] Tech5 JNI template creator loaded.");
    Path license = requiredFile("TECH5_LICENSE_FILE");
    Path workingFolder = requiredDirectory("TECH5_BTP_DIR");
    long seed1 = seed("TECH5_BTP_SEED1");

    CoreNative core = new CoreNative();
    System.err.println("[safe diagnostic] applying Tech5 license.");
    requireSuccess(core.SetLicense(License.newBuilder().setFileName(license.getFileName().toString()).build()), "Tech5 license");
    System.err.println("[safe diagnostic] setting Tech5 working folder.");
    requireSuccess(core.SetWorkingFolder(WorkingFolder.newBuilder().setPath(workingFolder.toString()).build()), "Tech5 working folder");

    System.err.println("[safe diagnostic] creating Tech5 BTP template creator instance.");
    instance = nativeCreator.CreateInstance(TemplateCreatorConfiguration.newBuilder()
        .setBioType(BioType.Finger)
        .setTemplateType(TemplateType.TemplateNn)
        .setNnAlgorithm(NnAlgorithm.newBuilder().setFinger(FingerNnAlgorithm.ChiFinger_100Btp).build())
        .setNnProtectionSeed(seed1)
        .setBase(BaseConfiguration.newBuilder().setDebugMode(false).setThreadsNumber(1).build())
        .setBatch(BatchConfiguration.newBuilder().setBatchSize(1).build())
        .build());
    System.err.println("[safe diagnostic] Tech5 BTP template creator initialized.");
  }

  public synchronized String extract(byte[] raw, int width, int height, int resolution, String seed2)
      throws Exception {
    if (raw == null || raw.length == 0 || width <= 0 || height <= 0 || raw.length != width * height) {
      throw new IllegalArgumentException("Fingerprint capture does not contain a valid grayscale image.");
    }
    long pin = seed2(seed2);
    byte[] bmp = grayscaleBmp(raw, width, height);
    Image image;
    try {
      image = Image.newBuilder()
          .setBytes(ByteString.copyFrom(bmp))
          .setFormat(ImageFormat.BMP)
          .setResolution(resolution)
          .build();
    } finally {
      Arrays.fill(bmp, (byte) 0);
    }
    CreateTemplateResponse response = nativeCreator.CreateTemplate(
        instance, CreateTemplateRequest.newBuilder().addImages(image).build());
    if (response.getResultsCount() != 1 || response.getResults(0).getErrorCode() != ResultCode.Success) {
      String result = response.getResultsCount() == 0
          ? "no result"
          : String.valueOf(response.getResults(0).getErrorCode());
      throw new IllegalStateException("Tech5 BTP template creation failed: " + result);
    }
    byte[] seed1Template = response.getResults(0).getTemplateResult().getTemplate().getData().toByteArray();
    try {
      Tech5.OmniMatch.T5OmTemplateCreator.ProtectTemplateWithPinResponse protectedResponse =
          nativeCreator.ProtectTemplateWithPin(instance,
              Tech5.OmniMatch.T5OmTemplateCreator.ProtectTemplateWithPinRequest.newBuilder()
                  .setProtectedTemplate(Tech5.OmniMatch.T5OmBioCommon.Template.newBuilder()
                      .setData(ByteString.copyFrom(seed1Template)).build())
                  .setPinCode(pin).build());
      if (protectedResponse.getResultCase()
          != Tech5.OmniMatch.T5OmTemplateCreator.ProtectTemplateWithPinResponse.ResultCase.PROTECTEDTEMPLATE) {
        throw new IllegalStateException("Tech5 BTP SEED2 protection failed.");
      }
      byte[] protectedTemplate = protectedResponse.getProtectedTemplate().getData().toByteArray();
      try { return Base64.getEncoder().encodeToString(protectedTemplate); }
      finally { Arrays.fill(protectedTemplate, (byte) 0); }
    } finally {
      Arrays.fill(seed1Template, (byte) 0);
    }
  }

  private static Path requiredFile(String name) {
    Path path = Path.of(required(name));
    if (!Files.isRegularFile(path)) throw new IllegalStateException(name + " is not a readable file.");
    return path;
  }
  private static Path requiredDirectory(String name) {
    Path path = Path.of(required(name));
    if (!Files.isDirectory(path) || !Files.isDirectory(path.resolve("models"))) {
      throw new IllegalStateException(name + " must contain the Tech5 models directory.");
    }
    return path;
  }
  private static String required(String name) {
    String value = System.getenv(name);
    if (value == null || value.isBlank()) throw new IllegalStateException(name + " must be configured.");
    return value;
  }
  private static long seed(String name) { return seed2(required(name)); }
  private static long seed2(String value) {
    if (value == null || !value.matches("[0-9]{1,19}")) throw new IllegalArgumentException("BTP SEED2 must be a positive integer.");
    try { return Long.parseLong(value); }
    catch (NumberFormatException error) { throw new IllegalArgumentException("BTP seed is outside the supported range."); }
  }
  private static void requireSuccess(ResultCode code, String operation) throws OmniMatchException {
    if (code != ResultCode.Success) throw new IllegalStateException(operation + " failed: " + code);
  }

  /** Encodes an 8-bit grayscale raster as a BMP entirely in memory for Tech5 input. */
  private static byte[] grayscaleBmp(byte[] raw, int width, int height) {
    int rowBytes = (width + 3) & ~3;
    int pixelsSize = rowBytes * height;
    byte[] bmp = new byte[14 + 40 + 1024 + pixelsSize];
    putAscii(bmp, 0, "BM");
    putInt(bmp, 2, bmp.length);
    putInt(bmp, 10, 14 + 40 + 1024);
    putInt(bmp, 14, 40);
    putInt(bmp, 18, width);
    putInt(bmp, 22, height);
    putShort(bmp, 26, 1);
    putShort(bmp, 28, 8);
    putInt(bmp, 34, pixelsSize);
    for (int value = 0; value < 256; value++) {
      int offset = 54 + value * 4;
      bmp[offset] = (byte) value;
      bmp[offset + 1] = (byte) value;
      bmp[offset + 2] = (byte) value;
    }
    int pixelOffset = 14 + 40 + 1024;
    for (int row = 0; row < height; row++) {
      System.arraycopy(raw, (height - 1 - row) * width, bmp, pixelOffset + row * rowBytes, width);
    }
    return bmp;
  }

  private static void putAscii(byte[] target, int offset, String value) {
    target[offset] = (byte) value.charAt(0);
    target[offset + 1] = (byte) value.charAt(1);
  }
  private static void putShort(byte[] target, int offset, int value) {
    target[offset] = (byte) value;
    target[offset + 1] = (byte) (value >>> 8);
  }
  private static void putInt(byte[] target, int offset, int value) {
    for (int index = 0; index < 4; index++) target[offset + index] = (byte) (value >>> (index * 8));
  }
}
