#!/usr/bin/env bash
# Use a source checkout or a supplied SDK distribution without fixing its repository location.
set -euo pipefail
root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
maven_args=(-B -ntp)
if [[ -n "${VOICE_MAVEN_REPOSITORY:-}" ]]; then maven_args+=("-Dmaven.repo.local=$VOICE_MAVEN_REPOSITORY"); fi
if [[ -n "${VOICE_SDK_SOURCE:-}" ]]; then
  sdk_java="$VOICE_SDK_SOURCE/VoiceBiometrics/java"
  [[ -f "$sdk_java/pom.xml" ]] || { echo 'VOICE_SDK_SOURCE must be an SDK checkout root' >&2; exit 1; }
  mvn "${maven_args[@]}" -f "$sdk_java/pom.xml" package
  sdk_jar="$sdk_java/target/VoiceBiometrics.jar"
  sdk_pom="$sdk_java/pom.xml"
else
  : "${VOICE_SDK_JAR:?Set VOICE_SDK_SOURCE, or both VOICE_SDK_JAR and VOICE_SDK_POM}"
  : "${VOICE_SDK_POM:?Supply the POM belonging to the SDK JAR}"
  sdk_jar="$VOICE_SDK_JAR"; sdk_pom="$VOICE_SDK_POM"
fi
for input in "$sdk_jar" "$sdk_pom"; do
  [[ -f "$input" ]] || { echo "Missing SDK input: $input" >&2; exit 1; }
done
mvn "${maven_args[@]}" org.apache.maven.plugins:maven-install-plugin:3.1.3:install-file \
  "-Dfile=$sdk_jar" "-DpomFile=$sdk_pom"
echo "SDK artifact installed with its POM; no speaker model is required."
