#!/usr/bin/env bash
set -euo pipefail
root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
# This is a shell-format, customer-owned file. Never load untrusted environment files.
env_file="${VOICE_BIOMETRIC_ENV_FILE:-$root/.env}"
[[ -f "$env_file" && -r "$env_file" ]] || { echo 'Environment file missing or unreadable: configure .env or set VOICE_BIOMETRIC_ENV_FILE' >&2; exit 1; }
set -a
source "$env_file"
set +a
jar="${VOICE_BIOMETRIC_JAR:-$root/backend/target/ai-world-backend-0.1.0-SNAPSHOT.jar}"
if [[ -z "${VOICE_BIOMETRIC_JAR:-}" && -f "$root/app.jar" ]]; then jar="$root/app.jar"; fi
[[ -f "$jar" ]] || { echo "Application JAR missing: $jar. Build the source first." >&2; exit 1; }
exec java -jar "$jar"
