"""claude-hub 자체 설정 API."""
import json
import plistlib
from pathlib import Path

from fastapi import APIRouter

router = APIRouter(tags=["hub-settings"])

PLIST_PATH = Path.home() / "Library" / "LaunchAgents" / "com.claude-hub.autostart.plist"
HUB_SETTINGS_PATH = Path.home() / ".claude-hub" / "hub-settings.json"


def _read_settings() -> dict:
    if HUB_SETTINGS_PATH.exists():
        return json.loads(HUB_SETTINGS_PATH.read_text())
    return {}


def _write_settings(data: dict):
    HUB_SETTINGS_PATH.parent.mkdir(parents=True, exist_ok=True)
    HUB_SETTINGS_PATH.write_text(json.dumps(data, indent=2, ensure_ascii=False))


@router.get("/hub/settings")
async def get_hub_settings():
    settings = _read_settings()
    autostart = PLIST_PATH.exists()

    # Tracker hook 상태 확인
    tracker_installed = False
    tracker_command = ""
    settings_path = Path.home() / ".claude" / "settings.json"
    if settings_path.exists():
        import json as _json
        data = _json.loads(settings_path.read_text())
        for group in data.get("hooks", {}).get("PostToolUse", []):
            for h in group.get("hooks", []):
                if "claude-hub-tracker" in h.get("command", ""):
                    tracker_installed = True
                    tracker_command = h.get("command", "")
                    break

    return {
        "autostart": autostart,
        "tracker_installed": tracker_installed,
        "tracker_command": tracker_command,
        **settings,
    }


@router.post("/hub/settings/install-tracker")
async def install_tracker():
    """Tracker hook을 settings.json에 설치."""
    from claude_hub.main import _find_tracker_command, _ensure_tracker_installed
    try:
        _ensure_tracker_installed()
        cmd = _find_tracker_command() + " record"
        return {"ok": True, "command": cmd}
    except Exception as e:
        from fastapi import HTTPException
        raise HTTPException(status_code=500, detail=str(e))


@router.put("/hub/settings/autostart")
async def toggle_autostart(enabled: bool = True):
    """macOS LaunchAgent로 로그인 시 자동 실행 설정."""
    if enabled:
        # uv run claude-hub 실행 plist 생성
        import shutil
        uv_path = shutil.which("uv") or str(Path.home() / ".local" / "bin" / "uv")
        project_dir = str(Path(__file__).resolve().parent.parent.parent.parent)

        plist = {
            "Label": "com.claude-hub.autostart",
            "ProgramArguments": [uv_path, "run", "--directory", project_dir, "claude-hub", "--app"],
            "RunAtLoad": True,
            "KeepAlive": False,
            "StandardOutPath": str(Path.home() / ".claude-hub" / "autostart.log"),
            "StandardErrorPath": str(Path.home() / ".claude-hub" / "autostart-error.log"),
        }
        PLIST_PATH.parent.mkdir(parents=True, exist_ok=True)
        with open(PLIST_PATH, "wb") as f:
            plistlib.dump(plist, f)
    else:
        if PLIST_PATH.exists():
            PLIST_PATH.unlink()

    # hub 설정에도 기록
    settings = _read_settings()
    settings["autostart"] = enabled
    _write_settings(settings)

    return {"ok": True, "autostart": enabled}
