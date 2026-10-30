#!/usr/bin/env bash
# Copy the generated pose library to the backend and the mobile app (single source: poses/library.json).
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
SRC="$ROOT/poses/library.json"
mkdir -p "$ROOT/backend/app/data"
cp "$SRC" "$ROOT/backend/app/data/poses.json"
echo "-> backend/app/data/poses.json"
if [ -d "$ROOT/mobile" ]; then
  mkdir -p "$ROOT/mobile/src/pose"
  cp "$SRC" "$ROOT/mobile/src/pose/library.json"
  echo "-> mobile/src/pose/library.json"
fi
