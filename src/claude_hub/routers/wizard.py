"""Harness Wizard + AI Skill Generator API."""
from pathlib import Path

from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel

router = APIRouter(tags=["wizard"])


class AnalyzeRequest(BaseModel):
    project_path: str


class ApplyRequest(BaseModel):
    project_path: str
    claude_md: str | None = None
    hooks: list[dict] | None = None


class GenerateSkillRequest(BaseModel):
    messages: list[dict]


@router.post("/wizard/analyze")
async def analyze_project_endpoint(body: AnalyzeRequest, request: Request):
    from claude_hub.services.wizard import analyze_project
    config = request.app.state.config
    try:
        result = analyze_project(body.project_path, config.paths)
        # AI 생성 성공 여부 판단: hooks나 mcp_suggestions가 있거나, claude_md가 실질적 내용을 포함
        ai_generated = bool(result.hooks or result.mcp_suggestions) or len(result.claude_md) > 200
        return {
            "project_path": result.project_path,
            "tech_stack": result.tech_stack,
            "claude_md": result.claude_md,
            "hooks": result.hooks,
            "mcp_suggestions": result.mcp_suggestions,
            "ai_generated": ai_generated,
        }
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/wizard/apply")
async def apply_wizard(body: ApplyRequest, request: Request):
    import json as _json
    editor = request.app.state.editor
    config = request.app.state.config
    results = []

    if body.claude_md:
        target = Path(body.project_path) / "CLAUDE.md"
        editor.write_text(target, body.claude_md)
        results.append({"type": "claude_md", "applied": True})

    if body.hooks:
        settings_path = config.paths.settings_path
        if settings_path.exists():
            settings = _json.loads(settings_path.read_text())
            mtime = settings_path.stat().st_mtime
            hooks = settings.setdefault("hooks", {})
            for hook in body.hooks:
                event = hook.get("event", "")
                command = hook.get("command", "")
                if event and command:
                    hooks.setdefault(event, []).append(
                        {"hooks": [{"type": "command", "command": command}]}
                    )
            editor.write_json(settings_path, settings, last_mtime=mtime)
            results.append({"type": "hooks", "applied": True, "count": len(body.hooks)})

    return {"results": results}


@router.post("/wizard/generate-skill")
async def generate_skill_endpoint(body: GenerateSkillRequest, request: Request):
    from claude_hub.services.wizard import generate_skill
    config = request.app.state.config
    result = generate_skill(body.messages, config.paths)
    return result


@router.post("/wizard/project-overview")
async def project_overview(body: AnalyzeRequest, request: Request):
    scanner = request.app.state.scanner
    try:
        return scanner.get_project_overview(body.project_path)
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/wizard/project-overviews")
async def all_project_overviews(request: Request):
    scanner = request.app.state.scanner
    projects = scanner.list_projects()
    results = []
    for p in projects:
        try:
            overview = scanner.get_project_overview(p["decoded"])
            results.append(overview)
        except Exception:
            continue
    return results
