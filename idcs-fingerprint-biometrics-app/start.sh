#!/usr/bin/env sh
set -eu
cd "$(dirname "$0")"

cleanup() {
  trap - EXIT INT TERM
  kill "$app_pid" "$bridge_pid" 2>/dev/null || true
  wait "$app_pid" 2>/dev/null || true
  wait "$bridge_pid" 2>/dev/null || true
}

./bridge/run-bridge.sh &
bridge_pid=$!
node app/src/server.js &
app_pid=$!

trap cleanup EXIT INT TERM
wait "$app_pid"
