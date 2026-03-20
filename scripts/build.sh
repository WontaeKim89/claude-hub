#!/bin/bash
set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

echo "Building frontend..."
cd "$PROJECT_ROOT/src/client"
npm ci
npm run build

echo "Copying to static directory..."
rm -rf "$PROJECT_ROOT/src/claude_hub/static"
cp -r dist "$PROJECT_ROOT/src/claude_hub/static"

echo "Build complete."
