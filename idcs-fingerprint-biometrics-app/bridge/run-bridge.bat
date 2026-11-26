@echo off
setlocal EnableExtensions EnableDelayedExpansion
cd /d "%~dp0"

set "FINGERPRINT_READER=mock"
set "FINGERPRINT_TEMPLATE_EXTRACTOR=mock"
set "BRIDGE_PORT=7071"

if exist "..\.env" (
  for /f "usebackq tokens=1,* delims==" %%A in ("..\.env") do (
    if /I "%%A"=="FINGERPRINT_READER" set "FINGERPRINT_READER=%%B"
    if /I "%%A"=="FINGERPRINT_TEMPLATE_EXTRACTOR" set "FINGERPRINT_TEMPLATE_EXTRACTOR=%%B"
    if /I "%%A"=="BRIDGE_PORT" set "BRIDGE_PORT=%%B"
    if /I "%%A"=="VCOM_JAVA_API_DIR" set "VCOM_JAVA_API_DIR=%%B"
    if /I "%%A"=="VCOM_LIBRARY_DIR" set "VCOM_LIBRARY_DIR=%%B"
    if /I "%%A"=="TECH5_SDK_DIR" set "TECH5_SDK_DIR=%%B"
    if /I "%%A"=="TECH5_BTP_DIR" set "TECH5_BTP_DIR=%%B"
    if /I "%%A"=="TECH5_LICENSE_FILE" set "TECH5_LICENSE_FILE=%%B"
    if /I "%%A"=="TECH5_BTP_SEED1" set "TECH5_BTP_SEED1=%%B"
  )
)

if /I not "!FINGERPRINT_READER!"=="mock" if /I not "!FINGERPRINT_READER!"=="lumidigm" (
  echo Unsupported FINGERPRINT_READER value: !FINGERPRINT_READER!
  echo Use mock or lumidigm.
  exit /b 1
)
if /I not "!FINGERPRINT_TEMPLATE_EXTRACTOR!"=="mock" if /I not "!FINGERPRINT_TEMPLATE_EXTRACTOR!"=="tech5" (
  echo Unsupported FINGERPRINT_TEMPLATE_EXTRACTOR value: !FINGERPRINT_TEMPLATE_EXTRACTOR!
  echo Use mock or tech5.
  exit /b 1
)

set "SOURCES=src\fingerprint\bridge\FingerprintBridge.java src\fingerprint\bridge\model\Capture.java src\fingerprint\bridge\model\ReaderInfo.java src\fingerprint\bridge\readers\FingerprintReaderManager.java src\fingerprint\bridge\readers\MockFingerprintReaderManager.java src\fingerprint\bridge\extractors\TemplateExtractor.java src\fingerprint\bridge\extractors\MockTemplateExtractor.java"
set "COMPILE_CP="
set "RUNTIME_CP=%~dp0out"
set "NATIVE_PATH="

if /I "!FINGERPRINT_READER!"=="lumidigm" (
  if "!VCOM_JAVA_API_DIR!"=="" (
    echo VCOM_JAVA_API_DIR must be set in .env when FINGERPRINT_READER=lumidigm.
    exit /b 1
  )
  set "VCOM_JAVA_SRC=!VCOM_JAVA_API_DIR!\src\vcomexample"
  if not exist "!VCOM_JAVA_SRC!\VCOMExample.java" (
    echo vCOM Java API sources not found: !VCOM_JAVA_SRC!
    exit /b 1
  )
  set "SOURCES=!SOURCES! src\fingerprint\bridge\readers\LumidigmFingerprintReaderManager.java "!VCOM_JAVA_SRC!\IStatusCallbackListener.java" "!VCOM_JAVA_SRC!\V100_DEVICE_TRANSPORT_INFO.java" "!VCOM_JAVA_SRC!\V100_Types.java" "!VCOM_JAVA_SRC!\VCOMExample.java""

  if "!VCOM_LIBRARY_DIR!"=="" (
    echo WARNING: VCOM_LIBRARY_DIR is not set. The bridge will start with the Lumidigm reader unavailable.
  ) else (
    if not exist "!VCOM_LIBRARY_DIR!\VCOMExample.dll" (
      echo WARNING: VCOMExample.dll not found in !VCOM_LIBRARY_DIR!. The bridge will remain available.
    )
    if not exist "!VCOM_LIBRARY_DIR!\VCOMExampleJNIWrapper.dll" (
      echo WARNING: VCOMExampleJNIWrapper.dll not found in !VCOM_LIBRARY_DIR!. The bridge will remain available.
    )
  )
)

if /I "!FINGERPRINT_TEMPLATE_EXTRACTOR!"=="tech5" (
  if "!TECH5_SDK_DIR!"=="" (
    echo TECH5_SDK_DIR must be set in .env when FINGERPRINT_TEMPLATE_EXTRACTOR=tech5.
    exit /b 1
  )
  set "TECH5_JAR=!TECH5_SDK_DIR!\Tech5OmniMatchJavaWrapper-6.10.0.jar"
  if not exist "!TECH5_JAR!" (
    echo Tech5 Java wrapper not found: !TECH5_JAR!
    exit /b 1
  )
  if "!TECH5_BTP_DIR!"=="" (
    echo TECH5_BTP_DIR must be set in .env when using the Tech5 template extractor.
    exit /b 1
  )
  if not exist "!TECH5_BTP_DIR!\models" (
    echo Tech5 models directory not found: !TECH5_BTP_DIR!\models
    exit /b 1
  )
  if "!TECH5_LICENSE_FILE!"=="" (
    echo TECH5_LICENSE_FILE must be set in .env when using the Tech5 template extractor.
    exit /b 1
  )
  if not exist "!TECH5_LICENSE_FILE!" (
    echo Tech5 license file not found: !TECH5_LICENSE_FILE!
    exit /b 1
  )
  if "!TECH5_BTP_SEED1!"=="" (
    echo TECH5_BTP_SEED1 must be set in .env when using the Tech5 template extractor.
    exit /b 1
  )
  set "SOURCES=!SOURCES! src\fingerprint\bridge\extractors\Tech5TemplateExtractor.java"
  if defined COMPILE_CP (
    set "COMPILE_CP=!COMPILE_CP!;!TECH5_JAR!"
  ) else (
    set "COMPILE_CP=!TECH5_JAR!"
  )
  set "RUNTIME_CP=!RUNTIME_CP!;!TECH5_JAR!"
  if defined NATIVE_PATH (
    set "NATIVE_PATH=!NATIVE_PATH!;!TECH5_SDK_DIR!"
  ) else (
    set "NATIVE_PATH=!TECH5_SDK_DIR!"
  )
)

if exist "%~dp0out" rmdir /s /q "%~dp0out"
mkdir "%~dp0out"

if defined COMPILE_CP (
  javac --add-modules jdk.httpserver -cp "!COMPILE_CP!" -d "%~dp0out" !SOURCES!
) else (
  javac --add-modules jdk.httpserver -d "%~dp0out" !SOURCES!
)
if errorlevel 1 exit /b 1

if /I "!FINGERPRINT_READER!"=="lumidigm" if defined VCOM_LIBRARY_DIR set "PATH=!VCOM_LIBRARY_DIR!;!PATH!"
if /I "!FINGERPRINT_TEMPLATE_EXTRACTOR!"=="tech5" (
  set "PATH=!TECH5_SDK_DIR!;!PATH!"
  pushd "!TECH5_BTP_DIR!"
)

if defined NATIVE_PATH (
  java --add-modules jdk.httpserver -Djava.library.path="!NATIVE_PATH!" -cp "!RUNTIME_CP!" fingerprint.bridge.FingerprintBridge !BRIDGE_PORT!
) else (
  java --add-modules jdk.httpserver -cp "!RUNTIME_CP!" fingerprint.bridge.FingerprintBridge !BRIDGE_PORT!
)
set "BRIDGE_EXIT=!errorlevel!"

if /I "!FINGERPRINT_TEMPLATE_EXTRACTOR!"=="tech5" popd
exit /b !BRIDGE_EXIT!
