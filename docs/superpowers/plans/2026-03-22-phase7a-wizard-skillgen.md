# Phase 7A: Harness Wizard + AI Skill Generator Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 프로젝트 분석 → 맞춤 CLAUDE.md 자동 생성 (Harness Wizard) + 자연어 대화로 SKILL.md 자동 생성 (AI Skill Generator)

**Architecture:** Claude CLI를 subprocess로 호출하여 프로젝트 분석 및 스킬 생성. 프론트엔드에서 대화 상태 관리, 백엔드는 stateless API. 결과는 체크박스 미리보기 후 선택 적용.

**Tech Stack:** FastAPI (백엔드) / Claude CLI subprocess / React + TanStack Query (프론트엔드)

**Spec:** `docs/superpowers/specs/2026-03-22-phase7-wow-features.md` Phase 7A 섹션

---

## File Structure

### Backend

| File | Responsibility |
|------|---------------|
| `src/claude_hub/services/wizard.py` | 프로젝트 분석 + CLAUDE.md 생성 로직 (Claude CLI 호출) |
| `src/claude_hub/routers/wizard.py` | Wizard API (analyze, apply, generate-skill) |
| `tests/test_routers/test_wizard.py` | Wizard API 테스트 |

### Frontend

| File | Responsibility |
|------|---------------|
| `src/client/src/pages/Wizard.tsx` | Harness Wizard 페이지 (프로젝트 선택 → 분석 → 미리보기 → 적용) |
| `src/client/src/components/wizard/AnalysisResult.tsx` | 분석 결과 체크박스 미리보기 컴포넌트 |
| `src/client/src/components/wizard/SkillChat.tsx` | AI 스킬 생성 채팅 인터페이스 |

---

## Chunk 1: Wizard Backend + API

### Task 1: Wizard Service (프로젝트 분석)

**Files:**
- Create: `src/claude_hub/services/wizard.py`

- [ ] **Step 1: wizard.py 구현**

```python
"""Harness Wizard — 프로젝트 분석 + CLAUDE.md 자동 생성."""
import json
import subprocess
from dataclasses import dataclass
from pathlib import Path

from claude_hub.utils.paths import ClaudePaths


@dataclass
class WizardResult:
    project_path: str
    tech_stack: list[str]
    claude_md: str
    hooks: list[dict]
    mcp_suggestions: list[dict]


def analyze_project(project_path: str, paths: ClaudePaths) -> WizardResult:
    """프로젝트를 분석하여 맞춤 harness 설정을 생성."""
    project_dir = Path(project_path).expanduser().resolve()
    if not project_dir.is_dir():
        raise ValueError(f"프로젝트 경로를 찾을 수 없습니다: {project_path}")

    # 프로젝트 정보 수집
    context = _gather_project_context(project_dir)

    # 전역 CLAUDE.md 읽기 (중복 방지용)
    global_claude_md = ""
    if paths.claude_md_path.exists():
        global_claude_md = paths.claude_md_path.read_text(errors="ignore")

    # 기존 스킬 목록
    installed_skills = []
    if paths.skills_dir.exists():
        installed_skills = [d.name for d in paths.skills_dir.iterdir() if d.is_dir()]

    # Claude CLI로 분석 요청
    prompt = f"""아래 프로젝트를 분석하여 프로젝트 맞춤 CLAUDE.md를 생성해주세요.

## 프로젝트 정보
{json.dumps(context, ensure_ascii=False, indent=2)}

## 전역 CLAUDE.md (이미 존재 — 여기 있는 내용과 중복하지 마세요)
{global_claude_md[:2000]}

## 이미 설치된 스킬
{', '.join(installed_skills)}

## 요청사항
1. 프로젝트 고유의 CLAUDE.md 내용만 생성 (전역과 중복 금지)
2. 프로젝트 구조, 코드 규칙, 실행 방법을 포함
3. 프로젝트의 tech stack에 맞는 구체적 지시문 작성

응답 형식 (JSON):
{{
  "tech_stack": ["Python 3.13", "FastAPI", ...],
  "claude_md": "# 프로젝트명\\n...",
  "hooks": [{{"event": "PostToolUse", "command": "...", "reason": "..."}}],
  "mcp_suggestions": [{{"name": "github", "reason": "..."}}]
}}"""

    try:
        proc = subprocess.run(
            ["claude", "-p", prompt, "--output-format", "json"],
            capture_output=True, text=True, timeout=120
        )
        if proc.returncode == 0:
            wrapper = json.loads(proc.stdout)
            output = wrapper.get("result", "") if isinstance(wrapper, dict) else proc.stdout
            # JSON 추출
            output = output.strip()
            start = output.find("{")
            end = output.rfind("}")
            if start >= 0 and end > start:
                data = json.loads(output[start:end + 1])
                return WizardResult(
                    project_path=str(project_dir),
                    tech_stack=data.get("tech_stack", []),
                    claude_md=data.get("claude_md", ""),
                    hooks=data.get("hooks", []),
                    mcp_suggestions=data.get("mcp_suggestions", []),
                )
    except Exception:
        pass

    # 실패 시 기본 결과 (tech stack 감지만)
    return WizardResult(
        project_path=str(project_dir),
        tech_stack=_detect_tech_stack(project_dir),
        claude_md=f"# {project_dir.name}\n\n프로젝트 분석에 실패했습니다. 수동으로 작성해주세요.",
        hooks=[],
        mcp_suggestions=[],
    )


def generate_skill(messages: list[dict], paths: ClaudePaths) -> dict:
    """대화 히스토리를 기반으로 SKILL.md를 생성."""
    installed_skills = []
    if paths.skills_dir.exists():
        installed_skills = [d.name for d in paths.skills_dir.iterdir() if d.is_dir()]

    conversation = "\n".join(
        f"{'사용자' if m['role'] == 'user' else 'AI'}: {m['content']}"
        for m in messages
    )

    prompt = f"""사용자와의 대화를 바탕으로 Claude Code 스킬(SKILL.md)을 생성해주세요.

## 대화 내용
{conversation}

## 이미 설치된 스킬 (중복 방지)
{', '.join(installed_skills)}

## 요청사항
1. SKILL.md 형식으로 YAML frontmatter(name, description) + 마크다운 본문
2. 섹션: 목적, 트리거 조건, 동작, 제약 조건
3. 사용자의 요구에 맞는 구체적이고 실용적인 내용

응답은 두 부분으로:
1. "questions" — 추가 확인이 필요하면 질문 (배열, 없으면 빈 배열)
2. "skill_md" — 생성된 SKILL.md 내용 (질문이 있어도 초안은 제공)
3. "name" — 스킬 이름 (영문 kebab-case)

JSON으로 응답:
{{"questions": [], "skill_md": "---\\nname: ...\\n---\\n...", "name": "skill-name"}}"""

    try:
        proc = subprocess.run(
            ["claude", "-p", prompt, "--output-format", "json"],
            capture_output=True, text=True, timeout=60
        )
        if proc.returncode == 0:
            wrapper = json.loads(proc.stdout)
            output = wrapper.get("result", "") if isinstance(wrapper, dict) else proc.stdout
            output = output.strip()
            start = output.find("{")
            end = output.rfind("}")
            if start >= 0 and end > start:
                return json.loads(output[start:end + 1])
    except Exception:
        pass

    return {"questions": [], "skill_md": "", "name": ""}


def _gather_project_context(project_dir: Path) -> dict:
    """프로젝트 디렉토리에서 분석에 필요한 정보를 수집."""
    context: dict = {"name": project_dir.name, "path": str(project_dir)}

    # README
    for readme in ["README.md", "readme.md", "README.rst"]:
        path = project_dir / readme
        if path.exists():
            context["readme"] = path.read_text(errors="ignore")[:3000]
            break

    # package managers
    for pm_file in ["package.json", "pyproject.toml", "Cargo.toml", "go.mod", "pom.xml"]:
        path = project_dir / pm_file
        if path.exists():
            context[pm_file] = path.read_text(errors="ignore")[:2000]

    # 파일 구조 (2레벨)
    dirs = []
    for item in sorted(project_dir.iterdir()):
        if item.name.startswith(".") or item.name in ("node_modules", "__pycache__", ".venv", "dist", "build"):
            continue
        if item.is_dir():
            sub = [f.name for f in sorted(item.iterdir())[:10] if not f.name.startswith(".")]
            dirs.append({"name": item.name, "children": sub})
        elif item.is_file():
            dirs.append({"name": item.name})
    context["structure"] = dirs[:30]

    # 기존 CLAUDE.md
    project_claude = project_dir / "CLAUDE.md"
    if project_claude.exists():
        context["existing_claude_md"] = project_claude.read_text(errors="ignore")[:2000]

    return context


def _detect_tech_stack(project_dir: Path) -> list[str]:
    """패키지 매니저 파일에서 tech stack을 감지."""
    stack = []
    if (project_dir / "package.json").exists():
        stack.append("Node.js")
    if (project_dir / "pyproject.toml").exists():
        stack.append("Python")
    if (project_dir / "Cargo.toml").exists():
        stack.append("Rust")
    if (project_dir / "go.mod").exists():
        stack.append("Go")
    if (project_dir / "tsconfig.json").exists():
        stack.append("TypeScript")
    return stack
```

- [ ] **Step 2: Commit**

```bash
git add src/claude_hub/services/wizard.py
git commit -m "feat: add wizard service (project analysis + skill generation via Claude CLI)"
```

### Task 2: Wizard Router + Tests

**Files:**
- Create: `src/claude_hub/routers/wizard.py`
- Create: `tests/test_routers/test_wizard.py`
- Modify: `src/claude_hub/main.py` (라우터 등록)

- [ ] **Step 1: wizard.py 라우터 구현**

```python
"""Harness Wizard + AI Skill Generator API."""
import json
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
async def analyze_project(body: AnalyzeRequest, request: Request):
    from claude_hub.services.wizard import analyze_project
    config = request.app.state.config
    try:
        result = analyze_project(body.project_path, config.paths)
        return {
            "project_path": result.project_path,
            "tech_stack": result.tech_stack,
            "claude_md": result.claude_md,
            "hooks": result.hooks,
            "mcp_suggestions": result.mcp_suggestions,
        }
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/wizard/apply")
async def apply_wizard(body: ApplyRequest, request: Request):
    from pathlib import Path
    editor = request.app.state.editor
    results = []

    # CLAUDE.md 적용
    if body.claude_md:
        target = Path(body.project_path) / "CLAUDE.md"
        editor.write_text(target, body.claude_md)
        results.append({"type": "claude_md", "applied": True})

    # Hooks 적용
    if body.hooks:
        import json as _json
        config = request.app.state.config
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
```

- [ ] **Step 2: main.py에 라우터 등록**

main.py의 `from claude_hub.routers import ...` 줄에 `wizard` 추가, `app.include_router(wizard.router, prefix="/api")` 추가.

- [ ] **Step 3: 테스트 작성**

```python
# tests/test_routers/test_wizard.py
import pytest

@pytest.mark.asyncio
async def test_analyze_invalid_path(client):
    resp = await client.post("/api/wizard/analyze", json={"project_path": "/nonexistent/path"})
    assert resp.status_code == 400

@pytest.mark.asyncio
async def test_analyze_valid_path(client, fake_claude_dir):
    resp = await client.post("/api/wizard/analyze", json={"project_path": str(fake_claude_dir.parent)})
    assert resp.status_code == 200
    data = resp.json()
    assert "tech_stack" in data
    assert "claude_md" in data
```

- [ ] **Step 4: 테스트 실행**

Run: `uv run pytest tests/ -v`
Expected: All pass

- [ ] **Step 5: Commit**

```bash
git add src/claude_hub/routers/wizard.py src/claude_hub/main.py tests/test_routers/test_wizard.py
git commit -m "feat: add Wizard API (analyze, apply, generate-skill)"
```

---

## Chunk 2: Wizard Frontend + AI Skill Chat

### Task 3: Wizard Page (프론트엔드)

**Files:**
- Create: `src/client/src/pages/Wizard.tsx`
- Create: `src/client/src/components/wizard/AnalysisResult.tsx`
- Modify: `src/client/src/components/layout/Sidebar.tsx` (Wizard 링크 추가)
- Modify: `src/client/src/App.tsx` (라우트 추가)
- Modify: `src/client/src/lib/api-client.ts` (wizard API 메서드)
- Modify: `src/client/src/lib/types.ts` (WizardResult 타입)
- Modify: `src/client/src/lib/i18n.ts` (번역 키)

- [ ] **Step 1: 타입 + API 클라이언트 추가**

types.ts에 추가:
```typescript
export interface WizardResult {
  project_path: string
  tech_stack: string[]
  claude_md: string
  hooks: Array<{ event: string; command: string; reason: string }>
  mcp_suggestions: Array<{ name: string; reason: string }>
}

export interface SkillGenResult {
  questions: string[]
  skill_md: string
  name: string
}
```

api-client.ts에 추가:
```typescript
wizard: {
  analyze: (projectPath: string) => request<WizardResult>('/wizard/analyze', { method: 'POST', body: JSON.stringify({ project_path: projectPath }) }),
  apply: (data: { project_path: string; claude_md?: string; hooks?: Array<Record<string, unknown>> }) => request('/wizard/apply', { method: 'POST', body: JSON.stringify(data) }),
  generateSkill: (messages: Array<{ role: string; content: string }>) => request<SkillGenResult>('/wizard/generate-skill', { method: 'POST', body: JSON.stringify({ messages }) }),
},
```

- [ ] **Step 2: Wizard.tsx 구현**

3단계 UI:
1. 프로젝트 선택 (기존 프로젝트 목록 + 경로 입력)
2. 분석 중 (로딩)
3. 결과 미리보기 (AnalysisResult 컴포넌트)

- [ ] **Step 3: AnalysisResult.tsx 구현**

체크박스로 CLAUDE.md / Hooks / MCP 선택 적용. CLAUDE.md는 Monaco Editor로 편집 가능.

- [ ] **Step 4: Sidebar + App.tsx 업데이트**

사이드바에 "Tools" 그룹 추가, "Wizard" 링크. App.tsx에 `/wizard` 라우트.

- [ ] **Step 5: 빌드 + 커밋**

```bash
cd src/client && npm run build
cd ../.. && git add -A && git commit -m "feat: add Wizard page with project analysis and CLAUDE.md preview"
```

### Task 4: AI Skill Generator Chat (프론트엔드)

**Files:**
- Create: `src/client/src/components/wizard/SkillChat.tsx`
- Modify: `src/client/src/pages/Skills.tsx` (탭 추가)

- [ ] **Step 1: SkillChat.tsx 구현**

채팅 인터페이스:
- messages 배열 상태 관리
- AI 초기 메시지: "어떤 스킬을 만들고 싶으신가요?"
- 사용자 입력 → POST /api/wizard/generate-skill → AI 응답 (질문 or 생성 결과)
- 질문이 있으면 pill 버튼으로 표시
- SKILL.md 생성 시 코드 블록 미리보기
- "Monaco에서 편집" → Skills 기존 생성 폼으로 전환
- "스킬 저장" → POST /api/skills

- [ ] **Step 2: Skills.tsx에 탭 추가**

"+ 새 스킬" 클릭 시 나오는 모달에 "직접 작성 / AI 생성" 탭 전환 추가.
"AI 생성" 탭 선택 시 SkillChat 컴포넌트 렌더링.

- [ ] **Step 3: i18n 키 추가**

```
'wizard.title': { ko: 'Harness Wizard', en: 'Harness Wizard' }
'wizard.subtitle': { ko: '프로젝트 맞춤 환경 자동 구성', en: 'Auto-configure project environment' }
'wizard.analyze': { ko: '분석 시작', en: 'Start Analysis' }
'wizard.apply': { ko: '선택 항목 적용', en: 'Apply Selected' }
'wizard.selectProject': { ko: '프로젝트를 선택하세요', en: 'Select a project' }
'wizard.newPath': { ko: '새 경로 입력', en: 'Enter new path' }
'wizard.aiGenerate': { ko: 'AI 생성', en: 'AI Generate' }
'wizard.manualWrite': { ko: '직접 작성', en: 'Write Manually' }
```

- [ ] **Step 4: 빌드 + 전체 테스트 + 커밋**

```bash
cd src/client && npm run build
cd ../.. && uv run pytest tests/ -v
bash scripts/build.sh
git add -A && git commit -m "feat: add AI Skill Generator chat in Skills page + i18n"
```
