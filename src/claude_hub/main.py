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

    from claude_hub.routers import dashboard, skills, settings, claude_md, plugins, agents, commands, hooks, mcp, keybindings, marketplace as marketplace_router, memory, teams, backups, stats, analysis, wizard, cost, templates as templates_router, sessions
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

    if args.command == "tracker":
        _run_tracker_command(args)
        return

    # 기존 claude-hub 프로세스 정리 (포트 충돌 방지)
    _kill_existing(args.port)

    config = AppConfig(port=args.port, host=args.host, auto_open=not args.no_open)
    if args.claude_dir:
        config.claude_dir = args.claude_dir

    if args.host == "0.0.0.0":
        print("WARNING: Binding to 0.0.0.0 exposes this server to the network.")

    app = create_app(config)
    url = f"http://localhost:{config.port}"

    # 시작 시 항상 tracker 자동 설정 (hook 설치 + 과거 로그 sync)
    _auto_setup_tracker(config)

    if args.app:
        _run_as_app(app, config, url)
    else:
        print(f"claude-hub running at {url}")
        print("Press Ctrl+C to stop")
        if config.auto_open:
            webbrowser.open(url)
        uvicorn.run(app, host=config.host, port=config.port, log_level="warning")


def _kill_existing(port: int):
    """기존 claude-hub 프로세스가 있으면 종료 (좀비 프로세스 방지)."""
    import subprocess
    try:
        result = subprocess.run(
            ["lsof", "-ti", f":{port}"],
            capture_output=True, text=True, timeout=3
        )
        pids = result.stdout.strip().split("\n")
        current_pid = str(os.getpid())
        for pid in pids:
            pid = pid.strip()
            if pid and pid != current_pid:
                os.kill(int(pid), 9)
    except Exception:
        pass


def _auto_setup_tracker(config: AppConfig):
    """시작 시 자동으로 tracker hook 설치 + 과거 로그 sync."""
    import json as _json
    from claude_hub.services.usage_db import UsageDB
    from claude_hub.services.log_parser import parse_session_logs

    db = UsageDB(db_path=config.backup_dir / "usage.db")
    settings_path = config.paths.settings_path

    # 1. Hook 자동 설치 (미설치 시)
    if settings_path.exists():
        data = _json.loads(settings_path.read_text(encoding="utf-8"))
        post_hooks = data.get("hooks", {}).get("PostToolUse", [])
        already = any(
            any(h.get("command") == "claude-hub-tracker record" for h in g.get("hooks", []))
            for g in post_hooks
        )
        if not already:
            hooks = data.setdefault("hooks", {})
            hooks.setdefault("PostToolUse", []).append(
                {"hooks": [{"type": "command", "command": "claude-hub-tracker record"}]}
            )
            settings_path.write_text(_json.dumps(data, indent=2, ensure_ascii=False), encoding="utf-8")
            print("[claude-hub] Tracker hook installed.")

    # 2. 과거 로그 sync (DB가 비어있을 때만)
    overview = db.get_overview()
    if overview["total_events"] == 0:
        print("[claude-hub] Syncing session logs...")
        result = parse_session_logs(config.paths, db)
        if result["files_parsed"] > 0:
            print(f"[claude-hub] Synced: {result['files_parsed']} files, {result['events_found']} events")


def _run_as_app(app, config: AppConfig, url: str):
    """macOS 메뉴바 트레이 + 브라우저 앱 모드로 실행.
    서버가 백그라운드에서 계속 실행되고, 메뉴바 아이콘으로 제어."""
    import threading
    import time
    import urllib.request
    import subprocess

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

    def open_browser():
        """브라우저를 앱 모드로 열기 (Chrome --app 또는 기본 브라우저)."""
        # Chrome/Chromium의 --app 모드 시도 (독립 창, 주소창 없음)
        chrome_paths = [
            "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
            "/Applications/Chromium.app/Contents/MacOS/Chromium",
            "/Applications/Brave Browser.app/Contents/MacOS/Brave Browser",
            "/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge",
        ]
        for chrome in chrome_paths:
            if Path(chrome).exists():
                subprocess.Popen([
                    chrome,
                    f"--app={url}",
                    "--new-window",
                    "--disk-cache-size=0",
                ])
                return
        # Chromium 계열 없으면 기본 브라우저
        webbrowser.open(url)

    # 브라우저 앱 창 열기
    open_browser()

    # macOS 메뉴바 트레이
    try:
        import rumps

        class ClaudeHubTray(rumps.App):
            def __init__(self):
                super().__init__("claude-hub", title="⬡", quit_button=None)
                self.menu = [
                    rumps.MenuItem("Open claude-hub", callback=self._open),
                    rumps.MenuItem(f"Running on port {config.port}", callback=None),
                    None,
                    rumps.MenuItem("Quit", callback=self._quit),
                ]

            def _open(self, _):
                open_browser()

            def _quit(self, _):
                rumps.quit_application()

        print(f"[claude-hub] Running at {url}")
        print("[claude-hub] Menu bar icon ⬡ active. Click to reopen.")

        # rumps 메인 스레드 (macOS 필수)
        tray = ClaudeHubTray()
        tray.run()

    except ImportError:
        # rumps 없으면 서버만 포그라운드 유지
        print(f"[claude-hub] Running at {url}")
        print("[claude-hub] Press Ctrl+C to stop.")
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
