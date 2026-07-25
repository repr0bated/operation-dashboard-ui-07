#!/usr/bin/env bash
# Build this dashboard and install into op-web's static dir.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")" && pwd)"
DEST="${OP_WEB_STATIC_DIR:-/usr/local/share/op-dbus/dashboard}"

cd "$ROOT"
npm install --legacy-peer-deps --silent
npm run build

if [ -w "$DEST" ] || [ "$(id -u)" = 0 ]; then
  rsync -a --delete "$ROOT/dist/" "$DEST/"
else
  sudo rsync -a --delete "$ROOT/dist/" "$DEST/"
fi
echo "✅ Deployed $ROOT/dist → $DEST"
echo "   Open http://127.0.0.1:8080/  (op-web) or npm run dev → :5173"
