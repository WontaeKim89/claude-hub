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

    context = _gather_project_context(project_dir)

    global_claude_md = ""
    if paths.claude_md_path.exists():
        global_claude_md = paths.claude_md_path.read_text(errors="ignore")

    installed_skills = []
    if paths.skills_dir.exists():
        installed_skills = [d.name for d in paths.skills_dir.iterdir() if d.is_dir()]

    # 프롬프트를 간결하게 구성 (긴 프롬프트는 CLI timeout 유발)
    readme_summary = context.get("readme", "")[:500]
    structure_summary = json.dumps(context.get("structure", [])[:15], ensure_ascii=False)
    tech_stack = _detect_tech_stack(project_dir)

    prompt = f"""프로젝트 "{project_dir.name}"의 CLAUDE.md를 생성하세요.

기술스택: {', '.join(tech_stack)}
README 요약: {readme_summary[:300]}
구조: {structure_summary[:500]}

JSON으로만 응답하세요:
{{"tech_stack": ["..."], "claude_md": "# 프로젝트명\\n## 구조\\n...\\n## 코드 규칙\\n...\\n## 실행 방법\\n...", "hooks": [], "mcp_suggestions": []}}"""

    try:
        proc = subprocess.run(
            ["claude", "-p", prompt, "--output-format", "json"],
            capture_output=True, text=True, timeout=60
        )
        if proc.returncode == 0 and proc.stdout.strip():
            data = _parse_claude_json_response(proc.stdout)
            if data:
                return WizardResult(
                    project_path=str(project_dir),
                    tech_stack=data.get("tech_stack", tech_stack),
                    claude_md=data.get("claude_md", ""),
                    hooks=data.get("hooks", []),
                    mcp_suggestions=data.get("mcp_suggestions", []),
                )
    except subprocess.TimeoutExpired:
        pass
    except Exception:
        pass

    # Claude CLI 호출 실패 시 tech stack 감지만 수행
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
        if proc.returncode == 0 and proc.stdout.strip():
            data = _parse_claude_json_response(proc.stdout)
            if data:
                return data
    except Exception:
        pass

    return {"questions": [], "skill_md": "", "name": ""}


def _parse_claude_json_response(stdout: str) -> dict | None:
    """Claude CLI --output-format json 응답에서 JSON 객체를 추출."""
    try:
        wrapper = json.loads(stdout)
        text = wrapper.get("result", "") if isinstance(wrapper, dict) else stdout
    except json.JSONDecodeError:
        text = stdout

    text = text.strip()

    # ```json ... ``` 래핑 제거
    if "```" in text:
        lines = text.split("\n")
        extracted = []
        in_block = False
        for line in lines:
            if line.strip().startswith("```"):
                in_block = not in_block
                continue
            if in_block:
                extracted.append(line)
        if extracted:
            text = "\n".join(extracted)

    # JSON 객체 추출 — 중첩 브레이스를 고려한 파싱
    start = text.find("{")
    if start < 0:
        return None

    depth = 0
    end = -1
    for i in range(start, len(text)):
        if text[i] == "{":
            depth += 1
        elif text[i] == "}":
            depth -= 1
            if depth == 0:
                end = i
                break

    if end > start:
        try:
            return json.loads(text[start:end + 1])
        except json.JSONDecodeError:
            pass

    return None


def _gather_project_context(project_dir: Path) -> dict:
    """프로젝트 디렉토리에서 분석에 필요한 정보를 수집."""
    context: dict = {"name": project_dir.name, "path": str(project_dir)}

    for readme in ["README.md", "readme.md", "README.rst"]:
        path = project_dir / readme
        if path.exists():
            context["readme"] = path.read_text(errors="ignore")[:3000]
            break

    for pm_file in ["package.json", "pyproject.toml", "Cargo.toml", "go.mod", "pom.xml"]:
        path = project_dir / pm_file
        if path.exists():
            context[pm_file] = path.read_text(errors="ignore")[:2000]

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
