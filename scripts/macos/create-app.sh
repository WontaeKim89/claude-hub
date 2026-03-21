#!/bin/bash
# macOS .app 번들 생성 스크립트 (AppleScript 기반 — Gatekeeper 호환)
# 결과물: /Applications/claude-hub.app

set -e

APP_NAME="claude-hub"
APP_DIR="/Applications/${APP_NAME}.app"
PROJECT_DIR="$HOME/Desktop/Persnal_Project/claude-hub"

echo "Creating ${APP_NAME}.app ..."

# 기존 앱 제거
rm -rf "$APP_DIR"

# AppleScript 앱 생성 (macOS가 네이티브로 신뢰)
cat > /tmp/claude-hub-app.applescript << APPLESCRIPT
on run
    set uvPath to do shell script "export PATH=\"\$HOME/.local/bin:/opt/homebrew/bin:/usr/local/bin:\$PATH\" && which uv"
    set projectDir to POSIX path of (path to home folder) & "Desktop/Persnal_Project/claude-hub"
    do shell script uvPath & " run --directory " & quoted form of projectDir & " claude-hub --app > /dev/null 2>&1 &"
end run
APPLESCRIPT

osacompile -o "$APP_DIR" /tmp/claude-hub-app.applescript
rm /tmp/claude-hub-app.applescript

# quarantine 제거
xattr -cr "$APP_DIR" 2>/dev/null

# Launch Services 등록
/System/Library/Frameworks/CoreServices.framework/Frameworks/LaunchServices.framework/Support/lsregister -f "$APP_DIR" 2>/dev/null

echo ""
echo "==================================="
echo "  ${APP_NAME}.app created!"
echo "==================================="
echo ""
echo "  Location: ${APP_DIR}"
echo ""
echo "  Launch: Finder → 응용 프로그램 → claude-hub 더블클릭"
echo "  Or: Spotlight (Cmd+Space) → claude-hub"
echo ""
echo "  Menu bar icon (⬡) stays active after closing window."
echo "  Click ⬡ → Open to reopen."
echo "  Click ⬡ → Quit to fully exit."
echo ""
