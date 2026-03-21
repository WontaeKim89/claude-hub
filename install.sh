#!/bin/bash
# claude-hub 원클릭 설치 스크립트
# curl -sSL https://raw.githubusercontent.com/claude-hub/claude-hub/main/install.sh | bash
set -e

echo ""
echo "  ⬡ claude-hub installer"
echo "  ─────────────────────"
echo ""

# uv 설치 확인
if ! command -v uv &>/dev/null; then
    echo "  [1/3] Installing uv..."
    curl -LsSf https://astral.sh/uv/install.sh | sh
    export PATH="$HOME/.local/bin:$PATH"
else
    echo "  [1/3] uv found: $(uv --version)"
fi

# claude-hub 설치
echo "  [2/3] Installing claude-hub..."
uv tool install claude-hub 2>/dev/null || uv tool install --force claude-hub

# macOS .app 생성 (macOS만)
if [[ "$(uname)" == "Darwin" ]]; then
    echo "  [3/3] Creating macOS app..."
    # .app 번들은 PyPI 패키지에 포함된 스크립트로 생성
    claude-hub create-app 2>/dev/null || echo "  [3/3] Skipped (run 'claude-hub create-app' manually)"
else
    echo "  [3/3] Skipped macOS app (not on macOS)"
fi

echo ""
echo "  ✓ Installation complete!"
echo ""
echo "  Run: claude-hub --app"
echo "  Or:  claude-hub (browser mode)"
echo ""
