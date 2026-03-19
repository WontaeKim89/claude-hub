#!/bin/bash
set -e
echo "Building frontend..."
cd "$(dirname "$0")/../src/client"
npm ci
npm run build
echo "Copying to static directory..."
rm -rf "$(dirname "$0")/../src/claude_hub/static"
cp -r dist "$(dirname "$0")/../src/claude_hub/static"
echo "Build complete."
