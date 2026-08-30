#!/usr/bin/env bash
# Build all CodeArena sandbox Docker images
# Run from apps/judge-worker/: bash sandboxes/build.sh

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

echo "╔══════════════════════════════════════════╗"
echo "║  CodeArena — Building Sandbox Images     ║"
echo "╚══════════════════════════════════════════╝"
echo ""

echo "▶ Building Python 3.12 sandbox image..."
docker build --no-cache -t codearena-python:3.12 "$SCRIPT_DIR/python"
echo "✅ codearena-python:3.12 built"
echo ""

echo "▶ Building C++20 (GCC 13) sandbox image..."
docker build --no-cache -t codearena-cpp:13 "$SCRIPT_DIR/cpp"
echo "✅ codearena-cpp:13 built"
echo ""

echo "▶ Building TypeScript/Node.js 20 sandbox image..."
docker build --no-cache -t codearena-typescript:20 "$SCRIPT_DIR/typescript"
echo "✅ codearena-typescript:20 built"
echo ""

echo "── Verify built images ──────────────────────"
docker images | grep "codearena-"
echo ""
echo "✅ All sandbox images ready"
