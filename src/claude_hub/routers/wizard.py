"""Harness Wizard + AI Skill Generator API."""
from pathlib import Path

from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel

from claude_hub.services.scanner import _cached, invalidate_settings_cache

router = APIRouter(tags=["wizard"])


class AnalyzeRequest(BaseModel):
    project_path: str


class ApplyRequest(BaseModel):
    project_path: str
    claude_md: str | None = None
    hooks: list[dict] | None = None
    project_settings: dict | None = None
    memory_files: dict | None = None
    skills: list[dict] | None = None
    agents: list[dict] | None = None
    commands: list[dict] | None = None
    mcp_servers: dict | None = None


class GenerateSkillRequest(BaseModel):
    messages: list[dict]


@router.post("/wizard/analyze")
async def analyze_project_endpoint(body: AnalyzeRequest, request: Request):
    import asyncio
    from claude_hub.services.wizard import analyze_project
    config = request.app.state.config
    try:
        # 블로킹 함수를 별도 스레드에서 실행 (이벤트 루프 블로킹 방지)
        loop = asyncio.get_event_loop()
        result = await loop.run_in_executor(None, lambda: analyze_project(body.project_path, config.paths))
        # AI 생성 성공 여부 판단: hooks나 mcp_suggestions가 있거나, claude_md가 실질적 내용을 포함
        ai_generated = bool(result.hooks or result.mcp_suggestions) or len(result.claude_md) > 200
        return {
            "project_path": result.project_path,
            "tech_stack": result.tech_stack,
            "claude_md": result.claude_md,
            "hooks": result.hooks,
            "mcp_suggestions": result.mcp_suggestions,
            "project_settings": result.project_settings,
            "memory_files": result.memory_files,
            "skills": result.skills or [],
            "agents": result.agents or [],
            "commands": result.commands or [],
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

    project_dir = Path(body.project_path)
    if not project_dir.exists():
        raise HTTPException(status_code=400, detail=f"Project directory not found: {body.project_path}")

    if body.claude_md:
        target = project_dir / "CLAUDE.md"
        target.parent.mkdir(parents=True, exist_ok=True)
        target.write_text(body.claude_md, encoding="utf-8")
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
            invalidate_settings_cache()
            results.append({"type": "hooks", "applied": True, "count": len(body.hooks)})

    # 프로젝트 설정 (.claude/settings.json)
    if body.project_settings:
        proj_settings_dir = Path(body.project_path) / ".claude"
        proj_settings_dir.mkdir(parents=True, exist_ok=True)
        proj_settings_path = proj_settings_dir / "settings.json"
        proj_settings_path.write_text(_json.dumps(body.project_settings, indent=2, ensure_ascii=False))
        results.append({"type": "project_settings", "applied": True})

    # 메모리 파일
    if body.memory_files:
        from claude_hub.utils.paths import encode_project_path
        encoded = encode_project_path(body.project_path)
        mem_dir = config.paths.projects_dir / encoded / "memory"
        mem_dir.mkdir(parents=True, exist_ok=True)
        for fname, content in body.memory_files.items():
            (mem_dir / fname).write_text(content, encoding="utf-8")
        results.append({"type": "memory_files", "applied": True, "count": len(body.memory_files)})

    # 스킬
    if body.skills:
        skills_dir = Path(body.project_path) / ".claude" / "skills"
        for skill in body.skills:
            name = skill.get("name", "")
            content = skill.get("content", "")
            if name and content:
                skill_dir = skills_dir / name
                skill_dir.mkdir(parents=True, exist_ok=True)
                (skill_dir / "SKILL.md").write_text(content, encoding="utf-8")
        results.append({"type": "skills", "applied": True, "count": len(body.skills)})

    # 에이전트
    if body.agents:
        agents_dir = Path(body.project_path) / ".claude" / "agents"
        agents_dir.mkdir(parents=True, exist_ok=True)
        for agent in body.agents:
            name = agent.get("name", "")
            content = agent.get("content", "")
            if name and content:
                (agents_dir / f"{name}.md").write_text(content, encoding="utf-8")
        results.append({"type": "agents", "applied": True, "count": len(body.agents)})

    # 커맨드
    if body.commands:
        commands_dir = Path(body.project_path) / ".claude" / "commands"
        commands_dir.mkdir(parents=True, exist_ok=True)
        for cmd in body.commands:
            name = cmd.get("name", "")
            content = cmd.get("content", "")
            if name and content:
                (commands_dir / f"{name}.md").write_text(content, encoding="utf-8")
        results.append({"type": "commands", "applied": True, "count": len(body.commands)})

    # MCP 서버
    if body.mcp_servers:
        settings_path = config.paths.settings_path
        if settings_path.exists():
            settings = _json.loads(settings_path.read_text())
            mcp = settings.setdefault("mcpServers", {})
            for name_key, cfg in body.mcp_servers.items():
                if name_key not in mcp:
                    mcp[name_key] = cfg
            settings_path.write_text(_json.dumps(settings, indent=2, ensure_ascii=False))
            invalidate_settings_cache()
            results.append({"type": "mcp_servers", "applied": True})

    return {"results": results}


@router.post("/wizard/generate-skill")
async def generate_skill_endpoint(body: GenerateSkillRequest, request: Request):
    import asyncio
    from claude_hub.services.wizard import generate_skill
    config = request.app.state.config
    loop = asyncio.get_event_loop()
    result = await loop.run_in_executor(None, lambda: generate_skill(body.messages, config.paths))
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
            decoded = p["decoded"] if isinstance(p, dict) else p.decoded
            overview = scanner.get_project_overview(decoded)
            results.append(overview)
        except Exception:
            continue
    return results


@router.get("/wizard/project-tree")
async def project_tree(request: Request, path: str):
    scanner = request.app.state.scanner
    try:
        return scanner.get_project_tree(path)
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/wizard/project-trees-all")
async def all_project_trees(request: Request):
    """모든 프로젝트의 트리를 한번에 반환 (N+1 문제 해결)."""
    scanner = request.app.state.scanner

    def _load():
        projects = scanner.list_projects()
        results = []
        for p in projects:
            try:
                decoded = p["decoded"] if isinstance(p, dict) else p.decoded
                tree = scanner.get_project_tree(decoded)
                results.append(tree)
            except Exception:
                continue
        return results

    return _cached("project_trees_all", _load)


@router.get("/projects/grouped")
async def projects_grouped(request: Request):
    """프로젝트를 원본 레포와 워크트리로 그룹화."""
    scanner = request.app.state.scanner
    return scanner.list_projects_grouped()


class TogglePermissionsRequest(BaseModel):
    project_path: str
    enabled: bool


@router.post("/projects/toggle-permissions")
async def toggle_permissions(body: TogglePermissionsRequest):
    """프로젝트의 .claude/settings.local.json에서 permissions allow all 토글."""
    import json
    from pathlib import Path

    settings_local = Path(body.project_path) / ".claude" / "settings.local.json"
    settings_local.parent.mkdir(parents=True, exist_ok=True)

    if settings_local.exists():
        data = json.loads(settings_local.read_text())
    else:
        data = {}

    if body.enabled:
        data.setdefault("permissions", {})["allow"] = [
            "Bash(*)", "Read(*)", "Edit(*)", "Write(*)", "WebFetch(*)", "WebSearch"
        ]
    else:
        if "permissions" in data:
            data["permissions"].pop("allow", None)
            if not data["permissions"]:
                del data["permissions"]

    settings_local.write_text(json.dumps(data, indent=2, ensure_ascii=False))
    return {"ok": True, "enabled": body.enabled}


@router.delete("/projects/{encoded}")
async def delete_project(encoded: str, request: Request):
    """프로젝트의 ~/.claude/projects/{encoded} 디렉토리 전체 삭제."""
    import shutil
    config = request.app.state.config
    project_dir = config.paths.projects_dir / encoded
    if not project_dir.exists():
        from fastapi import HTTPException
        raise HTTPException(status_code=404, detail=f"Project not found: {encoded}")
    shutil.rmtree(project_dir)
    return {"ok": True, "deleted": encoded}


@router.get("/projects/permissions-status")
async def permissions_status(project_path: str):
    """프로젝트의 권한 상태 확인."""
    import json
    from pathlib import Path

    settings_local = Path(project_path) / ".claude" / "settings.local.json"
    if not settings_local.exists():
        return {"all_allowed": False}

    data = json.loads(settings_local.read_text())
    allow = data.get("permissions", {}).get("allow", [])
    return {"all_allowed": "Bash(*)" in allow}


class CompactRequest(BaseModel):
    path: str


@router.post("/wizard/compact")
async def compact_file(body: CompactRequest, request: Request):
    """Claude CLI로 파일 내용을 요약/compact."""
    import json
    from pathlib import Path

    from claude_hub.utils.claude_cli import run_claude

    file_path = Path(body.path).expanduser().resolve()
    if not file_path.is_file():
        raise HTTPException(status_code=404, detail="File not found")

    content = file_path.read_text(errors="ignore")
    lines = len(content.splitlines())

    prompt = f"""아래 파일의 내용을 핵심만 유지하면서 간결하게 요약/재구성해주세요.
불필요한 중복, 장황한 설명, outdated 내용을 제거하고 핵심 정보만 남기세요.
원본 형식(마크다운)을 유지하세요.

파일: {file_path.name} ({lines}줄)
---
{content[:8000]}
---

요약된 내용만 출력하세요 (JSON 아님, 마크다운 원문만):"""

    try:
        proc = run_claude("-p", prompt, "--output-format", "json", timeout=60)
        if proc.returncode == 0:
            wrapper = json.loads(proc.stdout)
            result = wrapper.get("result", "") if isinstance(wrapper, dict) else proc.stdout
            return {
                "original_lines": lines,
                "compacted": result.strip(),
                "compacted_lines": len(result.strip().splitlines()),
                "path": str(file_path),
            }
    except Exception:
        pass

    raise HTTPException(status_code=500, detail="Compact failed")


class FileReadRequest(BaseModel):
    path: str


class FileWriteRequest(BaseModel):
    path: str
    content: str


@router.post("/file/read")
async def read_file(body: FileReadRequest):
    """파일 내용 읽기."""
    file_path = Path(body.path).expanduser().resolve()
    if not file_path.is_file():
        raise HTTPException(status_code=404, detail="파일을 찾을 수 없습니다")
    try:
        content = file_path.read_text(errors="ignore")
        return {"content": content, "path": str(file_path)}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/file/write")
async def write_file(body: FileWriteRequest, request: Request):
    """파일 내용 수정 (백업 후)."""
    file_path = Path(body.path).expanduser().resolve()
    editor = request.app.state.editor
    editor.write_text(file_path, body.content)
    return {"ok": True, "path": str(file_path)}


@router.post("/file/delete")
async def delete_file(body: FileReadRequest, request: Request):
    """파일 삭제 (백업 후)."""
    file_path = Path(body.path).expanduser().resolve()
    if not file_path.is_file():
        raise HTTPException(status_code=404, detail="파일을 찾을 수 없습니다")
    backup = request.app.state.backup
    backup.create_backup(file_path)
    file_path.unlink()
    return {"ok": True, "path": str(file_path)}
