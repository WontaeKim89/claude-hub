"""Claude 설정 및 사용량 API."""
import json
import subprocess
from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel

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
        proc = subprocess.run(
            ["claude", "--version"],
            capture_output=True, text=True, timeout=5
        )
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
