#!/usr/bin/env bash
set -euo pipefail

# Start a headless Wayland compositor and run ZeroClaw against it.
# Requires `weston` to be installed on the host.

if ! command -v weston >/dev/null 2>&1; then
  echo "weston is required for headless Wayland mode" >&2
  exit 1
fi

export XDG_RUNTIME_DIR="${XDG_RUNTIME_DIR:-/tmp/zeroclaw-runtime}"
mkdir -p "$XDG_RUNTIME_DIR"
chmod 700 "$XDG_RUNTIME_DIR"

export WAYLAND_DISPLAY="${WAYLAND_DISPLAY:-zeroclaw-wayland}"

cleanup() {
  if [[ -n "${WESTON_PID:-}" ]] && kill -0 "$WESTON_PID" >/dev/null 2>&1; then
    kill "$WESTON_PID" >/dev/null 2>&1 || true
    wait "$WESTON_PID" >/dev/null 2>&1 || true
  fi
}
trap cleanup EXIT INT TERM

weston \
  --backend=headless-backend.so \
  --socket="$WAYLAND_DISPLAY" \
  --idle-time=0 \
  >/tmp/zeroclaw-weston.log 2>&1 &
WESTON_PID=$!

for _ in $(seq 1 50); do
  if [[ -S "${XDG_RUNTIME_DIR}/${WAYLAND_DISPLAY}" ]]; then
    break
  fi
  sleep 0.1
done

if [[ ! -S "${XDG_RUNTIME_DIR}/${WAYLAND_DISPLAY}" ]]; then
  echo "Wayland socket was not created at ${XDG_RUNTIME_DIR}/${WAYLAND_DISPLAY}" >&2
  echo "See /tmp/zeroclaw-weston.log for compositor output" >&2
  exit 1
fi

exec cargo run --release
