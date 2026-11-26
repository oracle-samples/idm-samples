#!/usr/bin/env sh
set -eu

cd "$(dirname "$0")"

FINGERPRINT_READER=mock
FINGERPRINT_TEMPLATE_EXTRACTOR=mock
BRIDGE_PORT=7071

if [ -f ../.env ]; then
  configured_reader=$(sed -n 's/^FINGERPRINT_READER=//p' ../.env | tail -n 1)
  configured_extractor=$(sed -n 's/^FINGERPRINT_TEMPLATE_EXTRACTOR=//p' ../.env | tail -n 1)
  configured_port=$(sed -n 's/^BRIDGE_PORT=//p' ../.env | tail -n 1)
  [ -z "$configured_reader" ] || FINGERPRINT_READER=$configured_reader
  [ -z "$configured_extractor" ] || FINGERPRINT_TEMPLATE_EXTRACTOR=$configured_extractor
  [ -z "$configured_port" ] || BRIDGE_PORT=$configured_port
fi

export FINGERPRINT_READER FINGERPRINT_TEMPLATE_EXTRACTOR

if [ "$FINGERPRINT_READER" != "mock" ] || [ "$FINGERPRINT_TEMPLATE_EXTRACTOR" != "mock" ]; then
  echo "run-bridge.sh supports mock/mock only; use run-bridge.bat on Windows for Lumidigm vCOM and Tech5."
  exit 1
fi

mkdir -p out
javac --add-modules jdk.httpserver -d out \
  src/fingerprint/bridge/FingerprintBridge.java \
  src/fingerprint/bridge/model/Capture.java \
  src/fingerprint/bridge/model/ReaderInfo.java \
  src/fingerprint/bridge/readers/FingerprintReaderManager.java \
  src/fingerprint/bridge/readers/MockFingerprintReaderManager.java \
  src/fingerprint/bridge/extractors/TemplateExtractor.java \
  src/fingerprint/bridge/extractors/MockTemplateExtractor.java

exec java --add-modules jdk.httpserver -cp out fingerprint.bridge.FingerprintBridge "$BRIDGE_PORT"
