"""FastAPI 앱 + CLI 엔트리포인트."""
import argparse
import os
import webbrowser
from pathlib import Path

import uvicorn
from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles

from claude_hub.config import AppConfig
from claude_hub.services.backup import BackupService
from claude_hub.services.editor import EditorService
from claude_hub.services.marketplace import MarketplaceService
from claude_hub.services.scanner import ScannerService
from claude_hub.services.usage_db import UsageDB
from claude_hub.services.validator import ValidatorService


def create_app(config: AppConfig | None = None) -> FastAPI:
    if config is None:
        config = AppConfig()

    app = FastAPI(title="claude-hub", version="0.1.0")

    backup = BackupService(backup_dir=config.backup_dir)
    scanner = ScannerService(claude_dir=config.claude_dir)
    editor = EditorService(backup_service=backup)
    validator = ValidatorService()
    marketplace = MarketplaceService(paths=config.paths)
    usage_db = UsageDB(db_path=config.backup_dir / "usage.db")

    app.state.config = config
    app.state.scanner = scanner
    app.state.editor = editor
    app.state.validator = validator
    app.state.backup = backup
    app.state.marketplace = marketplace
    app.state.usage_db = usage_db

    from claude_hub.routers import dashboard, skills, settings, claude_md, plugins, agents, commands, hooks, mcp, keybindings, marketplace as marketplace_router, memory, teams, backups, stats, analysis, wizard, cost, templates as templates_router, sessions, claude_settings
    app.include_router(dashboard.router, prefix="/api")
    app.include_router(skills.router, prefix="/api")
    app.include_router(settings.router, prefix="/api")
    app.include_router(claude_md.router, prefix="/api")
    app.include_router(plugins.router, prefix="/api")
    app.include_router(agents.router, prefix="/api")
    app.include_router(commands.router, prefix="/api")
    app.include_router(hooks.router, prefix="/api")
    app.include_router(mcp.router, prefix="/api")
    app.include_router(keybindings.router, prefix="/api")
    app.include_router(marketplace_router.router, prefix="/api")
    app.include_router(memory.router, prefix="/api")
    app.include_router(teams.router, prefix="/api")
    app.include_router(backups.router, prefix="/api")
    app.include_router(stats.router, prefix="/api")
    app.include_router(analysis.router, prefix="/api")
    app.include_router(wizard.router, prefix="/api")
    app.include_router(cost.router, prefix="/api")
    app.include_router(templates_router.router, prefix="/api")
    app.include_router(sessions.router, prefix="/api")
    app.include_router(claude_settings.router, prefix="/api")

    from claude_hub.routers import hub_settings
    app.include_router(hub_settings.router, prefix="/api")

    static_dir = Path(__file__).parent / "static"
    if static_dir.exists():
        from starlette.middleware import Middleware
        from starlette.responses import FileResponse as StarletteFileResponse

        # SPA 미들웨어: /api 이외의 요청은 정적 파일 또는 index.html로 처리
        @app.middleware("http")
        async def spa_middleware(request, call_next):
            path = request.url.path

            # /api, /docs, /openapi.json은 FastAPI가 처리
            if path.startswith("/api") or path.startswith("/docs") or path.startswith("/openapi") or path.startswith("/redoc"):
                return await call_next(request)

            # 정적 파일이 존재하면 직접 서빙
            file_path = static_dir / path.lstrip("/")
            if file_path.is_file():
                resp = StarletteFileResponse(file_path)
                # assets/는 해시가 포함되어 있으므로 장기 캐시 OK
                # index.html은 항상 최신을 로드하도록 캐시 금지
                if not path.startswith("/assets/"):
                    resp.headers["Cache-Control"] = "no-cache, no-store, must-revalidate"
                return resp

            # 그 외 모든 경로 → index.html (SPA fallback, 캐시 금지)
            index_path = static_dir / "index.html"
            if index_path.is_file():
                resp = StarletteFileResponse(index_path)
                resp.headers["Cache-Control"] = "no-cache, no-store, must-revalidate"
                return resp

            return await call_next(request)

    return app


def cli():
    parser = argparse.ArgumentParser(description="claude-hub: Claude Code configuration dashboard")
    parser.add_argument("--port", type=int, default=3847)
    parser.add_argument("--host", type=str, default="127.0.0.1")
    parser.add_argument("--claude-dir", type=Path, default=None)
    parser.add_argument("--no-open", action="store_true")
    parser.add_argument("--app", action="store_true", help="Launch as native app window (requires pywebview)")

    subparsers = parser.add_subparsers(dest="command")

    tracker_parser = subparsers.add_parser("tracker", help="Usage tracking management")
    tracker_sub = tracker_parser.add_subparsers(dest="tracker_command")
    tracker_sub.add_parser("install", help="Install PostToolUse hook for tracking")
    tracker_sub.add_parser("uninstall", help="Remove tracking hook")
    tracker_sub.add_parser("sync", help="Parse session logs and import to DB")
    tracker_sub.add_parser("status", help="Show tracking status")

    args = parser.parse_args()

    # 어떤 CLI 명령이든 실행 시 tracker hook 자동 설치
    try:
        _ensure_tracker_installed()
    except Exception:
        pass

    if args.command == "tracker":
        _run_tracker_command(args)
        return

    url = f"http://localhost:{args.port}"

    # 이미 서버가 실행 중이면 브라우저에서 열고 종료
    if _is_already_running(args.port):
        print(f"[claude-hub] Already running at {url}")
        import webbrowser
        webbrowser.open(url)
        return

    config = AppConfig(port=args.port, host=args.host, auto_open=not args.no_open)
    if args.claude_dir:
        config.claude_dir = args.claude_dir

    if args.host == "0.0.0.0":
        print("WARNING: Binding to 0.0.0.0 exposes this server to the network.")

    app = create_app(config)

    # 시작 시 항상 tracker 자동 설정 (hook 설치 + 과거 로그 sync)
    _auto_setup_tracker(config)

    # 자동실행 기본 설정 (최초 1회)
    _auto_setup_autostart()

    # 사용량 데이터 사전 계산 (warm-up) — 백그라운드
    import threading
    def _warmup():
        from claude_hub.services.cost import CostService
        from claude_hub.services.scanner import _cached
        cost = CostService(paths=config.paths)
        _cached("claude_usage", cost.get_combined_summary)
        print("[claude-hub] Usage data pre-calculated.")
    threading.Thread(target=_warmup, daemon=True).start()

    if args.app:
        _run_as_app(app, config, url)
    else:
        print(f"claude-hub running at {url}")
        print("Press Ctrl+C to stop")
        if config.auto_open:
            webbrowser.open(url)
        uvicorn.run(app, host=config.host, port=config.port, log_level="warning")


def _is_already_running(port: int) -> bool:
    """해당 포트에서 claude-hub 서버가 응답하는지 확인."""
    import urllib.request
    try:
        urllib.request.urlopen(f"http://localhost:{port}/api/dashboard", timeout=2)
        return True
    except Exception:
        return False


def _activate_existing_window():
    """이미 실행 중인 ClaudeHub 창 포커스. 없으면 새 --app 창 열기."""
    import subprocess

    # 방법 1: 전용 Chrome 프로필 프로세스가 실행 중인지 확인
    chrome_profile = str(Path.home() / ".claude-hub" / "chrome-profile")
    try:
        result = subprocess.run(
            ["pgrep", "-f", f"user-data-dir={chrome_profile}"],
            capture_output=True, text=True, timeout=3,
        )
        if result.returncode == 0 and result.stdout.strip():
            # 프로세스 있음 → AppleScript로 해당 Chrome 활성화
            script = '''
            tell application "System Events"
                set chromeProcs to every process whose name contains "Google Chrome"
                if (count of chromeProcs) > 0 then
                    set frontmost of (item 1 of chromeProcs) to true
                end if
            end tell
            '''
            subprocess.run(["osascript", "-e", script], capture_output=True, timeout=3)
            return
    except Exception:
        pass

    # 프로세스 없음 → 새 --app 창 열기
    print("기존 브라우저 세션에서 여는 중입니다.")
    _open_browser_app("http://localhost:3847")


def _open_browser_app(url: str):
    """Chrome --app 모드로 새 창 열기. 최초 실행 시에만 호출된다."""
    import subprocess

    chrome_paths = [
        "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
        "/Applications/Chromium.app/Contents/MacOS/Chromium",
        "/Applications/Brave Browser.app/Contents/MacOS/Brave Browser",
        "/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge",
    ]
    chrome_profile = Path.home() / ".claude-hub" / "chrome-profile"
    chrome_profile.mkdir(parents=True, exist_ok=True)

    for chrome in chrome_paths:
        if Path(chrome).exists():
            subprocess.Popen([
                chrome,
                f"--app={url}",
                f"--user-data-dir={chrome_profile}",
                "--no-first-run",
                "--disable-extensions",
                "--disable-infobars",
                "--no-default-browser-check",
            ])
            return
    webbrowser.open(url)


def _ensure_tracker_installed():
    """CLI 진입 시 tracker hook이 설치되어 있는지 확인하고 없으면 설치."""
    import json as _json
    settings_path = Path.home() / ".claude" / "settings.json"
    if not settings_path.exists():
        return

    data = _json.loads(settings_path.read_text(encoding="utf-8"))
    post_hooks = data.get("hooks", {}).get("PostToolUse", [])
    has_tracker = any(
        "claude-hub-tracker" in h.get("command", "")
        for g in post_hooks for h in g.get("hooks", [])
    )
    if has_tracker:
        return

    tracker_cmd = _find_tracker_command() + " record"
    hooks = data.setdefault("hooks", {})
    hooks.setdefault("PostToolUse", []).append(
        {"hooks": [{"type": "command", "command": tracker_cmd}]}
    )
    settings_path.write_text(_json.dumps(data, indent=2, ensure_ascii=False), encoding="utf-8")
    print(f"[claude-hub] Tracker hook auto-installed: {tracker_cmd}")


def _find_tracker_command() -> str:
    """claude-hub-tracker의 절대 경로를 탐색."""
    import shutil
    from pathlib import Path

    found = shutil.which("claude-hub-tracker")
    if found:
        return found

    # 프로젝트 .venv 내 탐색
    candidates = [
        Path(__file__).resolve().parent.parent.parent / ".venv" / "bin" / "claude-hub-tracker",
        Path.home() / ".local" / "bin" / "claude-hub-tracker",
    ]
    for c in candidates:
        if c.exists():
            return str(c)

    return "claude-hub-tracker"  # fallback


def _auto_setup_autostart():
    """최초 실행 시 자동실행 LaunchAgent 생성 (기본 활성화)."""
    from claude_hub.routers.hub_settings import PLIST_PATH, HUB_SETTINGS_PATH
    import json as _json

    # hub-settings.json에 autostart 설정이 없으면 최초 → 자동 활성화
    if HUB_SETTINGS_PATH.exists():
        settings = _json.loads(HUB_SETTINGS_PATH.read_text())
        if "autostart" in settings:
            return  # 이미 사용자가 설정함

    if not PLIST_PATH.exists():
        import asyncio
        from claude_hub.routers.hub_settings import toggle_autostart
        try:
            asyncio.get_event_loop().run_until_complete(toggle_autostart(enabled=True))
            print("[claude-hub] Autostart enabled (default).")
        except Exception:
            pass


def _auto_setup_tracker(config: AppConfig):
    """시작 시 자동으로 tracker hook 설치 + 과거 로그 sync."""
    import json as _json
    from claude_hub.services.usage_db import UsageDB
    from claude_hub.services.log_parser import parse_session_logs

    db = UsageDB(db_path=config.backup_dir / "usage.db")
    settings_path = config.paths.settings_path
    tracker_cmd = _find_tracker_command() + " record"

    # 1. Hook 자동 설치 또는 업데이트 (절대 경로)
    if settings_path.exists():
        data = _json.loads(settings_path.read_text(encoding="utf-8"))
        post_hooks = data.get("hooks", {}).get("PostToolUse", [])
        modified = False

        # 기존 상대 경로 hook을 절대 경로로 업데이트
        for group in post_hooks:
            for h in group.get("hooks", []):
                if h.get("command") == "claude-hub-tracker record" and "claude-hub-tracker record" != tracker_cmd:
                    h["command"] = tracker_cmd
                    modified = True

        # 미설치 시 새로 추가
        already = any(
            any("claude-hub-tracker" in h.get("command", "") for h in g.get("hooks", []))
            for g in post_hooks
        )
        if not already:
            hooks = data.setdefault("hooks", {})
            hooks.setdefault("PostToolUse", []).append(
                {"hooks": [{"type": "command", "command": tracker_cmd}]}
            )
            modified = True

        if modified:
            settings_path.write_text(_json.dumps(data, indent=2, ensure_ascii=False), encoding="utf-8")
            print(f"[claude-hub] Tracker hook installed: {tracker_cmd}")

    # 2. 과거 로그 sync (DB가 비어있을 때만)
    overview = db.get_overview()
    if overview["total_events"] == 0:
        print("[claude-hub] Syncing session logs...")
        result = parse_session_logs(config.paths, db)
        if result["files_parsed"] > 0:
            print(f"[claude-hub] Synced: {result['files_parsed']} files, {result['events_found']} events")


def _run_as_app(app, config: AppConfig, url: str):
    """pywebview 네이티브 윈도우로 실행. Dock에 ClaudeHub 아이콘 표시."""
    import threading
    import time
    import urllib.request

    # uvicorn 서버를 별도 스레드에서 실행
    def start_server():
        uvicorn.run(app, host=config.host, port=config.port, log_level="warning")

    server_thread = threading.Thread(target=start_server, daemon=True)
    server_thread.start()

    # 서버 준비 대기
    for _ in range(30):
        try:
            urllib.request.urlopen(f"{url}/api/dashboard", timeout=1)
            break
        except Exception:
            time.sleep(0.2)

    print(f"[claude-hub] Running at {url}")

    try:
        import webview
        webview.create_window(
            "ClaudeHub",
            url,
            width=1280,
            height=820,
            min_size=(900, 600),
        )
        webview.start()
    except ImportError:
        # pywebview 없으면 브라우저로 fallback
        print("[claude-hub] pywebview not found, opening in browser.")
        import webbrowser
        webbrowser.open(url)
        try:
            while True:
                time.sleep(1)
        except KeyboardInterrupt:
            pass


def _run_tracker_command(args) -> None:
    """tracker 서브커맨드 처리."""
    import json as _json
    from claude_hub.services.usage_db import UsageDB
    from claude_hub.config import AppConfig

    config = AppConfig()
    db = UsageDB(db_path=config.backup_dir / "usage.db")
    settings_path = config.claude_dir / "settings.json"

    cmd = getattr(args, "tracker_command", None)

    if cmd == "install":
        data: dict = {}
        if settings_path.exists():
            data = _json.loads(settings_path.read_text(encoding="utf-8"))
        hooks = data.setdefault("hooks", {})
        post_hooks = hooks.setdefault("PostToolUse", [])
        entry = {"hooks": [{"type": "command", "command": "claude-hub-tracker record"}]}
        # 이미 등록된 경우 중복 추가 방지
        if not any(
            any(h.get("command") == "claude-hub-tracker record" for h in g.get("hooks", []))
            for g in post_hooks
        ):
            post_hooks.append(entry)
            settings_path.write_text(_json.dumps(data, indent=2, ensure_ascii=False), encoding="utf-8")
            print("Tracking hook installed.")
        else:
            print("Tracking hook already installed.")

    elif cmd == "uninstall":
        if not settings_path.exists():
            print("settings.json not found.")
            return
        data = _json.loads(settings_path.read_text(encoding="utf-8"))
        post_hooks = data.get("hooks", {}).get("PostToolUse", [])
        filtered = [
            g for g in post_hooks
            if not any(h.get("command") == "claude-hub-tracker record" for h in g.get("hooks", []))
        ]
        data.setdefault("hooks", {})["PostToolUse"] = filtered
        settings_path.write_text(_json.dumps(data, indent=2, ensure_ascii=False), encoding="utf-8")
        print("Tracking hook removed.")

    elif cmd == "sync":
        from claude_hub.services.log_parser import parse_session_logs
        result = parse_session_logs(config.paths, db)
        print(f"Sync complete: {result['files_parsed']} files parsed, {result['events_found']} events found, {result['errors']} errors")

    elif cmd == "status":
        overview = db.get_overview()
        print(f"Total events  : {overview['total_events']}")
        print(f"Unique skills : {overview['unique_skills_used']}")
        print(f"Unique plugins: {overview['unique_plugins_used']}")
        # hook 설치 여부 확인
        installed = False
        if settings_path.exists():
            data = _json.loads(settings_path.read_text(encoding="utf-8"))
            post_hooks = data.get("hooks", {}).get("PostToolUse", [])
            installed = any(
                any(h.get("command") == "claude-hub-tracker record" for h in g.get("hooks", []))
                for g in post_hooks
            )
        print(f"Hook installed: {installed}")

    else:
        print("Usage: claude-hub tracker [install|uninstall|sync|status]")
