"""Skills CRUD API."""
from pathlib import Path

from fastapi import APIRouter, HTTPException, Request

from claude_hub.models.skill import SkillCreate, SkillDetail, SkillSummary, SkillUpdate

router = APIRouter(tags=["skills"])


@router.get("/skills", response_model=list[SkillSummary])
async def list_skills(request: Request):
    scanner = request.app.state.scanner
    return scanner.scan_skills()


@router.get("/skills/{name}", response_model=SkillDetail)
async def get_skill(name: str, request: Request):
    scanner = request.app.state.scanner
    skills = scanner.scan_skills()
    skill = next((s for s in skills if s.name == name), None)
    if skill is None:
        raise HTTPException(status_code=404, detail=f"스킬 없음: {name}")
    skill_md = Path(skill.path)
    content = skill_md.read_text(encoding="utf-8")
    return SkillDetail(
        name=skill.name,
        description=skill.description,
        source=skill.source,
        invoke_command=skill.invoke_command,
        path=skill.path,
        content=content,
        editable=True,
    )


@router.post("/skills", response_model=SkillSummary, status_code=201)
async def create_skill(body: SkillCreate, request: Request):
    scanner = request.app.state.scanner
    editor = request.app.state.editor
    config = request.app.state.config

    # 이미 존재하는 스킬이면 409
    existing = scanner.scan_skills()
    if any(s.name == body.name for s in existing):
        raise HTTPException(status_code=409, detail=f"이미 존재하는 스킬: {body.name}")

    skills_dir = config.paths.skills_dir
    skill_md = editor.create_skill(
        skills_dir=skills_dir,
        name=body.name,
        description=body.description,
        body=body.content,
    )
    return SkillSummary(
        name=body.name,
        description=body.description,
        source="local",
        invoke_command=f"/skill:{body.name}",
        path=str(skill_md),
    )


@router.put("/skills/{name}")
async def update_skill(name: str, body: SkillUpdate, request: Request):
    scanner = request.app.state.scanner
    editor = request.app.state.editor

    skills = scanner.scan_skills()
    skill = next((s for s in skills if s.name == name), None)
    if skill is None:
        raise HTTPException(status_code=404, detail=f"스킬 없음: {name}")

    skill_md = Path(skill.path)
    editor.write_text(skill_md, body.content)
    return {"ok": True}


@router.delete("/skills/{name}")
async def delete_skill(name: str, request: Request):
    scanner = request.app.state.scanner
    editor = request.app.state.editor
    config = request.app.state.config

    skills = scanner.scan_skills()
    if not any(s.name == name for s in skills):
        raise HTTPException(status_code=404, detail=f"스킬 없음: {name}")

    skills_dir = config.paths.skills_dir
    editor.delete_skill(skills_dir=skills_dir, name=name)
    return {"ok": True}
