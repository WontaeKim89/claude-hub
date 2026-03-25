"""Claude 설정 및 사용량 API."""
import json
from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel

from claude_hub.utils.claude_cli import popen_claude, run_claude

router = APIRouter(tags=["claude-settings"])


@router.get("/claude/settings")
async def get_claude_settings(request: Request):
    """현재 Claude 설정 (모델, 플랜 등) 조회."""
    config = request.app.state.config
    settings_path = config.paths.settings_path

    result = {
        "model": "unknown",
        "plan": "unknown",
    }

    if settings_path.exists():
        settings = json.loads(settings_path.read_text())
        result["model"] = settings.get("model", "unknown")

    # Claude CLI 버전 확인
    try:
        proc = run_claude("--version", timeout=5)
        if proc.returncode == 0:
            result["cli_version"] = proc.stdout.strip()
    except Exception:
        pass

    return result


class ModelUpdateRequest(BaseModel):
    model: str


@router.put("/claude/settings/model")
async def update_model(body: ModelUpdateRequest, request: Request):
    """Claude 모델 변경."""
    config = request.app.state.config
    editor = request.app.state.editor
    settings_path = config.paths.settings_path

    if not settings_path.exists():
        raise HTTPException(status_code=404, detail="settings.json not found")

    settings = json.loads(settings_path.read_text())
    mtime = settings_path.stat().st_mtime
    settings["model"] = body.model
    editor.write_json(settings_path, settings, last_mtime=mtime)
    from claude_hub.services.scanner import invalidate_settings_cache
    invalidate_settings_cache()
    return {"ok": True, "model": body.model}


@router.post("/claude/auth/login")
async def claude_auth_login():
    """Claude 로그인 시작 (브라우저 기반)."""
    try:
        popen_claude("auth", "login")
        return {"ok": True, "message": "브라우저에서 로그인을 완료해주세요"}
    except Exception as e:
        return {"ok": False, "message": str(e)}


@router.post("/claude/auth/logout")
async def claude_auth_logout():
    """Claude 로그아웃."""
    try:
        run_claude("auth", "logout", timeout=10)
        return {"ok": True, "message": "로그아웃 완료"}
    except Exception as e:
        return {"ok": False, "message": str(e)}


@router.get("/claude/auth/status")
async def claude_auth_status():
    """인증 상태 확인."""
    try:
        proc = run_claude("auth", "status", "--text", timeout=5)
        return {
            "authenticated": proc.returncode == 0,
            "details": proc.stdout.strip() if proc.stdout else proc.stderr.strip(),
        }
    except Exception:
        return {"authenticated": False, "details": "Claude CLI not available"}


@router.post("/claude/remote-start")
async def start_remote_session(request: Request):
    """원격 세션 시작 (claude --remote)."""
    body = await request.json()
    task = body.get("task", "")
    try:
        popen_claude("--remote", task)
        return {"ok": True, "message": f"원격 세션이 claude.ai에서 시작되었습니다: {task}"}
    except Exception as e:
        return {"ok": False, "message": str(e)}


@router.post("/claude/teleport")
async def teleport_session():
    """웹 세션을 로컬로 가져오기 (claude --teleport)."""
    try:
        popen_claude("--teleport")
        return {"ok": True, "message": "Teleport가 시작되었습니다. 터미널에서 확인하세요."}
    except Exception as e:
        return {"ok": False, "message": str(e)}


@router.get("/claude/usage")
async def get_claude_usage(request: Request):
    """Claude 사용량 정보 (TTL 캐시 — 60초)."""
    from claude_hub.services.cost import CostService
    from claude_hub.services.scanner import _cached
    config = request.app.state.config
    cost_service = CostService(paths=config.paths)
    return _cached("claude_usage", cost_service.get_combined_summary)


@router.get("/claude/rate-limits")
async def get_claude_rate_limits():
    """Claude OAuth API를 통한 실시간 레이트 리밋 조회."""
    import subprocess
    import httpx

    # Keychain에서 OAuth 토큰 추출
    token = None
    try:
        proc = subprocess.run(
            ["security", "find-generic-password", "-s", "Claude Code-credentials", "-w"],
            capture_output=True, text=True, timeout=5,
        )
        if proc.returncode == 0 and proc.stdout.strip():
            creds = json.loads(proc.stdout.strip())
            token = creds.get("claudeAiOauth", {}).get("accessToken")
    except Exception:
        pass

    if not token:
        raise HTTPException(status_code=404, detail="Claude OAuth token not found in Keychain")

    # Anthropic OAuth usage API 호출
    try:
        async with httpx.AsyncClient(timeout=10) as client:
            resp = await client.get(
                "https://api.anthropic.com/api/oauth/usage",
                headers={
                    "Authorization": f"Bearer {token}",
                    "anthropic-beta": "oauth-2025-04-20",
                },
            )
            if resp.status_code == 401:
                raise HTTPException(status_code=401, detail="OAuth token expired or invalid")
            if resp.status_code == 429:
                raise HTTPException(status_code=429, detail="Rate limited")
            resp.raise_for_status()
            return resp.json()
    except httpx.HTTPStatusError as e:
        raise HTTPException(status_code=e.response.status_code, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to fetch rate limits: {e}")
