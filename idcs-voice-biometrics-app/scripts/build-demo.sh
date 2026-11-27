#!/usr/bin/env bash
set -euo pipefail
root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
[[ "$(node -p 'Number(process.versions.node.split(".")[0]) >= 20')" == true ]] || { echo 'Node 20+ required' >&2; exit 1; }
(
  cd "$root/frontend"
  [[ -d node_modules ]] || npm ci
  npm run typecheck
  npm test
  npm run build:release
)
args=(-B -ntp)
if [[ -n "${VOICE_MAVEN_REPOSITORY:-}" ]]; then args+=("-Dmaven.repo.local=$VOICE_MAVEN_REPOSITORY"); fi
mvn "${args[@]}" -f "$root/pom.xml" package "$@"
