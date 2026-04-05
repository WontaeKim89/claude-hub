"""Skills CRUD API."""
import difflib
from pathlib import Path

from claude_hub.services.scanner import _cache

from fastapi import APIRouter, HTTPException, Request

from claude_hub.models.skill import (
    MergeExecuteRequest,
    MergePreviewRequest,
    SimilarityCheckRequest,
    SkillCreate,
    SkillDetail,
    SkillSummary,
    SkillUpdate,
)
from claude_hub.services.merge import merge_skills
from claude_hub.services.skill_comparator import compare_skill_pair, compare_skill_pairs_parallel

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
        raise HTTPException(status_code=409, detail=f"동일한 이름의 스킬이 이미 존재합니다: {body.name}")

    skills_dir = config.paths.skills_dir
    # content에 이미 frontmatter가 포함되어 있으면 그대로 저장 (이중 감싸기 방지)
    skill_dir = skills_dir / body.name
    skill_dir.mkdir(parents=True, exist_ok=True)
    skill_md = skill_dir / "SKILL.md"
    if body.content.strip().startswith("---"):
        editor._atomic_write(skill_md, body.content)
    else:
        skill_md = editor.create_skill(
            skills_dir=skills_dir,
            name=body.name,
            description=body.description,
            body=body.content,
        )
    _cache.pop("scan_skills", None)
    return SkillSummary(
        name=body.name,
        description=body.description,
        source="custom",
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


@router.post("/skills/check-similarity")
async def check_similarity(body: SimilarityCheckRequest, request: Request, threshold: float = 0.5):
    """생성하려는 스킬과 기존 스킬의 LLM 기반 4차원 유사도 분석.

    1차: difflib로 50% 이상 후보 필터링
    2차: Claude CLI로 4차원 분석
    """
    import frontmatter as fm

    scanner = request.app.state.scanner
    skills = scanner.scan_skills()

    new_post = fm.loads(body.content)
    new_body = new_post.content.strip()

    # 1차 필터: difflib로 후보 추출
    candidates: list[tuple[dict, dict]] = []
    new_info = {"name": body.name, "source": "new", "description": "", "content": body.content}

    for s in skills:
        if s.name == body.name:
            continue
        try:
            existing_content = Path(s.path).read_text(encoding="utf-8", errors="ignore")
        except Exception:
            continue
        existing_post = fm.loads(existing_content)
        existing_body = existing_post.content.strip()

        ratio = difflib.SequenceMatcher(None, new_body, existing_body).ratio()
        if ratio >= threshold:
            existing_info = {
                "name": s.name, "source": s.source,
                "description": s.description, "content": existing_content,
            }
            candidates.append((existing_info, new_info))

    if not candidates:
        return {"similar_skills": []}

    # 2차: LLM 분석 (병렬)
    results = compare_skill_pairs_parallel(candidates, max_workers=5)

    # 70% 이상만 반환, 기존 스킬 기준으로 재구성
    similar = []
    for r in results:
        if r.get("similarity", 0) >= 70:
            similar.append({
                "name": r["skill_a"],
                "source": r["source_a"],
                "description": r["description_a"],
                "similarity": r["similarity"],
                "grade": r["grade"],
                "dimensions": r.get("dimensions", {}),
                "overlapping_features": r.get("overlapping_features", []),
                "differences": r.get("differences", []),
                "recommendation": r.get("recommendation", ""),
            })

    similar.sort(key=lambda x: x["similarity"], reverse=True)
    return {"similar_skills": similar}


@router.get("/skills/duplicates/scan")
async def scan_duplicate_skills(request: Request, threshold: float = 0.5):
    """LLM 기반 4차원 스킬 유사도 분석.

    1차: difflib로 50% 이상 후보 필터링 (LLM 호출 최소화)
    2차: Claude CLI로 4차원 분석 (Purpose, Trigger, Process, Output)
    최종: 70% 이상만 반환
    """
    import frontmatter as fm

    scanner = request.app.state.scanner
    skills = scanner.scan_skills()

    # 각 스킬의 content 로드
    skill_data: list[dict] = []
    for s in skills:
        try:
            raw = Path(s.path).read_text(encoding="utf-8", errors="ignore")
            post = fm.loads(raw)
            skill_data.append({
                "name": s.name,
                "source": s.source,
                "description": s.description,
                "content": raw,
                "body": post.content.strip(),
            })
        except Exception:
            continue

    # 1차 필터: difflib로 50% 이상인 쌍만 추출
    candidate_pairs: list[tuple[dict, dict]] = []
    for i in range(len(skill_data)):
        for j in range(i + 1, len(skill_data)):
            a, b = skill_data[i], skill_data[j]
            ratio = difflib.SequenceMatcher(None, a["body"], b["body"]).ratio()
            if ratio >= threshold:
                candidate_pairs.append((a, b))

    if not candidate_pairs:
        return []

    # 2차 분석: LLM 기반 4차원 비교 (병렬)
    results = compare_skill_pairs_parallel(candidate_pairs, max_workers=10)

    # 70% 이상만 반환
    return [r for r in results if r.get("similarity", 0) >= 70]


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


@router.post("/skills/duplicates/merge-preview")
async def merge_preview(body: MergePreviewRequest, request: Request):
    """두 스킬의 병합 미리보기를 생성한다.

    skill_b가 파일로 존재하지 않는 경우 content_b/name_b로 raw content를 직접 전달할 수 있다.
    """
    scanner = request.app.state.scanner
    skills = scanner.scan_skills()

    sa = next((s for s in skills if s.name == body.skill_a), None)
    if not sa:
        raise HTTPException(status_code=404, detail=f"스킬을 찾을 수 없음: {body.skill_a}")

    content_a = Path(sa.path).read_text(encoding="utf-8", errors="ignore")

    # skill_b: raw content가 있으면 직접 사용, 없으면 파일에서 읽기
    if body.content_b:
        content_b = body.content_b
        name_b = body.name_b or "new-skill"
        source_b = "new"
    else:
        sb = next((s for s in skills if s.name == body.skill_b), None)
        if not sb:
            raise HTTPException(status_code=404, detail=f"스킬을 찾을 수 없음: {body.skill_b}")
        content_b = Path(sb.path).read_text(encoding="utf-8", errors="ignore")
        name_b = sb.name
        source_b = sb.source

    result = merge_skills(content_a, content_b, sa.name, name_b)

    return {
        "merged_content": result.merged_content,
        "merged_name": result.merged_name,
        "merged_description": result.merged_description,
        "source_map": [{"line": s.line, "source": s.source} for s in result.source_map],
        "skill_a": {"name": sa.name, "source": sa.source, "content": content_a},
        "skill_b": {"name": name_b, "source": source_b, "content": content_b},
    }


@router.post("/skills/duplicates/merge")
async def merge_execute(body: MergeExecuteRequest, request: Request):
    """두 스킬을 병합하여 새 스킬을 생성하고 원본을 삭제한다."""
    scanner = request.app.state.scanner
    editor = request.app.state.editor
    config = request.app.state.config
    skills = scanner.scan_skills()
    skills_dir = config.paths.skills_dir

    sa = next((s for s in skills if s.name == body.skill_a), None)
    if not sa:
        raise HTTPException(status_code=404, detail=f"스킬을 찾을 수 없음: {body.skill_a}")

    # skill_b는 파일로 존재하지 않을 수도 있음 (새 스킬 병합 시)
    sb = next((s for s in skills if s.name == body.skill_b), None) if body.skill_b else None

    # content의 frontmatter name을 target_name으로 맞추기
    import frontmatter as fm
    post = fm.loads(body.content)
    post["name"] = body.target_name
    final_content = fm.dumps(post)

    # target_name이 기존 스킬(A 또는 B)이면 덮어쓰기, 아니면 새로 생성
    is_overwrite_a = body.target_name == body.skill_a
    is_overwrite_b = sb and body.target_name == body.skill_b

    if is_overwrite_a:
        editor.write_text(Path(sa.path), final_content)
    elif is_overwrite_b:
        editor.write_text(Path(sb.path), final_content)
    else:
        # 새 이름으로 생성 — 이미 존재하면 409
        if any(s.name == body.target_name for s in skills):
            raise HTTPException(status_code=409, detail=f"이미 존재하는 스킬: {body.target_name}")
        # frontmatter 포함 content를 직접 파일로 쓰기
        skill_dir = skills_dir / body.target_name
        skill_dir.mkdir(parents=True, exist_ok=True)
        skill_md = skill_dir / "SKILL.md"
        editor._atomic_write(skill_md, final_content)

    # 원본 스킬 삭제 (custom만, target으로 사용된 것은 제외, 존재하는 것만)
    deleted = []
    if body.delete_sources:
        sources = [(sa, body.skill_a)]
        if sb:
            sources.append((sb, body.skill_b))
        for skill, name in sources:
            if name == body.target_name:
                continue
            if skill.source == "custom":
                editor.delete_skill(skills_dir=skills_dir, name=name)
                deleted.append(name)

    _cache.pop("scan_skills", None)

    return {"ok": True, "created": body.target_name, "deleted": deleted}
