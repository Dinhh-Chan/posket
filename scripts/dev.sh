#!/usr/bin/env bash
# Run the PoseCam backend for development on port 8020 (auto-reload on code changes).
#
#   scripts/dev.sh
#
# Installs/updates the Python dependencies with uv, downloads the MediaPipe models on first run,
# then starts uvicorn from backend/. Settings come from the environment (see backend/app/config.py):
# POSECAM_DATA_DIR, POSECAM_SECRET, POSECAM_MODELS_DIR, POSECAM_DETECTOR (mediapipe | off).
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
BACKEND="$ROOT/backend"
PORT=8020

if ! command -v uv >/dev/null 2>&1; then
  echo "error: uv is required (https://docs.astral.sh/uv/getting-started/installation/)" >&2
  exit 1
fi

cd "$BACKEND"
unset VIRTUAL_ENV  # always use backend/.venv, not whatever virtualenv the shell has active

uv sync --quiet

if [[ "${POSECAM_DETECTOR:-mediapipe}" != "off" ]]; then
  MODELS_DIR="${POSECAM_MODELS_DIR:-$BACKEND/models}"
  if [[ ! -f "$MODELS_DIR/pose_landmarker_full.task" || ! -f "$MODELS_DIR/efficientdet_lite0.tflite" ]]; then
    echo "Downloading MediaPipe models into $MODELS_DIR ..."
    uv run --no-sync python scripts/download_models.py \
      || echo "warning: model download failed; /analyze will run without detection" >&2
  fi
fi

exec uv run --no-sync uvicorn app.main:app --host 0.0.0.0 --port "$PORT" --reload --reload-dir app
