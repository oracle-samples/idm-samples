#!/usr/bin/env bash
set -euo pipefail
root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
# This is a shell-format, customer-owned file. Never load untrusted environment files.
if [[ -n "${AI_WORLD_ENV_FILE:-}" ]]; then
  set -a
  source "$AI_WORLD_ENV_FILE"
  set +a
fi
jar="${VOICE_DEMO_JAR:-$root/backend/target/ai-world-backend-0.1.0-SNAPSHOT.jar}"
if [[ -z "${VOICE_DEMO_JAR:-}" && -f "$root/app.jar" ]]; then jar="$root/app.jar"; fi
[[ -f "$jar" ]] || { echo "Application JAR missing: $jar" >&2; exit 1; }
exec java -jar "$jar"
