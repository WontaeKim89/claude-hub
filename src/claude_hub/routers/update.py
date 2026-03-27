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


def _find_venv_pip() -> str | None:
    """현재 실행 중인 Python의 venv pip을 찾는다."""
    import sys
    from pathlib import Path
    # 현재 Python 실행 경로에서 pip 찾기
    venv_pip = Path(sys.executable).parent / "pip"
    if venv_pip.exists():
        return str(venv_pip)
    venv_pip3 = Path(sys.executable).parent / "pip3"
    if venv_pip3.exists():
        return str(venv_pip3)
    return None


def _run_upgrade() -> dict:
    """동기 업그레이드 실행."""
    # 1. 현재 venv의 pip으로 업그레이드 (brew 설치 경로 포함)
    venv_pip = _find_venv_pip()
    if venv_pip:
        result = subprocess.run(
            [venv_pip, "install", "--upgrade", "claude-hub"],
            capture_output=True, text=True, timeout=120,
        )
        if result.returncode == 0:
            new_ver = _get_installed_version(venv_pip)
            return {"ok": True, "method": "pip", "version": new_ver, "restart_required": True}

    # 2. 시스템 pip fallback
    pip = shutil.which("pip3") or shutil.which("pip")
    if pip:
        result = subprocess.run(
            [pip, "install", "--upgrade", "claude-hub"],
            capture_output=True, text=True, timeout=120,
        )
        if result.returncode == 0:
            new_ver = _get_installed_version(pip)
            return {"ok": True, "method": "pip", "version": new_ver, "restart_required": True}

    # 3. brew fallback
    brew = shutil.which("brew")
    if brew:
        result = subprocess.run(
            [brew, "upgrade", "claude-hub"],
            capture_output=True, text=True, timeout=180,
        )
        if result.returncode == 0:
            return {"ok": True, "method": "brew", "version": "latest", "restart_required": True}

    return {"ok": False, "error": "Upgrade failed. Run manually: pip install --upgrade claude-hub"}


def _get_installed_version(pip_path: str | None = None) -> str:
    """pip show로 설치된 버전 확인."""
    pip = pip_path or _find_venv_pip() or shutil.which("pip3") or shutil.which("pip")
    if pip:
        result = subprocess.run([pip, "show", "claude-hub"], capture_output=True, text=True, timeout=10)
        for line in result.stdout.splitlines():
            if line.startswith("Version:"):
                return line.split(":", 1)[1].strip()
    return "unknown"
