#!/bin/bash
# macOS .app 번들 생성 스크립트
# 결과물: ~/Applications/claude-hub.app (더블클릭으로 실행)

set -e

APP_NAME="claude-hub"
APP_DIR="/Applications/${APP_NAME}.app"
CONTENTS="${APP_DIR}/Contents"
MACOS="${CONTENTS}/MacOS"
RESOURCES="${CONTENTS}/Resources"

echo "Creating ${APP_NAME}.app ..."

# 기존 앱 제거
rm -rf "$APP_DIR"

# 디렉토리 구조
mkdir -p "$MACOS" "$RESOURCES"

# 실행 스크립트
cat > "${MACOS}/launcher" << 'LAUNCHER_EOF'
#!/bin/bash
# claude-hub 런처
export PATH="$HOME/.local/bin:$HOME/.cargo/bin:/opt/homebrew/bin:/usr/local/bin:$PATH"

# uv가 설치된 경로 찾기
UV_BIN=$(which uv 2>/dev/null || echo "$HOME/.local/bin/uv")

if [ ! -f "$UV_BIN" ]; then
    osascript -e 'display dialog "uv가 설치되어 있지 않습니다.\n\ncurl -LsSf https://astral.sh/uv/install.sh | sh" with title "claude-hub" buttons {"OK"} default button "OK" with icon stop'
    exit 1
fi

# claude-hub --app 실행 (프로젝트 디렉토리 기준)
PROJECT_DIR="$HOME/Desktop/Persnal_Project/claude-hub"

if [ ! -d "$PROJECT_DIR" ]; then
    osascript -e "display dialog \"프로젝트를 찾을 수 없습니다\" with title \"claude-hub\" buttons {\"OK\"} with icon stop"
    exit 1
fi

exec "$UV_BIN" run --directory "$PROJECT_DIR" claude-hub --app
LAUNCHER_EOF

chmod +x "${MACOS}/launcher"

# Info.plist
cat > "${CONTENTS}/Info.plist" << 'PLIST_EOF'
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>CFBundleName</key>
    <string>claude-hub</string>
    <key>CFBundleDisplayName</key>
    <string>claude-hub</string>
    <key>CFBundleIdentifier</key>
    <string>dev.claude-hub.app</string>
    <key>CFBundleVersion</key>
    <string>0.1.0</string>
    <key>CFBundleShortVersionString</key>
    <string>0.1.0</string>
    <key>CFBundleExecutable</key>
    <string>launcher</string>
    <key>CFBundleIconFile</key>
    <string>AppIcon</string>
    <key>CFBundlePackageType</key>
    <string>APPL</string>
    <key>LSMinimumSystemVersion</key>
    <string>12.0</string>
    <key>LSUIElement</key>
    <false/>
    <key>NSHighResolutionCapable</key>
    <true/>
</dict>
</plist>
PLIST_EOF

# 간단한 아이콘 생성 (텍스트 기반 — 나중에 실제 아이콘으로 교체 가능)
# SVG → PNG → ICNS 변환 (sips 사용)
ICON_DIR=$(mktemp -d)

# 1024x1024 아이콘 생성 (Core Graphics로)
python3 << ICON_EOF
import subprocess, tempfile, os

svg = '''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1024 1024">
  <rect width="1024" height="1024" rx="200" fill="#09090b"/>
  <rect x="40" y="40" width="944" height="944" rx="170" fill="#111113" stroke="#27272a" stroke-width="4"/>
  <text x="512" y="420" text-anchor="middle" fill="#34d399" font-family="system-ui" font-size="320" font-weight="700">⬡</text>
  <text x="512" y="680" text-anchor="middle" fill="#e4e4e7" font-family="system-ui" font-size="140" font-weight="600">hub</text>
</svg>'''

svg_path = os.path.join("${ICON_DIR}", "icon.svg")
png_path = os.path.join("${ICON_DIR}", "icon.png")

with open(svg_path, "w") as f:
    f.write(svg)

# qlmanage로 SVG → PNG 변환 시도
try:
    subprocess.run(["qlmanage", "-t", "-s", "1024", "-o", "${ICON_DIR}", svg_path],
                   capture_output=True, timeout=10)
    # qlmanage는 .svg.png 형식으로 저장
    generated = os.path.join("${ICON_DIR}", "icon.svg.png")
    if os.path.exists(generated):
        os.rename(generated, png_path)
except Exception:
    pass
ICON_EOF

# PNG → ICNS 변환
if [ -f "${ICON_DIR}/icon.png" ]; then
    ICONSET="${ICON_DIR}/AppIcon.iconset"
    mkdir -p "$ICONSET"
    sips -z 16 16 "${ICON_DIR}/icon.png" --out "${ICONSET}/icon_16x16.png" 2>/dev/null
    sips -z 32 32 "${ICON_DIR}/icon.png" --out "${ICONSET}/icon_16x16@2x.png" 2>/dev/null
    sips -z 32 32 "${ICON_DIR}/icon.png" --out "${ICONSET}/icon_32x32.png" 2>/dev/null
    sips -z 64 64 "${ICON_DIR}/icon.png" --out "${ICONSET}/icon_32x32@2x.png" 2>/dev/null
    sips -z 128 128 "${ICON_DIR}/icon.png" --out "${ICONSET}/icon_128x128.png" 2>/dev/null
    sips -z 256 256 "${ICON_DIR}/icon.png" --out "${ICONSET}/icon_128x128@2x.png" 2>/dev/null
    sips -z 256 256 "${ICON_DIR}/icon.png" --out "${ICONSET}/icon_256x256.png" 2>/dev/null
    sips -z 512 512 "${ICON_DIR}/icon.png" --out "${ICONSET}/icon_256x256@2x.png" 2>/dev/null
    sips -z 512 512 "${ICON_DIR}/icon.png" --out "${ICONSET}/icon_512x512.png" 2>/dev/null
    sips -z 1024 1024 "${ICON_DIR}/icon.png" --out "${ICONSET}/icon_512x512@2x.png" 2>/dev/null
    iconutil -c icns "$ICONSET" -o "${RESOURCES}/AppIcon.icns" 2>/dev/null
fi

rm -rf "$ICON_DIR"

echo ""
echo "==================================="
echo "  claude-hub.app created!"
echo "==================================="
echo ""
echo "  Location: ${APP_DIR}"
echo ""
echo "  Launch: open ~/Applications/claude-hub.app"
echo "  Or find it in Launchpad/Spotlight"
echo ""
echo "  The app runs as a menu bar item (⬡)."
echo "  Close the window — it stays in background."
echo "  Click ⬡ → Open to reopen."
echo "  Click ⬡ → Quit to fully exit."
echo ""
