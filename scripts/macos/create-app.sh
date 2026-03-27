#!/bin/bash
# ClaudeHub macOS .app 생성 — pywebview 네이티브 GUI 앱

set -e

APP_NAME="ClaudeHub"
APP_DIR="/Applications/${APP_NAME}.app"
PROJECT_DIR="$HOME/Desktop/Persnal_Project/claude-hub"
VENV_PYTHON="$PROJECT_DIR/.venv/bin/python3"
REAL_PYTHON=$(readlink -f "$VENV_PYTHON")

echo "Creating ${APP_NAME}.app ..."
rm -rf "$APP_DIR"

mkdir -p "$APP_DIR/Contents/MacOS"
mkdir -p "$APP_DIR/Contents/Resources"

# Python 런처 스크립트
cat > "$APP_DIR/Contents/Resources/launcher.py" << 'PYLAUNCH'
"""ClaudeHub — pywebview 네이티브 윈도우 런처."""
import os, sys, time, signal, urllib.request, threading

HOME = os.path.expanduser("~")
LOCK = os.path.join(HOME, ".claude-hub", "app.lock")
URL = "http://localhost:3847"
PROJECT = os.path.join(HOME, "Desktop", "Persnal_Project", "claude-hub")

os.makedirs(os.path.join(HOME, ".claude-hub"), exist_ok=True)

def is_running():
    try:
        urllib.request.urlopen(URL, timeout=2)
        return True
    except:
        return False

def cleanup(*_):
    try: os.remove(LOCK)
    except: pass

# 이미 실행 중이면 종료
if os.path.exists(LOCK) and is_running():
    sys.exit(0)

with open(LOCK, "w") as f:
    f.write(str(os.getpid()))
signal.signal(signal.SIGTERM, cleanup)
signal.signal(signal.SIGINT, cleanup)

# site-packages 경로 추가
venv_site = os.path.join(PROJECT, ".venv", "lib")
for d in os.listdir(venv_site):
    sp = os.path.join(venv_site, d, "site-packages")
    if os.path.isdir(sp):
        sys.path.insert(0, sp)
sys.path.insert(0, os.path.join(PROJECT, "src"))

import uvicorn, webview
from claude_hub.main import create_app

app = create_app()

def run_server():
    uvicorn.run(app, host="127.0.0.1", port=3847, log_level="warning")

threading.Thread(target=run_server, daemon=True).start()

for _ in range(30):
    if is_running(): break
    time.sleep(0.3)

window = webview.create_window("ClaudeHub", URL, width=1280, height=820, min_size=(900, 600), background_color='#09090b')
webview.start()
cleanup()
PYLAUNCH

# C 런처 (네이티브 바이너리 → macOS가 GUI 앱으로 인식)
cat > /tmp/launcher.c << CCODE
#include <stdio.h>
#include <unistd.h>
#include <string.h>
#include <libgen.h>

int main(int argc, char *argv[]) {
    char path[4096];
    strncpy(path, argv[0], sizeof(path)-1);
    char *dir = dirname(path);
    char script[4096];
    snprintf(script, sizeof(script), "%s/../Resources/launcher.py", dir);
    char *python = "${REAL_PYTHON}";
    char *new_argv[] = {python, script, NULL};
    execv(python, new_argv);
    perror("execv");
    return 1;
}
CCODE

cc -o "$APP_DIR/Contents/MacOS/ClaudeHub" /tmp/launcher.c -arch arm64
rm /tmp/launcher.c

# Info.plist
cat > "$APP_DIR/Contents/Info.plist" << PLIST
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>CFBundleName</key>
    <string>ClaudeHub</string>
    <key>CFBundleDisplayName</key>
    <string>ClaudeHub</string>
    <key>CFBundleIdentifier</key>
    <string>com.claudehub.app</string>
    <key>CFBundleVersion</key>
    <string>0.1</string>
    <key>CFBundleExecutable</key>
    <string>ClaudeHub</string>
    <key>CFBundlePackageType</key>
    <string>APPL</string>
    <key>NSHighResolutionCapable</key>
    <true/>
    <key>NSDesktopFolderUsageDescription</key>
    <string>ClaudeHub needs access to Desktop to manage Claude Code project configurations.</string>
    <key>NSDocumentsFolderUsageDescription</key>
    <string>ClaudeHub needs access to Documents to manage Claude Code project configurations.</string>
    <key>NSDownloadsFolderUsageDescription</key>
    <string>ClaudeHub needs access to Downloads to manage Claude Code project configurations.</string>
    <key>NSRemovableVolumesUsageDescription</key>
    <string>ClaudeHub needs access to removable volumes to manage Claude Code project configurations.</string>
    <key>NSAppleMusicUsageDescription</key>
    <string>Not required. Deny this permission.</string>
    <key>NSPhotoLibraryUsageDescription</key>
    <string>Not required. Deny this permission.</string>
</dict>
</plist>
PLIST

# 1. quarantine 제거
xattr -cr "$APP_DIR" 2>/dev/null

# 2. 코드 서명 (아이콘 설정 전에 실행)
codesign --force --deep --sign - "$APP_DIR" 2>/dev/null

# 3. 아이콘 설정 (코드 서명 후 — 리소스 포크가 보존됨)
ICON_PNG="${PROJECT_DIR}/scripts/macos/icon.iconset/icon_512x512.png"
if [ -f "$ICON_PNG" ] && command -v fileicon &>/dev/null; then
    fileicon set "$APP_DIR" "$ICON_PNG"
    echo "Custom icon applied."
fi

# 4. LaunchServices + Spotlight 등록
/System/Library/Frameworks/CoreServices.framework/Frameworks/LaunchServices.framework/Support/lsregister -f "$APP_DIR" 2>/dev/null
mdimport "$APP_DIR" 2>/dev/null

echo ""
echo "==================================="
echo "  ${APP_NAME}.app created!"
echo "==================================="
echo "  Location: ${APP_DIR}"
echo ""
