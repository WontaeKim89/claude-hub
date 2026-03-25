"""Skills CRUD API."""
import difflib
from pathlib import Path

from claude_hub.services.scanner import _cache

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
    _cache.pop("scan_skills", None)
    return {"ok": True}


@router.get("/skills/duplicates/scan")
async def scan_duplicate_skills(request: Request, threshold: float = 0.7):
    """모든 스킬 간 유사도를 비교하여 중복 후보를 반환."""
    scanner = request.app.state.scanner
    skills = scanner.scan_skills()

    # 각 스킬의 SKILL.md 내용 로드
    skill_contents: list[dict] = []
    for s in skills:
        try:
            content = Path(s.path).read_text(encoding="utf-8", errors="ignore")
            skill_contents.append({
                "name": s.name,
                "source": s.source,
                "description": s.description,
                "path": s.path,
                "content": content,
            })
        except Exception:
            continue

    # 모든 쌍에 대해 유사도 계산
    pairs = []
    for i in range(len(skill_contents)):
        for j in range(i + 1, len(skill_contents)):
            a, b = skill_contents[i], skill_contents[j]
            ratio = difflib.SequenceMatcher(None, a["content"], b["content"]).ratio()
            if ratio >= threshold:
                grade = "red" if ratio >= 0.9 else "yellow"
                pairs.append({
                    "skill_a": a["name"],
                    "skill_b": b["name"],
                    "source_a": a["source"],
                    "source_b": b["source"],
                    "description_a": a["description"],
                    "description_b": b["description"],
                    "similarity": round(ratio * 100, 1),
                    "grade": grade,
                })

    pairs.sort(key=lambda x: x["similarity"], reverse=True)
    return pairs


@router.get("/skills/duplicates/compare")
async def compare_skills(request: Request, skill_a: str = "", skill_b: str = ""):
    """두 스킬의 내용을 나란히 비교, 유사 부분 하이라이트 정보 포함."""
    scanner = request.app.state.scanner
    skills = scanner.scan_skills()

    sa = next((s for s in skills if s.name == skill_a), None)
    sb = next((s for s in skills if s.name == skill_b), None)
    if not sa or not sb:
        raise HTTPException(status_code=404, detail="스킬을 찾을 수 없음")

    content_a = Path(sa.path).read_text(encoding="utf-8", errors="ignore")
    content_b = Path(sb.path).read_text(encoding="utf-8", errors="ignore")

    lines_a = content_a.splitlines()
    lines_b = content_b.splitlines()

    # unified diff로 변경 부분 표시
    diff = list(difflib.unified_diff(lines_a, lines_b, fromfile=skill_a, tofile=skill_b, lineterm=""))

    # SequenceMatcher로 매칭 블록 추출
    matcher = difflib.SequenceMatcher(None, lines_a, lines_b)
    matching_blocks = [
        {"a_start": b.a, "b_start": b.b, "size": b.size}
        for b in matcher.get_matching_blocks() if b.size > 0
    ]

    return {
        "skill_a": {"name": skill_a, "source": sa.source, "content": content_a, "lines": len(lines_a)},
        "skill_b": {"name": skill_b, "source": sb.source, "content": content_b, "lines": len(lines_b)},
        "similarity": round(matcher.ratio() * 100, 1),
        "diff": diff,
        "matching_blocks": matching_blocks,
    }
