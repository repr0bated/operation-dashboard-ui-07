#!/usr/bin/env bash
# Run from your MONOREPO root (not from this Lovable repo).
# Syncs the operation-dashboard-ui-07 Lovable submodule into
# crates/op-web/ui, installs npm deps there, builds, and pokes
# rust-embed so `cargo build` picks up the new dist/.
set -euo pipefail

SOURCE_DIR="operation-dashboard-ui-07"
CRATE_UI_DIR="crates/op-web/ui"

echo "🚀 Updating embedded UI crate from $SOURCE_DIR submodule..."

if [ ! -d "$SOURCE_DIR/src" ]; then
  echo "❌ $SOURCE_DIR/src missing. Run: git submodule update --init --recursive"
  exit 1
fi

mkdir -p "$CRATE_UI_DIR/src"

echo "📦 Syncing source tree..."
rsync -av --delete "$SOURCE_DIR/src/"    "$CRATE_UI_DIR/src/"
rsync -av --delete "$SOURCE_DIR/public/" "$CRATE_UI_DIR/public/" 2>/dev/null || true

# Config files Lovable may have updated
for f in index.html components.json tailwind.config.ts postcss.config.js \
         tsconfig.json tsconfig.app.json tsconfig.node.json \
         vite.config.ts eslint.config.js package.json package-lock.json; do
  [ -f "$SOURCE_DIR/$f" ] && rsync -av "$SOURCE_DIR/$f" "$CRATE_UI_DIR/$f"
done

pushd "$CRATE_UI_DIR" >/dev/null

# Ensure required libs
EXTRA=""
grep -q '"@json-render/react"' package.json || EXTRA="$EXTRA @json-render/react @json-render/core"
grep -q '"reactflow"'          package.json || EXTRA="$EXTRA reactflow"
if [ -n "$EXTRA" ]; then
  echo "📥 Installing missing deps:$EXTRA"
  npm install --save --legacy-peer-deps $EXTRA
fi

echo "📦 npm install..."
npm install --silent --legacy-peer-deps

echo "🏗  npm run build..."
npm run build

popd >/dev/null

echo "🧹 Invalidating rust-embed cache..."
touch crates/op-web/build.rs 2>/dev/null || true
touch crates/op-web/src/embedded_ui.rs 2>/dev/null || true

echo "✅ UI embedded at $CRATE_UI_DIR/dist — next 'cargo build' will pick it up."
