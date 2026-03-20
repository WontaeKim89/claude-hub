"""FastAPI 앱 + CLI 엔트리포인트."""
import argparse
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

    app.state.config = config
    app.state.scanner = scanner
    app.state.editor = editor
    app.state.validator = validator
    app.state.backup = backup
    app.state.marketplace = marketplace

    from claude_hub.routers import dashboard, skills, settings, claude_md, plugins, agents, commands, hooks, mcp, keybindings, marketplace as marketplace_router, memory, teams
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

    static_dir = Path(__file__).parent / "static"
    if static_dir.exists():
        app.mount("/", StaticFiles(directory=static_dir, html=True), name="static")

    return app


def cli():
    parser = argparse.ArgumentParser(description="claude-hub: Claude Code configuration dashboard")
    parser.add_argument("--port", type=int, default=3847)
    parser.add_argument("--host", type=str, default="127.0.0.1")
    parser.add_argument("--claude-dir", type=Path, default=None)
    parser.add_argument("--no-open", action="store_true")
    args = parser.parse_args()

    config = AppConfig(port=args.port, host=args.host, auto_open=not args.no_open)
    if args.claude_dir:
        config.claude_dir = args.claude_dir

    if args.host == "0.0.0.0":
        print("WARNING: Binding to 0.0.0.0 exposes this server to the network.")

    app = create_app(config)
    url = f"http://localhost:{config.port}"
    print(f"claude-hub running at {url}")
    print("Press Ctrl+C to stop")

    if config.auto_open:
        webbrowser.open(url)

    uvicorn.run(app, host=config.host, port=config.port, log_level="warning")
