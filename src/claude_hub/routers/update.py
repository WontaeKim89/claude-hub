"""자동 업데이트 API — PyPI 버전 체크 + 업그레이드 실행."""
import importlib.metadata
import json
import shutil
import subprocess
import urllib.request

from fastapi import APIRouter

router = APIRouter(tags=["update"])


def _current_version() -> str:
    try:
        return importlib.metadata.version("claude-hub")
    except importlib.metadata.PackageNotFoundError:
        return "dev"


def _ver_tuple(v: str) -> tuple:
    return tuple(int(x) for x in v.split(".") if x.isdigit())


@router.get("/update/check")
async def check_update():
    """PyPI에서 최신 버전 확인."""
    current = _current_version()
    if current == "dev":
        return {"current": current, "latest": current, "update_available": False}

    try:
        resp = urllib.request.urlopen("https://pypi.org/pypi/claude-hub/json", timeout=5)
        data = json.loads(resp.read())
        latest = data["info"]["version"]
    except Exception:
        return {"current": current, "latest": current, "update_available": False}

    update_available = _ver_tuple(latest) > _ver_tuple(current)
    return {
        "current": current,
        "latest": latest,
        "update_available": update_available,
    }


@router.post("/update/apply")
async def apply_update():
    """pip 또는 brew로 업그레이드 실행."""
    import asyncio

    loop = asyncio.get_event_loop()
    result = await loop.run_in_executor(None, _run_upgrade)
    return result


def _run_upgrade() -> dict:
    """동기 업그레이드 실행."""
    # pip 시도
    pip = shutil.which("pip3") or shutil.which("pip")
    if pip:
        result = subprocess.run(
            [pip, "install", "--upgrade", "claude-hub"],
            capture_output=True, text=True, timeout=120,
        )
        if result.returncode == 0:
            new_ver = _get_installed_version()
            return {"ok": True, "method": "pip", "version": new_ver, "restart_required": True}

    # brew 시도
    brew = shutil.which("brew")
    if brew:
        result = subprocess.run(
            [brew, "upgrade", "claude-hub"],
            capture_output=True, text=True, timeout=180,
        )
        if result.returncode == 0:
            new_ver = _get_installed_version()
            return {"ok": True, "method": "brew", "version": new_ver, "restart_required": True}

    return {"ok": False, "error": "Upgrade failed. Run manually: pip install --upgrade claude-hub"}


def _get_installed_version() -> str:
    """pip show로 설치된 버전 확인 (importlib 캐시 우회)."""
    pip = shutil.which("pip3") or shutil.which("pip")
    if pip:
        result = subprocess.run([pip, "show", "claude-hub"], capture_output=True, text=True, timeout=10)
        for line in result.stdout.splitlines():
            if line.startswith("Version:"):
                return line.split(":", 1)[1].strip()
    return "unknown"
