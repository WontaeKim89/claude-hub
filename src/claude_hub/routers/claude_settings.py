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
    """Claude 사용량 정보 (세션 로그 기반 추정)."""
    from claude_hub.services.cost import CostService
    config = request.app.state.config
    cost_service = CostService(paths=config.paths)

    weekly = cost_service.get_summary(days=7)
    monthly = cost_service.get_summary(days=30)

    model_breakdown = monthly.get("model_usage", {})

    return {
        "weekly": {
            "sessions": weekly["session_count"],
            "tokens_in": weekly["total_tokens_in"],
            "tokens_out": weekly["total_tokens_out"],
            "cost": weekly["total_cost_usd"],
        },
        "monthly": {
            "sessions": monthly["session_count"],
            "tokens_in": monthly["total_tokens_in"],
            "tokens_out": monthly["total_tokens_out"],
            "cost": monthly["total_cost_usd"],
        },
        "daily_avg_cost": monthly["daily_avg_cost"],
        "model_breakdown": model_breakdown,
    }
